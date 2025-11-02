import { ContactEventType } from '@prisma/client'
import { z } from 'zod'

// Core contact interfaces
export interface Contact {
  id: string
  name?: string
  phone?: string
  email?: string
  socialHandles: SocialHandle[]
  tags: string[]
  customFields: Record<string, unknown>
  lastContactAt?: Date
  createdAt: Date
  updatedAt: Date
  teamId: string
}

export interface SocialHandle {
  platform: 'twitter' | 'facebook' | 'linkedin' | 'instagram'
  handle: string
  url?: string
}

export interface ContactEvent {
  id: string
  contactId: string
  eventType: ContactEventType
  eventData?: Record<string, unknown>
  timestamp: Date
  userId?: string
}

export interface ContactHistory {
  contact: Contact
  events: ContactEvent[]
  messageCount: number
  lastMessageAt?: Date
  totalInteractions: number
}

// Contact creation and update interfaces
export interface CreateContactInput {
  name?: string
  phone?: string
  email?: string
  socialHandles?: SocialHandle[]
  tags?: string[]
  customFields?: Record<string, unknown>
  teamId: string
}

export interface UpdateContactInput {
  name?: string
  phone?: string
  email?: string
  socialHandles?: SocialHandle[]
  tags?: string[]
  customFields?: Record<string, unknown>
}

// Contact search and filtering
export interface ContactSearchQuery {
  query?: string
  tags?: string[]
  hasPhone?: boolean
  hasEmail?: boolean
  createdAfter?: Date
  createdBefore?: Date
  lastContactAfter?: Date
  lastContactBefore?: Date
  limit?: number
  offset?: number
  sortBy?: 'name' | 'createdAt' | 'lastContactAt' | 'messageCount'
  sortOrder?: 'asc' | 'desc'
}

export interface ContactSearchResult {
  contacts: Contact[]
  total: number
  hasMore: boolean
}

// Duplicate detection and merging
export interface DuplicateMatch {
  contact: Contact
  matchScore: number
  matchReasons: DuplicateMatchReason[]
}

export interface DuplicateMatchReason {
  field: 'email' | 'phone' | 'name' | 'socialHandle'
  similarity: number
  value1: string
  value2: string
}

export interface ContactMergeRequest {
  primaryContactId: string
  duplicateContactIds: string[]
  fieldResolutions: Record<string, 'primary' | 'duplicate' | 'merge'>
}

export interface ContactMergeResult {
  mergedContact: Contact
  mergedContactIds: string[]
  conflictsResolved: number
}

// Contact timeline and activity
export interface ContactTimeline {
  contactId: string
  items: TimelineItem[]
  totalItems: number
}

export interface TimelineItem {
  id: string
  type: 'message' | 'note' | 'event' | 'tag_added' | 'tag_removed' | 'merged'
  timestamp: Date
  title: string
  description?: string
  metadata?: Record<string, unknown>
  userId?: string
  userName?: string
}

// Validation schemas
export const SocialHandleSchema = z.object({
  platform: z.enum(['twitter', 'facebook', 'linkedin', 'instagram']),
  handle: z.string().min(1),
  url: z.string().url().optional(),
})

export const CreateContactSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/).optional(),
  email: z.string().email().optional(),
  socialHandles: z.array(SocialHandleSchema).optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.unknown()).optional(),
  teamId: z.string(),
}).refine(
  (data) => data.name || data.phone || data.email,
  {
    message: "At least one of name, phone, or email must be provided",
    path: ["name"],
  }
)

export const UpdateContactSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/).optional(),
  email: z.string().email().optional(),
  socialHandles: z.array(SocialHandleSchema).optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.unknown()).optional(),
})

export const ContactSearchQuerySchema = z.object({
  query: z.string().optional(),
  tags: z.array(z.string()).optional(),
  hasPhone: z.boolean().optional(),
  hasEmail: z.boolean().optional(),
  createdAfter: z.date().optional(),
  createdBefore: z.date().optional(),
  lastContactAfter: z.date().optional(),
  lastContactBefore: z.date().optional(),
  limit: z.number().positive().max(100).default(20),
  offset: z.number().nonnegative().default(0),
  sortBy: z.enum(['name', 'createdAt', 'lastContactAt', 'messageCount']).default('lastContactAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export const ContactMergeRequestSchema = z.object({
  primaryContactId: z.string(),
  duplicateContactIds: z.array(z.string()).min(1),
  fieldResolutions: z.record(z.enum(['primary', 'duplicate', 'merge'])),
})

// Type exports for validation
export type CreateContactInput_Validated = z.infer<typeof CreateContactSchema>
export type UpdateContactInput_Validated = z.infer<typeof UpdateContactSchema>
export type ContactSearchQuery_Validated = z.infer<typeof ContactSearchQuerySchema>
export type ContactMergeRequest_Validated = z.infer<typeof ContactMergeRequestSchema>