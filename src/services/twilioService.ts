import twilio from 'twilio'
import { ChannelType, Direction } from '@prisma/client'
import { 
  TwilioMessage, 
  UnifiedMessage, 
  MessageStatus,
  MessageContent,
  ChannelMetadata 
} from '@/types/messages'
import { messageService } from './messageService'
import { createServiceErrorHandler } from '@/lib/serviceErrorHandler'
import { ErrorFactory, ErrorCategory, ErrorSeverity } from '@/lib/errorHandling'

export interface TwilioConfig {
  accountSid: string
  authToken: string
  phoneNumber: string
  webhookUrl?: string
}

export interface TwilioWebhookPayload {
  MessageSid: string
  AccountSid: string
  From: string
  To: string
  Body: string
  NumMedia: string
  MediaUrl0?: string
  MediaContentType0?: string
  MessageStatus?: string
  SmsStatus?: string
  SmsSid?: string
  SmsMessageSid?: string
  ErrorCode?: string
  ErrorMessage?: string
}

export interface TwilioSendMessageRequest {
  to: string
  body: string
  mediaUrl?: string[]
  from?: string
}

export interface TwilioSendResult {
  success: boolean
  messageId?: string
  error?: string
  status?: string
}

export class TwilioService {
  private client: twilio.Twilio
  private config: TwilioConfig
  private errorHandler = createServiceErrorHandler('twilio_service', {
    enableRecovery: true,
    enableReporting: true,
    defaultRetries: 3,
    defaultRetryDelay: 2000
  })

  constructor(config: TwilioConfig) {
    this.config = config
    this.client = twilio(config.accountSid, config.authToken)
  }

  /**
   * Send SMS message via Twilio
   */
  async sendSMS(request: TwilioSendMessageRequest): Promise<TwilioSendResult> {
    return this.errorHandler.executeWithRecovery(
      async () => {
        const message = await this.client.messages.create({
          body: request.body,
          from: request.from || this.config.phoneNumber,
          to: request.to,
          mediaUrl: request.mediaUrl,
        })

        return {
          success: true,
          messageId: message.sid,
          status: message.status,
        }
      },
      {
        operation: 'send_sms',
        metadata: { to: request.to, hasMedia: !!request.mediaUrl?.length }
      },
      {
        maxRetries: 3,
        retryDelay: 2000,
        fallbackFunction: async () => ({
          success: false,
          error: 'SMS service temporarily unavailable. Message queued for retry.',
        })
      }
    ).catch((error) => {
      // Return error result instead of throwing
      return {
        success: false,
        error: error.message || 'Failed to send SMS',
      }
    })
  }

  /**
   * Send WhatsApp message via Twilio
   */
  async sendWhatsApp(request: TwilioSendMessageRequest): Promise<TwilioSendResult> {
    return this.errorHandler.executeWithRecovery(
      async () => {
        const message = await this.client.messages.create({
          body: request.body,
          from: `whatsapp:${request.from || this.config.phoneNumber}`,
          to: `whatsapp:${request.to}`,
          mediaUrl: request.mediaUrl,
        })

        return {
          success: true,
          messageId: message.sid,
          status: message.status,
        }
      },
      {
        operation: 'send_whatsapp',
        metadata: { to: request.to, hasMedia: !!request.mediaUrl?.length }
      },
      {
        maxRetries: 2,
        retryDelay: 3000,
        fallbackFunction: async () => ({
          success: false,
          error: 'WhatsApp service temporarily unavailable. Message queued for retry.',
        })
      }
    ).catch((error) => {
      return {
        success: false,
        error: error.message || 'Failed to send WhatsApp message',
      }
    })
  }

  /**
   * Validate Twilio webhook signature
   */
  validateWebhookSignature(
    payload: string,
    signature: string,
    url: string
  ): boolean {
    try {
      return twilio.validateRequest(
        this.config.authToken,
        signature,
        url,
        payload
      )
    } catch (error) {
      console.error('Webhook signature validation error:', error)
      return false
    }
  }

  /**
   * Process incoming Twilio webhook
   */
  async processInboundWebhook(payload: TwilioWebhookPayload): Promise<UnifiedMessage | null> {
    return this.errorHandler.executeWithRecovery(
      async () => {
        // Determine channel type based on the 'From' field
        const channel = payload.From.startsWith('whatsapp:') 
          ? ChannelType.WHATSAPP 
          : ChannelType.SMS

        // Clean phone numbers (remove whatsapp: prefix if present)
        const fromNumber = payload.From.replace('whatsapp:', '')
        const toNumber = payload.To.replace('whatsapp:', '')

        // Create raw Twilio message
        const rawMessage: TwilioMessage = {
          channel,
          externalId: payload.MessageSid,
          direction: Direction.INBOUND,
          timestamp: new Date(),
          rawData: payload,
        }

        // Normalize and store the message
        const normalizedMessage = await messageService.normalizeMessage(rawMessage)
        const storedMessage = await messageService.storeMessage(normalizedMessage)

        return storedMessage
      },
      {
        operation: 'process_inbound_webhook',
        metadata: { 
          messageSid: payload.MessageSid,
          from: payload.From,
          channel: payload.From.startsWith('whatsapp:') ? 'whatsapp' : 'sms'
        }
      },
      {
        maxRetries: 2,
        retryDelay: 1000,
        fallbackFunction: async () => {
          // Log the failed webhook for manual processing
          throw ErrorFactory.createError(
            'TWILIO_WEBHOOK_FAILED',
            'Failed to process Twilio webhook after retries',
            ErrorCategory.INTEGRATION,
            ErrorSeverity.HIGH,
            'twilio_service',
            { payload }
          )
        }
      }
    ).catch((error) => {
      // Return null to indicate processing failure
      // The error has already been logged and reported by the error handler
      return null
    })
  }

  /**
   * Process message status update webhook
   */
  async processStatusUpdate(payload: TwilioWebhookPayload): Promise<void> {
    try {
      const messageStatus = this.mapTwilioStatusToMessageStatus(
        payload.MessageStatus || payload.SmsStatus
      )

      // Find the message by external ID and update status
      await this.updateMessageStatus(payload.MessageSid, messageStatus, {
        errorCode: payload.ErrorCode,
        errorMessage: payload.ErrorMessage,
      })
    } catch (error) {
      console.error('Error processing status update:', error)
    }
  }

  /**
   * Get message delivery status from Twilio
   */
  async getMessageStatus(messageSid: string): Promise<MessageStatus> {
    try {
      const message = await this.client.messages(messageSid).fetch()
      return this.mapTwilioStatusToMessageStatus(message.status)
    } catch (error) {
      console.error('Error fetching message status:', error)
      return 'failed'
    }
  }

  /**
   * Get account information (useful for trial mode detection)
   */
  async getAccountInfo() {
    try {
      const account = await this.client.api.accounts(this.config.accountSid).fetch()
      return {
        friendlyName: account.friendlyName,
        status: account.status,
        type: account.type,
        subresourceUris: account.subresourceUris,
      }
    } catch (error) {
      console.error('Error fetching account info:', error)
      return null
    }
  }

  /**
   * Get phone number information
   */
  async getPhoneNumberInfo(phoneNumber?: string) {
    try {
      const number = phoneNumber || this.config.phoneNumber
      const phoneNumbers = await this.client.incomingPhoneNumbers.list({
        phoneNumber: number,
      })

      if (phoneNumbers.length > 0) {
        const phoneNumberInfo = phoneNumbers[0]
        return {
          phoneNumber: phoneNumberInfo.phoneNumber,
          friendlyName: phoneNumberInfo.friendlyName,
          capabilities: phoneNumberInfo.capabilities,
          voiceUrl: phoneNumberInfo.voiceUrl,
          smsUrl: phoneNumberInfo.smsUrl,
        }
      }

      return null
    } catch (error) {
      console.error('Error fetching phone number info:', error)
      return null
    }
  }

  /**
   * List verified phone numbers (for trial accounts)
   */
  async getVerifiedNumbers() {
    try {
      const verifiedNumbers = await this.client.validationRequests.list()
      return verifiedNumbers.map(num => ({
        phoneNumber: num.phoneNumber,
        friendlyName: num.friendlyName,
        validationCode: num.validationCode,
      }))
    } catch (error) {
      console.error('Error fetching verified numbers:', error)
      return []
    }
  }

  /**
   * Private helper methods
   */
  private mapTwilioStatusToMessageStatus(twilioStatus?: string): MessageStatus {
    if (!twilioStatus) return 'pending'

    switch (twilioStatus.toLowerCase()) {
      case 'queued':
      case 'accepted':
        return 'pending'
      case 'sending':
      case 'sent':
        return 'sent'
      case 'delivered':
        return 'delivered'
      case 'read':
        return 'read'
      case 'failed':
      case 'undelivered':
        return 'failed'
      case 'cancelled':
        return 'cancelled'
      default:
        return 'pending'
    }
  }

  private async updateMessageStatus(
    externalId: string, 
    status: MessageStatus, 
    errorInfo?: { errorCode?: string; errorMessage?: string }
  ): Promise<void> {
    try {
      await messageService.updateMessageStatus(externalId, status, errorInfo)
    } catch (error) {
      console.error(`Failed to update message status for ${externalId}:`, error)
      // Don't throw here to avoid breaking webhook processing
    }
  }
}

// Factory function to create Twilio service instance
export function createTwilioService(): TwilioService {
  const config: TwilioConfig = {
    accountSid: process.env.TWILIO_ACCOUNT_SID!,
    authToken: process.env.TWILIO_AUTH_TOKEN!,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER!,
    webhookUrl: process.env.TWILIO_WEBHOOK_URL,
  }

  if (!config.accountSid || !config.authToken || !config.phoneNumber) {
    throw new Error('Missing required Twilio configuration')
  }

  return new TwilioService(config)
}

export const twilioService = createTwilioService()