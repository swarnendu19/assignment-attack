import { TwitterApi, ETwitterStreamEvent } from 'twitter-api-v2'
import { ChannelType, Direction } from '@prisma/client'
import crypto from 'crypto'
import {
  TwitterConfig,
  TwitterWebhookPayload,
  TwitterDirectMessageEvent,
  SocialMediaService,
  SocialSendResult,
  SocialUserInfo,
  SocialMessageStatus,
  SocialMediaMessage,
  SocialMediaMetadata,
  TwitterDirectMessageEventSchema
} from '@/types/social'
import { UnifiedMessage } from '@/types/messages'
import { messageService } from './messageService'

export class TwitterService implements SocialMediaService {
  public readonly platform = 'twitter' as const
  private client: TwitterApi
  private config: TwitterConfig

  constructor(config: TwitterConfig) {
    this.config = config
    this.client = new TwitterApi({
      appKey: config.apiKey,
      appSecret: config.apiSecret,
      accessToken: config.accessToken,
      accessSecret: config.accessTokenSecret,
    })
  }

  /**
   * Send direct message via Twitter API v2
   */
  async sendMessage(
    recipientId: string, 
    text: string, 
    mediaUrls?: string[]
  ): Promise<SocialSendResult> {
    try {
      // Twitter API v2 direct message creation
      const messageData: any = {
        dm_conversation_id: recipientId,
        text: text,
      }

      // Add media attachments if provided
      if (mediaUrls && mediaUrls.length > 0) {
        // First upload media
        const mediaIds: string[] = []
        for (const mediaUrl of mediaUrls) {
          try {
            // Download and upload media
            const mediaId = await this.uploadMedia(mediaUrl)
            if (mediaId) {
              mediaIds.push(mediaId)
            }
          } catch (error) {
            console.error('Failed to upload media:', error)
          }
        }

        if (mediaIds.length > 0) {
          messageData.media_id = mediaIds[0] // Twitter DMs support one media attachment
        }
      }

      const response = await this.client.v2.sendDmToParticipant(recipientId, messageData)

      return {
        success: true,
        messageId: response.data?.dm_event_id,
        platform: 'twitter',
      }
    } catch (error: any) {
      console.error('Twitter send message error:', error)
      return {
        success: false,
        error: error.message || 'Failed to send Twitter message',
        platform: 'twitter',
      }
    }
  }

  /**
   * Validate Twitter webhook signature
   */
  validateWebhook(payload: string, signature: string, timestamp?: string): boolean {
    try {
      // Twitter uses HMAC-SHA256 for webhook validation
      const expectedSignature = crypto
        .createHmac('sha256', this.config.apiSecret)
        .update(payload)
        .digest('base64')

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(`sha256=${expectedSignature}`)
      )
    } catch (error) {
      console.error('Twitter webhook validation error:', error)
      return false
    }
  }

  /**
   * Process incoming Twitter webhook
   */
  async processInboundWebhook(payload: TwitterWebhookPayload): Promise<SocialMediaMessage | null> {
    try {
      // Process direct message events
      if (payload.direct_message_events && payload.direct_message_events.length > 0) {
        const dmEvent = payload.direct_message_events[0]
        
        // Validate the event structure
        const validatedEvent = TwitterDirectMessageEventSchema.parse(dmEvent)
        
        // Convert to unified social media message
        const socialMessage = await this.convertTwitterDMToSocialMessage(
          validatedEvent,
          payload.users || {}
        )

        return socialMessage
      }

      return null
    } catch (error) {
      console.error('Error processing Twitter webhook:', error)
      return null
    }
  }

  /**
   * Get Twitter user information
   */
  async getUserInfo(userId: string): Promise<SocialUserInfo | null> {
    try {
      const user = await this.client.v2.user(userId, {
        'user.fields': ['name', 'username', 'profile_image_url']
      })

      if (!user.data) {
        return null
      }

      return {
        id: user.data.id,
        name: user.data.name,
        username: user.data.username,
        profileImageUrl: user.data.profile_image_url,
        platform: 'twitter',
      }
    } catch (error) {
      console.error('Error fetching Twitter user info:', error)
      return null
    }
  }

  /**
   * Get message status (Twitter doesn't provide detailed delivery status for DMs)
   */
  async getMessageStatus(messageId: string): Promise<SocialMessageStatus> {
    // Twitter API v2 doesn't provide detailed delivery status for direct messages
    // We can only assume the message was sent successfully if we got a response
    return {
      messageId,
      status: 'sent',
      timestamp: new Date(),
      platform: 'twitter',
    }
  }

  /**
   * Set up webhook subscription (for account activity API)
   */
  async setupWebhook(webhookUrl: string): Promise<boolean> {
    try {
      // Note: Twitter's Account Activity API requires approval and is part of premium/enterprise plans
      // This is a placeholder for webhook setup
      console.log('Setting up Twitter webhook:', webhookUrl)
      
      // In a real implementation, you would:
      // 1. Register the webhook URL with Twitter
      // 2. Handle the CRC (Challenge Response Check)
      // 3. Subscribe to user events
      
      return true
    } catch (error) {
      console.error('Error setting up Twitter webhook:', error)
      return false
    }
  }

  /**
   * Handle webhook challenge (CRC)
   */
  handleWebhookChallenge(crcToken: string): string {
    const hmac = crypto.createHmac('sha256', this.config.apiSecret)
    hmac.update(crcToken)
    return `sha256=${hmac.digest('base64')}`
  }

  /**
   * Private helper methods
   */
  private async convertTwitterDMToSocialMessage(
    dmEvent: TwitterDirectMessageEvent,
    users: Record<string, any>
  ): Promise<SocialMediaMessage> {
    const messageData = dmEvent.message_create.message_data
    const senderId = dmEvent.message_create.sender_id
    const recipientId = dmEvent.message_create.target.recipient_id
    
    // Extract media URLs
    const mediaUrls: string[] = []
    if (messageData.attachment?.media) {
      mediaUrls.push(messageData.attachment.media.media_url_https)
    }
    if (messageData.entities?.media) {
      mediaUrls.push(...messageData.entities.media.map(m => m.media_url_https))
    }

    // Get sender information
    const sender = users[senderId]
    const recipient = users[recipientId]

    const metadata: SocialMediaMetadata = {
      platform: 'twitter',
      messageId: dmEvent.id,
      senderId,
      recipientId,
      senderHandle: sender?.screen_name,
      recipientHandle: recipient?.screen_name,
      mediaAttachments: mediaUrls.map(url => ({
        type: 'image', // Twitter DMs primarily support images
        url,
      })),
      entities: {
        urls: messageData.entities?.urls?.map(url => ({
          url: url.url,
          expandedUrl: url.expanded_url,
          displayUrl: url.display_url,
        })),
      },
    }

    return {
      id: crypto.randomUUID(),
      platform: 'twitter',
      externalId: dmEvent.id,
      senderId,
      recipientId,
      text: messageData.text,
      mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
      timestamp: new Date(parseInt(dmEvent.created_timestamp)),
      direction: Direction.INBOUND, // Webhook events are always inbound
      metadata,
    }
  }

  private async uploadMedia(mediaUrl: string): Promise<string | null> {
    try {
      // Download the media file
      const response = await fetch(mediaUrl)
      if (!response.ok) {
        throw new Error(`Failed to download media: ${response.statusText}`)
      }

      const buffer = await response.arrayBuffer()
      const mediaData = Buffer.from(buffer)

      // Upload to Twitter
      const mediaUpload = await this.client.v1.uploadMedia(mediaData, {
        mimeType: response.headers.get('content-type') || 'image/jpeg',
      })

      return mediaUpload
    } catch (error) {
      console.error('Error uploading media to Twitter:', error)
      return null
    }
  }
}

/**
 * Factory function to create Twitter service instance
 */
export function createTwitterService(): TwitterService {
  const config: TwitterConfig = {
    apiKey: process.env.TWITTER_API_KEY!,
    apiSecret: process.env.TWITTER_API_SECRET!,
    accessToken: process.env.TWITTER_ACCESS_TOKEN!,
    accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!,
    bearerToken: process.env.TWITTER_BEARER_TOKEN!,
    webhookUrl: process.env.TWITTER_WEBHOOK_URL,
  }

  // Validate required configuration
  const requiredFields = ['apiKey', 'apiSecret', 'accessToken', 'accessTokenSecret', 'bearerToken']
  const missingFields = requiredFields.filter(field => !config[field as keyof TwitterConfig])
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required Twitter configuration: ${missingFields.join(', ')}`)
  }

  return new TwitterService(config)
}

// Export singleton instance (will throw if config is missing)
export const twitterService = (() => {
  try {
    return createTwitterService()
  } catch (error) {
    console.warn('Twitter service not initialized:', error)
    return null
  }
})()