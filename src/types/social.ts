import { ChannelType, Direction } from '@prisma/client'
import { z } from 'zod'

// Social media platform types
export type SocialPlatform = 'twitter' | 'facebook'

// Twitter API v2 interfaces
export interface TwitterConfig {
  apiKey: string
  apiSecret: string
  accessToken: string
  accessTokenSecret: string
  bearerToken: string
  webhookUrl?: string
}

export interface TwitterWebhookPayload {
  for_user_id: string
  direct_message_events?: TwitterDirectMessageEvent[]
  direct_message_indicate_typing_events?: TwitterTypingEvent[]
  users?: Record<string, TwitterUser>
  apps?: Record<string, TwitterApp>
}

export interface TwitterDirectMessageEvent {
  type: 'MessageCreate'
  id: string
  created_timestamp: string
  message_create: {
    target: {
      recipient_id: string
    }
    sender_id: string
    message_data: {
      text: string
      entities?: {
        urls?: Array<{
          url: string
          expanded_url: string
          display_url: string
          indices: number[]
        }>
        media?: Array<{
          id: string
          media_url: string
          media_url_https: string
          type: string
          sizes: Record<string, any>
        }>
      }
      attachment?: {
        type: 'media'
        media: {
          id: string
          media_url: string
          media_url_https: string
          type: string
        }
      }
    }
  }
}

export interface TwitterTypingEvent {
  created_timestamp: string
  sender_id: string
  target: {
    recipient_id: string
  }
}

export interface TwitterUser {
  id: string
  name: string
  screen_name: string
  profile_image_url: string
  profile_image_url_https: string
}

export interface TwitterApp {
  id: string
  name: string
  url: string
}

// Facebook Graph API interfaces
export interface FacebookConfig {
  appId: string
  appSecret: string
  accessToken: string
  pageId: string
  verifyToken: string
  webhookUrl?: string
}

export interface FacebookWebhookPayload {
  object: 'page'
  entry: FacebookWebhookEntry[]
}

export interface FacebookWebhookEntry {
  id: string
  time: number
  messaging?: FacebookMessagingEvent[]
  changes?: FacebookChangeEvent[]
}

export interface FacebookMessagingEvent {
  sender: {
    id: string
  }
  recipient: {
    id: string
  }
  timestamp: number
  message?: {
    mid: string
    text?: string
    attachments?: Array<{
      type: 'image' | 'video' | 'audio' | 'file'
      payload: {
        url: string
        sticker_id?: number
      }
    }>
    quick_reply?: {
      payload: string
    }
  }
  delivery?: {
    mids: string[]
    watermark: number
  }
  read?: {
    watermark: number
  }
  postback?: {
    title: string
    payload: string
    referral?: {
      ref: string
      source: string
      type: string
    }
  }
}

export interface FacebookChangeEvent {
  field: string
  value: any
}

// Unified social media message interfaces
export interface SocialMediaMessage {
  id: string
  platform: SocialPlatform
  externalId: string
  senderId: string
  recipientId: string
  text: string
  mediaUrls?: string[]
  timestamp: Date
  direction: Direction
  metadata: SocialMediaMetadata
}

export interface SocialMediaMetadata {
  platform: SocialPlatform
  messageId: string
  senderId: string
  recipientId: string
  senderHandle?: string
  recipientHandle?: string
  mediaAttachments?: Array<{
    type: string
    url: string
    thumbnailUrl?: string
  }>
  entities?: {
    urls?: Array<{
      url: string
      expandedUrl: string
      displayUrl: string
    }>
    mentions?: Array<{
      username: string
      id: string
    }>
    hashtags?: string[]
  }
}

// Social media service interfaces
export interface SocialMediaService {
  platform: SocialPlatform
  sendMessage(recipientId: string, text: string, mediaUrls?: string[]): Promise<SocialSendResult>
  validateWebhook(payload: string, signature: string, timestamp?: string): boolean
  processInboundWebhook(payload: any): Promise<SocialMediaMessage | null>
  getUserInfo(userId: string): Promise<SocialUserInfo | null>
  getMessageStatus(messageId: string): Promise<SocialMessageStatus>
}

export interface SocialSendResult {
  success: boolean
  messageId?: string
  error?: string
  platform: SocialPlatform
}

export interface SocialUserInfo {
  id: string
  name: string
  username?: string
  profileImageUrl?: string
  platform: SocialPlatform
}

export interface SocialMessageStatus {
  messageId: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: Date
  platform: SocialPlatform
}

// Rate limiting interfaces
export interface SocialRateLimit {
  platform: SocialPlatform
  endpoint: string
  limit: number
  remaining: number
  resetTime: Date
}

export interface SocialRateLimiter {
  checkLimit(platform: SocialPlatform, endpoint: string): Promise<boolean>
  updateLimit(platform: SocialPlatform, endpoint: string, headers: Record<string, string>): void
  getRemainingRequests(platform: SocialPlatform, endpoint: string): number
  getResetTime(platform: SocialPlatform, endpoint: string): Date | null
}

// OAuth interfaces
export interface SocialOAuthConfig {
  platform: SocialPlatform
  clientId: string
  clientSecret: string
  redirectUri: string
  scopes: string[]
}

export interface SocialOAuthToken {
  accessToken: string
  refreshToken?: string
  expiresAt?: Date
  tokenType: string
  scope?: string
  platform: SocialPlatform
  userId: string
}

// Zod validation schemas
export const TwitterDirectMessageEventSchema = z.object({
  type: z.literal('MessageCreate'),
  id: z.string(),
  created_timestamp: z.string(),
  message_create: z.object({
    target: z.object({
      recipient_id: z.string(),
    }),
    sender_id: z.string(),
    message_data: z.object({
      text: z.string(),
      entities: z.object({
        urls: z.array(z.object({
          url: z.string(),
          expanded_url: z.string(),
          display_url: z.string(),
          indices: z.array(z.number()),
        })).optional(),
        media: z.array(z.object({
          id: z.string(),
          media_url: z.string(),
          media_url_https: z.string(),
          type: z.string(),
          sizes: z.record(z.any()),
        })).optional(),
      }).optional(),
      attachment: z.object({
        type: z.literal('media'),
        media: z.object({
          id: z.string(),
          media_url: z.string(),
          media_url_https: z.string(),
          type: z.string(),
        }),
      }).optional(),
    }),
  }),
})

export const FacebookMessagingEventSchema = z.object({
  sender: z.object({
    id: z.string(),
  }),
  recipient: z.object({
    id: z.string(),
  }),
  timestamp: z.number(),
  message: z.object({
    mid: z.string(),
    text: z.string().optional(),
    attachments: z.array(z.object({
      type: z.enum(['image', 'video', 'audio', 'file']),
      payload: z.object({
        url: z.string(),
        sticker_id: z.number().optional(),
      }),
    })).optional(),
    quick_reply: z.object({
      payload: z.string(),
    }).optional(),
  }).optional(),
  delivery: z.object({
    mids: z.array(z.string()),
    watermark: z.number(),
  }).optional(),
  read: z.object({
    watermark: z.number(),
  }).optional(),
  postback: z.object({
    title: z.string(),
    payload: z.string(),
    referral: z.object({
      ref: z.string(),
      source: z.string(),
      type: z.string(),
    }).optional(),
  }).optional(),
})

export const SocialMediaMessageSchema = z.object({
  id: z.string(),
  platform: z.enum(['twitter', 'facebook']),
  externalId: z.string(),
  senderId: z.string(),
  recipientId: z.string(),
  text: z.string(),
  mediaUrls: z.array(z.string()).optional(),
  timestamp: z.date(),
  direction: z.nativeEnum(Direction),
  metadata: z.record(z.unknown()),
})

// Type exports for validation
export type TwitterDirectMessageEventInput = z.infer<typeof TwitterDirectMessageEventSchema>
export type FacebookMessagingEventInput = z.infer<typeof FacebookMessagingEventSchema>
export type SocialMediaMessageInput = z.infer<typeof SocialMediaMessageSchema>