import axios, { AxiosInstance } from 'axios'
import { ChannelType, Direction } from '@prisma/client'
import crypto from 'crypto'
import {
  FacebookConfig,
  FacebookWebhookPayload,
  FacebookMessagingEvent,
  SocialMediaService,
  SocialSendResult,
  SocialUserInfo,
  SocialMessageStatus,
  SocialMediaMessage,
  SocialMediaMetadata,
  FacebookMessagingEventSchema
} from '@/types/social'

export class FacebookService implements SocialMediaService {
  public readonly platform = 'facebook' as const
  private client: AxiosInstance
  private config: FacebookConfig

  constructor(config: FacebookConfig) {
    this.config = config
    this.client = axios.create({
      baseURL: 'https://graph.facebook.com/v18.0',
      timeout: 30000,
    })
  }

  /**
   * Send message via Facebook Messenger API
   */
  async sendMessage(
    recipientId: string, 
    text: string, 
    mediaUrls?: string[]
  ): Promise<SocialSendResult> {
    try {
      const messageData: any = {
        recipient: {
          id: recipientId,
        },
        message: {},
      }

      // Add text content
      if (text) {
        messageData.message.text = text
      }

      // Add media attachments if provided
      if (mediaUrls && mediaUrls.length > 0) {
        // Facebook Messenger supports multiple attachments
        messageData.message.attachments = mediaUrls.map(url => ({
          type: 'image', // Assume image for now, could be enhanced to detect type
          payload: {
            url: url,
            is_reusable: true,
          },
        }))
      }

      const response = await this.client.post(
        `/${this.config.pageId}/messages`,
        messageData,
        {
          params: {
            access_token: this.config.accessToken,
          },
        }
      )

      return {
        success: true,
        messageId: response.data.message_id,
        platform: 'facebook',
      }
    } catch (error: any) {
      console.error('Facebook send message error:', error.response?.data || error.message)
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message || 'Failed to send Facebook message',
        platform: 'facebook',
      }
    }
  }

  /**
   * Validate Facebook webhook signature
   */
  validateWebhook(payload: string, signature: string, timestamp?: string): boolean {
    try {
      // Facebook uses HMAC-SHA256 with app secret
      const expectedSignature = crypto
        .createHmac('sha256', this.config.appSecret)
        .update(payload)
        .digest('hex')

      const receivedSignature = signature.replace('sha256=', '')

      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(receivedSignature)
      )
    } catch (error) {
      console.error('Facebook webhook validation error:', error)
      return false
    }
  }

  /**
   * Process incoming Facebook webhook
   */
  async processInboundWebhook(payload: FacebookWebhookPayload): Promise<SocialMediaMessage | null> {
    try {
      // Process messaging events
      for (const entry of payload.entry) {
        if (entry.messaging && entry.messaging.length > 0) {
          const messagingEvent = entry.messaging[0]
          
          // Only process message events (not delivery receipts or read receipts)
          if (messagingEvent.message && messagingEvent.message.text) {
            // Validate the event structure
            const validatedEvent = FacebookMessagingEventSchema.parse(messagingEvent)
            
            // Convert to unified social media message
            const socialMessage = await this.convertFacebookMessageToSocialMessage(validatedEvent)
            return socialMessage
          }
        }
      }

      return null
    } catch (error) {
      console.error('Error processing Facebook webhook:', error)
      return null
    }
  }

  /**
   * Get Facebook user information
   */
  async getUserInfo(userId: string): Promise<SocialUserInfo | null> {
    try {
      const response = await this.client.get(`/${userId}`, {
        params: {
          fields: 'name,profile_pic',
          access_token: this.config.accessToken,
        },
      })

      const userData = response.data

      return {
        id: userData.id,
        name: userData.name,
        username: undefined, // Facebook doesn't have usernames like Twitter
        profileImageUrl: userData.profile_pic,
        platform: 'facebook',
      }
    } catch (error) {
      console.error('Error fetching Facebook user info:', error)
      return null
    }
  }

  /**
   * Get message status
   */
  async getMessageStatus(messageId: string): Promise<SocialMessageStatus> {
    try {
      // Facebook doesn't provide a direct API to check message delivery status
      // We can only track what we receive via webhooks
      return {
        messageId,
        status: 'sent',
        timestamp: new Date(),
        platform: 'facebook',
      }
    } catch (error) {
      console.error('Error fetching Facebook message status:', error)
      return {
        messageId,
        status: 'failed',
        timestamp: new Date(),
        platform: 'facebook',
      }
    }
  }

  /**
   * Set up webhook subscription
   */
  async setupWebhook(webhookUrl: string, verifyToken: string): Promise<boolean> {
    try {
      // Subscribe to page events
      const response = await this.client.post(
        `/${this.config.pageId}/subscribed_apps`,
        {},
        {
          params: {
            access_token: this.config.accessToken,
          },
        }
      )

      console.log('Facebook webhook setup response:', response.data)
      return response.data.success === true
    } catch (error) {
      console.error('Error setting up Facebook webhook:', error)
      return false
    }
  }

  /**
   * Handle webhook verification challenge
   */
  handleWebhookChallenge(mode: string, token: string, challenge: string): string | null {
    if (mode === 'subscribe' && token === this.config.verifyToken) {
      return challenge
    }
    return null
  }

  /**
   * Get page access token (if using user access token)
   */
  async getPageAccessToken(userAccessToken: string): Promise<string | null> {
    try {
      const response = await this.client.get(`/${this.config.pageId}`, {
        params: {
          fields: 'access_token',
          access_token: userAccessToken,
        },
      })

      return response.data.access_token
    } catch (error) {
      console.error('Error getting page access token:', error)
      return null
    }
  }

  /**
   * Send typing indicator
   */
  async sendTypingIndicator(recipientId: string, action: 'typing_on' | 'typing_off'): Promise<boolean> {
    try {
      await this.client.post(
        `/${this.config.pageId}/messages`,
        {
          recipient: {
            id: recipientId,
          },
          sender_action: action,
        },
        {
          params: {
            access_token: this.config.accessToken,
          },
        }
      )

      return true
    } catch (error) {
      console.error('Error sending typing indicator:', error)
      return false
    }
  }

  /**
   * Private helper methods
   */
  private async convertFacebookMessageToSocialMessage(
    messagingEvent: FacebookMessagingEvent
  ): Promise<SocialMediaMessage> {
    const message = messagingEvent.message!
    const senderId = messagingEvent.sender.id
    const recipientId = messagingEvent.recipient.id
    
    // Extract media URLs from attachments
    const mediaUrls: string[] = []
    if (message.attachments) {
      mediaUrls.push(...message.attachments.map(att => att.payload.url))
    }

    // Get sender information
    const senderInfo = await this.getUserInfo(senderId)

    const metadata: SocialMediaMetadata = {
      platform: 'facebook',
      messageId: message.mid,
      senderId,
      recipientId,
      senderHandle: senderInfo?.name,
      mediaAttachments: mediaUrls.map(url => ({
        type: 'image', // Facebook supports various types, but defaulting to image
        url,
      })),
    }

    return {
      id: crypto.randomUUID(),
      platform: 'facebook',
      externalId: message.mid,
      senderId,
      recipientId,
      text: message.text || '',
      mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
      timestamp: new Date(messagingEvent.timestamp),
      direction: Direction.INBOUND, // Webhook events are always inbound
      metadata,
    }
  }
}

/**
 * Factory function to create Facebook service instance
 */
export function createFacebookService(): FacebookService {
  const config: FacebookConfig = {
    appId: process.env.FACEBOOK_APP_ID!,
    appSecret: process.env.FACEBOOK_APP_SECRET!,
    accessToken: process.env.FACEBOOK_ACCESS_TOKEN!,
    pageId: process.env.FACEBOOK_PAGE_ID!,
    verifyToken: process.env.FACEBOOK_VERIFY_TOKEN!,
    webhookUrl: process.env.FACEBOOK_WEBHOOK_URL,
  }

  // Validate required configuration
  const requiredFields = ['appId', 'appSecret', 'accessToken', 'pageId', 'verifyToken']
  const missingFields = requiredFields.filter(field => !config[field as keyof FacebookConfig])
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required Facebook configuration: ${missingFields.join(', ')}`)
  }

  return new FacebookService(config)
}

// Export singleton instance (will throw if config is missing)
export const facebookService = (() => {
  try {
    return createFacebookService()
  } catch (error) {
    console.warn('Facebook service not initialized:', error)
    return null
  }
})()