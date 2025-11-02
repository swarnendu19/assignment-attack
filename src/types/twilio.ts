import { z } from 'zod'

// Twilio account types
export interface TwilioAccountInfo {
  friendlyName: string
  status: string
  type: 'Trial' | 'Full'
  subresourceUris: Record<string, string>
}

export interface TwilioPhoneNumber {
  phoneNumber: string
  friendlyName: string
  capabilities: {
    voice?: boolean
    sms?: boolean
    mms?: boolean
    fax?: boolean
  }
  voiceUrl?: string
  smsUrl?: string
}

export interface TwilioVerifiedNumber {
  phoneNumber: string
  friendlyName: string
  validationCode?: string
}

// Twilio webhook payload types
export interface TwilioInboundWebhook {
  MessageSid: string
  AccountSid: string
  From: string
  To: string
  Body: string
  NumMedia: string
  MediaUrl0?: string
  MediaContentType0?: string
  MediaUrl1?: string
  MediaContentType1?: string
  MediaUrl2?: string
  MediaContentType2?: string
  MediaUrl3?: string
  MediaContentType3?: string
  MediaUrl4?: string
  MediaContentType4?: string
  MediaUrl5?: string
  MediaContentType5?: string
  MediaUrl6?: string
  MediaContentType6?: string
  MediaUrl7?: string
  MediaContentType7?: string
  MediaUrl8?: string
  MediaContentType8?: string
  MediaUrl9?: string
  MediaContentType9?: string
}

export interface TwilioStatusWebhook {
  MessageSid: string
  MessageStatus: string
  ErrorCode?: string
  ErrorMessage?: string
  SmsSid?: string
  SmsStatus?: string
  AccountSid: string
  From: string
  To: string
}

// Twilio message status mapping
export type TwilioMessageStatus = 
  | 'accepted'
  | 'queued' 
  | 'sending'
  | 'sent'
  | 'receiving'
  | 'received'
  | 'delivered'
  | 'undelivered'
  | 'failed'
  | 'read'
  | 'cancelled'

// Twilio error codes
export enum TwilioErrorCode {
  INVALID_PHONE_NUMBER = '21211',
  UNVERIFIED_TRIAL_NUMBER = '21608',
  INSUFFICIENT_FUNDS = '21606',
  MESSAGE_TOO_LONG = '21605',
  INVALID_MEDIA_URL = '21623',
  MEDIA_TOO_LARGE = '21622',
  UNSUPPORTED_MEDIA_TYPE = '21624',
  RATE_LIMIT_EXCEEDED = '20429',
  ACCOUNT_SUSPENDED = '20003',
  INVALID_CREDENTIALS = '20003',
}

// Validation schemas
export const TwilioSendMessageSchema = z.object({
  to: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
  body: z.string().min(1).max(1600, 'Message too long'),
  mediaUrl: z.array(z.string().url()).max(10, 'Too many media attachments').optional(),
  from: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format').optional(),
})

export const TwilioWebhookSchema = z.object({
  MessageSid: z.string(),
  AccountSid: z.string(),
  From: z.string(),
  To: z.string(),
  Body: z.string().optional(),
  NumMedia: z.string().optional(),
  MessageStatus: z.string().optional(),
  SmsStatus: z.string().optional(),
  ErrorCode: z.string().optional(),
  ErrorMessage: z.string().optional(),
})

// Type exports
export type TwilioSendMessageInput = z.infer<typeof TwilioSendMessageSchema>
export type TwilioWebhookInput = z.infer<typeof TwilioWebhookSchema>

// Twilio configuration interface
export interface TwilioConfiguration {
  accountSid: string
  authToken: string
  phoneNumber: string
  webhookUrl?: string
  statusCallbackUrl?: string
  applicationSid?: string
}

// Twilio service response types
export interface TwilioSendResponse {
  success: boolean
  messageId?: string
  status?: TwilioMessageStatus
  error?: string
  errorCode?: TwilioErrorCode
}

export interface TwilioWebhookResponse {
  success: boolean
  messageId?: string
  processed: 'inbound_message' | 'status_update' | 'unknown'
  error?: string
}

// Media handling types
export interface TwilioMediaInfo {
  url: string
  contentType: string
  size?: number
  filename?: string
}

export interface TwilioMessageMedia {
  mediaUrls: TwilioMediaInfo[]
  mediaCount: number
}

// Trial account limitations
export interface TwilioTrialLimitations {
  canOnlySendToVerifiedNumbers: boolean
  requiresPhoneNumberVerification: boolean
  maxDailyMessages?: number
  restrictedFeatures: string[]
  upgradeInstructions: string
}

// Twilio capabilities
export interface TwilioCapabilities {
  sms: boolean
  mms: boolean
  voice: boolean
  whatsapp: boolean
  fax: boolean
}

// Webhook validation
export interface TwilioWebhookValidation {
  isValid: boolean
  signature?: string
  url?: string
  payload?: string
  error?: string
}

// Rate limiting for Twilio API
export interface TwilioRateLimit {
  limit: number
  remaining: number
  resetTime: Date
  retryAfter?: number
}

// Twilio service health check
export interface TwilioServiceHealth {
  isHealthy: boolean
  accountStatus: string
  phoneNumberStatus: string
  lastSuccessfulMessage?: Date
  lastError?: string
  errorCount: number
}