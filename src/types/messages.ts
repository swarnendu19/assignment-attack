import { ChannelType, Direction, ContentType } from '@prisma/client'
import { z } from 'zod'

// Core message interfaces
export interface UnifiedMessage {
  id: string
  contactId: string | null
  conversationId: string
  channel: ChannelType
  direction: Direction
  content: MessageContent
  status: MessageStatus
  timestamp: Date
  metadata: ChannelMetadata
  externalId?: string
  isRead: boolean
  userId: string
}

export interface MessageContent {
  text?: string
  html?: string
  attachments?: Attachment[]
  metadata?: {
    subject?: string // Email
    mediaType?: string // WhatsApp/MMS
    replyToId?: string // Threading
    threadId?: string // Conversation threading
  }
}

export interface Attachment {
  id: string
  filename: string
  contentType: string
  size: number
  url: string
  thumbnailUrl?: string
}

export interface ChannelMetadata {
  [key: string]: unknown
  // Channel-specific metadata
  twilioSid?: string // Twilio message SID
  whatsappStatus?: string // WhatsApp delivery status
  emailMessageId?: string // Email message ID
  socialPostId?: string // Social media post ID
}

export type MessageStatus = 
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'cancelled'

// Raw message interfaces for different channels
export interface RawChannelMessage {
  channel: ChannelType
  externalId: string
  direction: Direction
  timestamp: Date
  rawData: unknown
}

export interface TwilioMessage extends RawChannelMessage {
  channel: ChannelType.SMS | ChannelType.WHATSAPP
  rawData: {
    MessageSid: string
    From: string
    To: string
    Body: string
    MediaUrl0?: string
    MediaContentType0?: string
    MessageStatus?: string
    NumMedia?: string
  }
}

export interface EmailMessage extends RawChannelMessage {
  channel: ChannelType.EMAIL
  rawData: {
    messageId: string
    from: string
    to: string
    subject: string
    text?: string
    html?: string
    attachments?: Array<{
      filename: string
      contentType: string
      content: Buffer
    }>
  }
}

export interface SocialMessage extends RawChannelMessage {
  channel: ChannelType.TWITTER | ChannelType.FACEBOOK
  rawData: {
    id: string
    senderId: string
    recipientId: string
    text: string
    mediaUrls?: string[]
    timestamp: string
  }
}

// Search and filtering interfaces
export interface MessageSearchQuery {
  query?: string
  contactId?: string
  channel?: ChannelType
  direction?: Direction
  status?: MessageStatus
  dateFrom?: Date
  dateTo?: Date
  hasAttachments?: boolean
  isRead?: boolean
  limit?: number
  offset?: number
}

export interface MessageSearchResult {
  messages: UnifiedMessage[]
  total: number
  hasMore: boolean
}

// Conversation threading interfaces
export interface ConversationThread {
  id: string
  contactId: string | null
  channel: ChannelType
  title?: string
  lastMessageAt: Date
  messageCount: number
  unreadCount: number
  messages: UnifiedMessage[]
  participants: string[]
}

export interface ThreadingOptions {
  groupByContact: boolean
  groupBySubject: boolean // For email
  timeWindowMinutes: number // Group messages within time window
}

// Zod validation schemas
export const AttachmentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  contentType: z.string(),
  size: z.number().positive(),
  url: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
})

export const MessageContentSchema = z.object({
  text: z.string().optional(),
  html: z.string().optional(),
  attachments: z.array(AttachmentSchema).optional(),
  metadata: z.object({
    subject: z.string().optional(),
    mediaType: z.string().optional(),
    replyToId: z.string().optional(),
    threadId: z.string().optional(),
  }).optional(),
})

export const UnifiedMessageSchema = z.object({
  id: z.string(),
  contactId: z.string().nullable(),
  conversationId: z.string(),
  channel: z.nativeEnum(ChannelType),
  direction: z.nativeEnum(Direction),
  content: MessageContentSchema,
  status: z.enum(['pending', 'sent', 'delivered', 'read', 'failed', 'cancelled']),
  timestamp: z.date(),
  metadata: z.record(z.unknown()),
  externalId: z.string().optional(),
  isRead: z.boolean(),
  userId: z.string(),
})

export const MessageSearchQuerySchema = z.object({
  query: z.string().optional(),
  contactId: z.string().optional(),
  channel: z.nativeEnum(ChannelType).optional(),
  direction: z.nativeEnum(Direction).optional(),
  status: z.enum(['pending', 'sent', 'delivered', 'read', 'failed', 'cancelled']).optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  hasAttachments: z.boolean().optional(),
  isRead: z.boolean().optional(),
  limit: z.number().positive().max(100).default(20),
  offset: z.number().nonnegative().default(0),
})

// Type exports for validation
export type MessageContentInput = z.infer<typeof MessageContentSchema>
export type UnifiedMessageInput = z.infer<typeof UnifiedMessageSchema>
export type MessageSearchQueryInput = z.infer<typeof MessageSearchQuerySchema>