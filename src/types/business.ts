import { z } from 'zod'

// Business tool integration types
export interface BusinessToolConfig {
  id: string
  name: string
  type: BusinessToolType
  isEnabled: boolean
  credentials: Record<string, string>
  settings: Record<string, unknown>
  lastSyncAt?: Date
  createdAt: Date
  updatedAt: Date
}

export type BusinessToolType = 'hubspot' | 'slack' | 'zapier'

// HubSpot integration types
export interface HubSpotContact {
  id: string
  properties: {
    email?: string
    firstname?: string
    lastname?: string
    phone?: string
    company?: string
    jobtitle?: string
    lifecyclestage?: string
    createdate?: string
    lastmodifieddate?: string
    [key: string]: unknown
  }
}

export interface HubSpotSyncResult {
  contactId: string
  hubspotId?: string
  action: 'created' | 'updated' | 'skipped' | 'error'
  error?: string
  timestamp: Date
}

export interface ContactSyncStatus {
  contactId: string
  hubspotId?: string
  lastSyncAt?: Date
  syncStatus: 'pending' | 'synced' | 'error' | 'conflict'
  errorMessage?: string
  conflictData?: {
    localData: Record<string, unknown>
    remoteData: Record<string, unknown>
    conflictFields: string[]
  }
}

export interface SyncConflictResolution {
  contactId: string
  fieldResolutions: Record<string, 'local' | 'remote' | 'merge'>
}

// Slack integration types
export interface SlackNotification {
  channel: string
  text: string
  attachments?: SlackAttachment[]
  username?: string
  iconEmoji?: string
}

export interface SlackAttachment {
  color?: string
  title?: string
  titleLink?: string
  text?: string
  fields?: SlackField[]
  timestamp?: number
}

export interface SlackField {
  title: string
  value: string
  short?: boolean
}

export interface SlackWebhookPayload {
  token: string
  teamId: string
  teamDomain: string
  channelId: string
  channelName: string
  userId: string
  userName: string
  command: string
  text: string
  responseUrl: string
  triggerId: string
}

// Zapier integration types
export interface ZapierWebhookPayload {
  trigger: string
  data: Record<string, unknown>
  timestamp: Date
}

export interface ZapierTriggerEvent {
  id: string
  type: ZapierTriggerType
  contactId?: string
  messageId?: string
  data: Record<string, unknown>
  timestamp: Date
}

export type ZapierTriggerType = 
  | 'contact_created'
  | 'contact_updated'
  | 'message_received'
  | 'message_sent'
  | 'note_added'
  | 'conversation_started'
  | 'conversation_closed'

// Business tool configuration schemas
export const BusinessToolConfigSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['hubspot', 'slack', 'zapier']),
  isEnabled: z.boolean().default(true),
  credentials: z.record(z.string()),
  settings: z.record(z.unknown()).default({}),
})

export const HubSpotConfigSchema = z.object({
  apiKey: z.string().min(1),
  portalId: z.string().optional(),
  syncDirection: z.enum(['bidirectional', 'to_hubspot', 'from_hubspot']).default('bidirectional'),
  syncFrequency: z.enum(['manual', 'hourly', 'daily']).default('manual'),
  fieldMappings: z.record(z.string()).optional(),
})

export const SlackConfigSchema = z.object({
  webhookUrl: z.string().url(),
  channel: z.string().default('#general'),
  username: z.string().default('Unified Inbox'),
  iconEmoji: z.string().default(':speech_balloon:'),
  notificationTypes: z.array(z.enum([
    'new_message',
    'new_contact',
    'urgent_message',
    'mention',
    'system_alert'
  ])).default(['urgent_message', 'mention']),
})

export const ZapierConfigSchema = z.object({
  webhookUrl: z.string().url(),
  triggerEvents: z.array(z.enum([
    'contact_created',
    'contact_updated',
    'message_received',
    'message_sent',
    'note_added',
    'conversation_started',
    'conversation_closed'
  ])).default(['contact_created', 'message_received']),
  includeMetadata: z.boolean().default(true),
})

export const SyncConflictResolutionSchema = z.object({
  contactId: z.string(),
  fieldResolutions: z.record(z.enum(['local', 'remote', 'merge'])),
})

// Type exports for validation
export type BusinessToolConfig_Input = z.infer<typeof BusinessToolConfigSchema>
export type HubSpotConfig = z.infer<typeof HubSpotConfigSchema>
export type SlackConfig = z.infer<typeof SlackConfigSchema>
export type ZapierConfig = z.infer<typeof ZapierConfigSchema>
export type SyncConflictResolution_Input = z.infer<typeof SyncConflictResolutionSchema>