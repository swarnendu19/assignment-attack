import { Resend } from 'resend'
import { ChannelType, Direction } from '@prisma/client'
import { 
  EmailMessage, 
  UnifiedMessage, 
  MessageStatus,
  MessageContent,
  ChannelMetadata 
} from '@/types/messages'
import { messageService } from './messageService'

export interface EmailConfig {
  apiKey: string
  fromEmail: string
  webhookSecret?: string
}

export interface EmailWebhookPayload {
  type: 'email.sent' | 'email.delivered' | 'email.delivery_delayed' | 'email.complained' | 'email.bounced' | 'email.opened' | 'email.clicked'
  created_at: string
  data: {
    email_id: string
    from: string
    to: string[]
    subject: string
    created_at: string
    last_event?: string
    bounce?: {
      type: string
      message: string
    }
    complaint?: {
      type: string
      message: string
    }
  }
}

export interface InboundEmailWebhookPayload {
  type: 'email.received'
  created_at: string
  data: {
    message_id: string
    from: string
    to: string[]
    subject: string
    text?: string
    html?: string
    reply_to?: string
    in_reply_to?: string
    references?: string
    attachments?: Array<{
      filename: string
      content_type: string
      content: string // base64 encoded
      size: number
    }>
  }
}

export interface EmailSendRequest {
  to: string | string[]
  subject: string
  text?: string
  html?: string
  replyTo?: string
  attachments?: Array<{
    filename: string
    content: Buffer | string
    contentType?: string
  }>
  tags?: Array<{
    name: string
    value: string
  }>
}

export interface EmailSendResult {
  success: boolean
  messageId?: string
  error?: string
}

export class EmailService {
  private client: Resend
  private config: EmailConfig

  constructor(config: EmailConfig) {
    this.config = config
    this.client = new Resend(config.apiKey)
  }

  /**
   * Send email via Resend
   */
  async sendEmail(request: EmailSendRequest): Promise<EmailSendResult> {
    try {
      const emailData: any = {
        from: this.config.fromEmail,
        to: Array.isArray(request.to) ? request.to : [request.to],
        subject: request.subject,
        text: request.text,
        html: request.html,
        reply_to: request.replyTo,
        tags: request.tags,
      }

      // Handle attachments
      if (request.attachments && request.attachments.length > 0) {
        emailData.attachments = request.attachments.map(att => ({
          filename: att.filename,
          content: att.content,
          content_type: att.contentType || 'application/octet-stream',
        }))
      }

      const result = await this.client.emails.send(emailData)

      if (result.error) {
        return {
          success: false,
          error: result.error.message,
        }
      }

      return {
        success: true,
        messageId: result.data?.id,
      }
    } catch (error: any) {
      console.error('Email send error:', error)
      return {
        success: false,
        error: error.message || 'Failed to send email',
      }
    }
  }

  /**
   * Validate email webhook signature
   */
  validateWebhookSignature(
    payload: string,
    signature: string,
    timestamp: string
  ): boolean {
    try {
      if (!this.config.webhookSecret) {
        console.warn('No webhook secret configured for email service')
        return true // Allow if no secret is configured
      }

      // Resend uses HMAC-SHA256 for webhook signatures
      const crypto = require('crypto')
      const expectedSignature = crypto
        .createHmac('sha256', this.config.webhookSecret)
        .update(timestamp + payload)
        .digest('hex')

      return signature === expectedSignature
    } catch (error) {
      console.error('Email webhook signature validation error:', error)
      return false
    }
  }

  /**
   * Process incoming email webhook (for inbound emails)
   */
  async processInboundWebhook(payload: InboundEmailWebhookPayload): Promise<UnifiedMessage | null> {
    try {
      // Create raw email message
      const rawMessage: EmailMessage = {
        channel: ChannelType.EMAIL,
        externalId: payload.data.message_id,
        direction: Direction.INBOUND,
        timestamp: new Date(payload.created_at),
        rawData: {
          messageId: payload.data.message_id,
          from: payload.data.from,
          to: payload.data.to[0], // Take first recipient
          subject: payload.data.subject,
          text: payload.data.text,
          html: payload.data.html,
          attachments: payload.data.attachments?.map(att => ({
            filename: att.filename,
            contentType: att.content_type,
            content: Buffer.from(att.content, 'base64'),
          })),
        },
      }

      // Normalize and store the message
      const normalizedMessage = await messageService.normalizeMessage(rawMessage)
      const storedMessage = await messageService.storeMessage(normalizedMessage)

      return storedMessage
    } catch (error) {
      console.error('Error processing email webhook:', error)
      return null
    }
  }

  /**
   * Process email status update webhook
   */
  async processStatusUpdate(payload: EmailWebhookPayload): Promise<void> {
    try {
      const messageStatus = this.mapEmailEventToMessageStatus(payload.type)
      
      // Find the message by external ID and update status
      await this.updateMessageStatus(payload.data.email_id, messageStatus, {
        eventType: payload.type,
        bounce: payload.data.bounce,
        complaint: payload.data.complaint,
      })
    } catch (error) {
      console.error('Error processing email status update:', error)
    }
  }

  /**
   * Get email delivery status
   */
  async getEmailStatus(emailId: string): Promise<MessageStatus> {
    try {
      // Resend doesn't have a direct API to get email status
      // Status updates come through webhooks
      // For now, return a default status
      return 'sent'
    } catch (error) {
      console.error('Error fetching email status:', error)
      return 'failed'
    }
  }

  /**
   * Extract email thread information
   */
  extractThreadInfo(emailData: any): {
    threadId?: string
    replyToId?: string
    isReply: boolean
  } {
    const inReplyTo = emailData.in_reply_to
    const references = emailData.references
    const subject = emailData.subject

    // Check if this is a reply based on subject or headers
    const isReply = !!(
      inReplyTo || 
      references || 
      (subject && /^(Re:|Fwd:)/i.test(subject))
    )

    // Generate thread ID from references or in-reply-to
    let threadId: string | undefined
    if (references) {
      // Use the first message ID in references as thread ID
      const refs = references.split(/\s+/)
      threadId = refs[0]?.replace(/[<>]/g, '')
    } else if (inReplyTo) {
      threadId = inReplyTo.replace(/[<>]/g, '')
    }

    return {
      threadId,
      replyToId: inReplyTo?.replace(/[<>]/g, ''),
      isReply,
    }
  }

  /**
   * Parse email addresses from various formats
   */
  parseEmailAddress(emailString: string): {
    email: string
    name?: string
  } {
    // Handle formats like "Name <email@domain.com>" or just "email@domain.com"
    const match = emailString.match(/^(?:"?([^"]*)"?\s)?(?:<?([^>]+)>?)$/)
    
    if (match) {
      const [, name, email] = match
      return {
        email: email.trim(),
        name: name?.trim() || undefined,
      }
    }

    return { email: emailString.trim() }
  }

  /**
   * Generate email reply headers
   */
  generateReplyHeaders(originalMessage: UnifiedMessage): {
    replyTo?: string
    inReplyTo?: string
    references?: string
  } {
    const metadata = originalMessage.metadata
    const messageId = metadata.emailMessageId

    if (!messageId) return {}

    return {
      inReplyTo: `<${messageId}>`,
      references: metadata.references 
        ? `${metadata.references} <${messageId}>`
        : `<${messageId}>`,
    }
  }

  /**
   * Private helper methods
   */
  private mapEmailEventToMessageStatus(eventType: string): MessageStatus {
    switch (eventType) {
      case 'email.sent':
        return 'sent'
      case 'email.delivered':
        return 'delivered'
      case 'email.opened':
        return 'read'
      case 'email.bounced':
      case 'email.complained':
        return 'failed'
      case 'email.delivery_delayed':
        return 'pending'
      default:
        return 'sent'
    }
  }

  private async updateMessageStatus(
    externalId: string, 
    status: MessageStatus, 
    errorInfo?: { 
      eventType?: string
      bounce?: any
      complaint?: any 
    }
  ): Promise<void> {
    try {
      await messageService.updateMessageStatus(externalId, status, {
        errorCode: errorInfo?.bounce?.type || errorInfo?.complaint?.type,
        errorMessage: errorInfo?.bounce?.message || errorInfo?.complaint?.message,
      })
    } catch (error) {
      console.error(`Failed to update email message status for ${externalId}:`, error)
      // Don't throw here to avoid breaking webhook processing
    }
  }
}

// Factory function to create email service instance
export function createEmailService(): EmailService {
  const config: EmailConfig = {
    apiKey: process.env.RESEND_API_KEY!,
    fromEmail: process.env.FROM_EMAIL || 'noreply@yourdomain.com',
    webhookSecret: process.env.RESEND_WEBHOOK_SECRET,
  }

  if (!config.apiKey) {
    throw new Error('Missing required RESEND_API_KEY configuration')
  }

  return new EmailService(config)
}

export const emailService = createEmailService()