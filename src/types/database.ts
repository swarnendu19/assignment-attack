import { z } from 'zod'
import { 
  ChannelType, 
  Direction, 
  ContentType, 
  UserRole, 
  ContactEventType, 
  ScheduledMessageStatus,
  ConversationStatus,
  Priority
} from '@prisma/client'

// Core database model schemas
export const TeamSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  settings: z.record(z.unknown()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  avatar: z.string().url().nullable(),
  password: z.string().nullable(),
  role: z.nativeEnum(UserRole),
  isActive: z.boolean(),
  lastActiveAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  teamId: z.string(),
})

export const ContactSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().email().nullable(),
  socialHandles: z.record(z.unknown()).nullable(),
  tags: z.array(z.string()),
  customFields: z.record(z.unknown()).nullable(),
  lastContactAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  teamId: z.string(),
})

export const NoteSchema = z.object({
  id: z.string(),
  content: z.string().min(1),
  isPrivate: z.boolean(),
  mentions: z.record(z.unknown()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  contactId: z.string(),
  userId: z.string(),
})

export const ContactEventSchema = z.object({
  id: z.string(),
  eventType: z.nativeEnum(ContactEventType),
  eventData: z.record(z.unknown()).nullable(),
  timestamp: z.date(),
  contactId: z.string(),
  userId: z.string().nullable(),
})

export const ScheduledMessageSchema = z.object({
  id: z.string(),
  channel: z.nativeEnum(ChannelType),
  content: z.record(z.unknown()),
  scheduledFor: z.date(),
  recurrence: z.record(z.unknown()).nullable(),
  status: z.nativeEnum(ScheduledMessageStatus),
  createdAt: z.date(),
  updatedAt: z.date(),
  contactId: z.string(),
  userId: z.string(),
})

export const ChannelSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  type: z.nativeEnum(ChannelType),
  isActive: z.boolean(),
  config: z.record(z.unknown()).nullable(),
  credentials: z.record(z.unknown()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  userId: z.string(),
})

export const ConversationSchema = z.object({
  id: z.string(),
  externalId: z.string().nullable(),
  title: z.string().nullable(),
  status: z.nativeEnum(ConversationStatus),
  priority: z.nativeEnum(Priority),
  isRead: z.boolean(),
  lastMessageAt: z.date().nullable(),
  participantCount: z.number().nonnegative(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  channelId: z.string(),
  userId: z.string(),
  teamId: z.string(),
  contactId: z.string().nullable(),
})

export const MessageSchema = z.object({
  id: z.string(),
  externalId: z.string().nullable(),
  content: z.string(),
  contentType: z.nativeEnum(ContentType),
  direction: z.nativeEnum(Direction),
  isRead: z.boolean(),
  metadata: z.record(z.unknown()).nullable(),
  sentAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
  conversationId: z.string(),
  userId: z.string(),
})

// Input validation schemas for creating/updating records
export const CreateTeamSchema = z.object({
  name: z.string().min(1).max(100),
  settings: z.record(z.unknown()).optional(),
})

export const UpdateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  settings: z.record(z.unknown()).optional(),
})

export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100).optional(),
  avatar: z.string().url().optional(),
  password: z.string().min(8).optional(),
  role: z.nativeEnum(UserRole).default(UserRole.EDITOR),
  teamId: z.string(),
})

export const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatar: z.string().url().optional(),
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional(),
})

export const CreateNoteSchema = z.object({
  content: z.string().min(1).max(10000),
  isPrivate: z.boolean().default(false),
  mentions: z.record(z.unknown()).optional(),
  contactId: z.string(),
})

export const UpdateNoteSchema = z.object({
  content: z.string().min(1).max(10000).optional(),
  isPrivate: z.boolean().optional(),
  mentions: z.record(z.unknown()).optional(),
})

export const CreateScheduledMessageSchema = z.object({
  channel: z.nativeEnum(ChannelType),
  content: z.record(z.unknown()),
  scheduledFor: z.date().refine(date => date > new Date(), {
    message: "Scheduled time must be in the future",
  }),
  recurrence: z.record(z.unknown()).optional(),
  contactId: z.string(),
})

export const UpdateScheduledMessageSchema = z.object({
  content: z.record(z.unknown()).optional(),
  scheduledFor: z.date().refine(date => date > new Date(), {
    message: "Scheduled time must be in the future",
  }).optional(),
  recurrence: z.record(z.unknown()).optional(),
  status: z.nativeEnum(ScheduledMessageStatus).optional(),
})

export const CreateChannelSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.nativeEnum(ChannelType),
  config: z.record(z.unknown()).optional(),
  credentials: z.record(z.unknown()).optional(),
})

export const UpdateChannelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
  credentials: z.record(z.unknown()).optional(),
})

export const CreateConversationSchema = z.object({
  externalId: z.string().optional(),
  title: z.string().max(200).optional(),
  status: z.nativeEnum(ConversationStatus).default(ConversationStatus.ACTIVE),
  priority: z.nativeEnum(Priority).default(Priority.NORMAL),
  metadata: z.record(z.unknown()).optional(),
  channelId: z.string(),
  contactId: z.string().optional(),
})

export const UpdateConversationSchema = z.object({
  title: z.string().max(200).optional(),
  status: z.nativeEnum(ConversationStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  isRead: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const CreateMessageSchema = z.object({
  externalId: z.string().optional(),
  content: z.string().min(1),
  contentType: z.nativeEnum(ContentType).default(ContentType.TEXT),
  direction: z.nativeEnum(Direction),
  metadata: z.record(z.unknown()).optional(),
  sentAt: z.date().default(() => new Date()),
  conversationId: z.string(),
})

export const UpdateMessageSchema = z.object({
  content: z.string().min(1).optional(),
  contentType: z.nativeEnum(ContentType).optional(),
  isRead: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
})

// Recurrence pattern schema for scheduled messages
export const RecurrencePatternSchema = z.object({
  type: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  interval: z.number().positive().default(1),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional(), // 0 = Sunday, 6 = Saturday
  dayOfMonth: z.number().min(1).max(31).optional(),
  endDate: z.date().optional(),
  maxOccurrences: z.number().positive().optional(),
})

// Message template schema
export const MessageTemplateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  content: z.string().min(1),
  variables: z.array(z.string()).default([]),
  channel: z.nativeEnum(ChannelType),
  category: z.string().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
  userId: z.string(),
  teamId: z.string(),
})

export const CreateMessageTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  content: z.string().min(1).max(5000),
  variables: z.array(z.string()).default([]),
  channel: z.nativeEnum(ChannelType),
  category: z.string().max(50).optional(),
})

export const UpdateMessageTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  content: z.string().min(1).max(5000).optional(),
  variables: z.array(z.string()).optional(),
  category: z.string().max(50).optional(),
  isActive: z.boolean().optional(),
})

// Webhook validation schemas
export const TwilioWebhookSchema = z.object({
  MessageSid: z.string(),
  AccountSid: z.string(),
  From: z.string(),
  To: z.string(),
  Body: z.string().optional(),
  MessageStatus: z.string().optional(),
  NumMedia: z.string().optional(),
  MediaUrl0: z.string().url().optional(),
  MediaContentType0: z.string().optional(),
})

export const EmailWebhookSchema = z.object({
  messageId: z.string(),
  from: z.string().email(),
  to: z.string().email(),
  subject: z.string(),
  text: z.string().optional(),
  html: z.string().optional(),
  timestamp: z.string().datetime(),
})

// Type exports
export type Team = z.infer<typeof TeamSchema>
export type User = z.infer<typeof UserSchema>
export type Contact = z.infer<typeof ContactSchema>
export type Note = z.infer<typeof NoteSchema>
export type ContactEvent = z.infer<typeof ContactEventSchema>
export type ScheduledMessage = z.infer<typeof ScheduledMessageSchema>
export type Channel = z.infer<typeof ChannelSchema>
export type Conversation = z.infer<typeof ConversationSchema>
export type Message = z.infer<typeof MessageSchema>
export type MessageTemplate = z.infer<typeof MessageTemplateSchema>
export type RecurrencePattern = z.infer<typeof RecurrencePatternSchema>

// Input type exports
export type CreateTeamInput = z.infer<typeof CreateTeamSchema>
export type UpdateTeamInput = z.infer<typeof UpdateTeamSchema>
export type CreateUserInput = z.infer<typeof CreateUserSchema>
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>
export type CreateNoteInput = z.infer<typeof CreateNoteSchema>
export type UpdateNoteInput = z.infer<typeof UpdateNoteSchema>
export type CreateScheduledMessageInput = z.infer<typeof CreateScheduledMessageSchema>
export type UpdateScheduledMessageInput = z.infer<typeof UpdateScheduledMessageSchema>
export type CreateChannelInput = z.infer<typeof CreateChannelSchema>
export type UpdateChannelInput = z.infer<typeof UpdateChannelSchema>
export type CreateConversationInput = z.infer<typeof CreateConversationSchema>
export type UpdateConversationInput = z.infer<typeof UpdateConversationSchema>
export type CreateMessageInput = z.infer<typeof CreateMessageSchema>
export type UpdateMessageInput = z.infer<typeof UpdateMessageSchema>
export type CreateMessageTemplateInput = z.infer<typeof CreateMessageTemplateSchema>
export type UpdateMessageTemplateInput = z.infer<typeof UpdateMessageTemplateSchema>

// Webhook type exports
export type TwilioWebhookPayload = z.infer<typeof TwilioWebhookSchema>
export type EmailWebhookPayload = z.infer<typeof EmailWebhookSchema>