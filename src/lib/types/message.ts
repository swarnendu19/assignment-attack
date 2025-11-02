import { MessageChannel, Direction, MessageStatus } from '@prisma/client';

// Core unified message interface
export interface UnifiedMessage {
    id: string;
    contactId: string;
    userId?: string;
    channel: MessageChannel;
    direction: Direction;
    content: MessageContent;
    metadata: ChannelMetadata;
    status: MessageStatus;
    threadId: string;
    scheduledAt?: Date;
    sentAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

// Message content structure
export interface MessageContent {
    text?: string;
    media?: MediaAttachment[];
    type: MessageContentType;
    subject?: string; // For email
    templateId?: string; // For templated messages
    variables?: Record<string, any>; // For template variables
}

export type MessageContentType = 'text' | 'media' | 'template' | 'system';

// Media attachment interface
export interface MediaAttachment {
    id: string;
    url: string;
    type: MediaType;
    filename: string;
    size: number;
    mimeType: string;
    thumbnailUrl?: string;
}

export type MediaType = 'image' | 'video' | 'audio' | 'document';

// Channel-specific metadata
export interface ChannelMetadata {
    channelId: string;
    externalId: string;
    channelSpecific: Record<string, any>;
    deliveryInfo?: DeliveryInfo;
}

// Delivery information
export interface DeliveryInfo {
    deliveredAt?: Date;
    readAt?: Date;
    failureReason?: string;
    retryCount?: number;
    lastRetryAt?: Date;
}

// Message creation input
export interface CreateMessageInput {
    contactId: string;
    userId?: string;
    channel: MessageChannel;
    direction: Direction;
    content: MessageContent;
    metadata?: Partial<ChannelMetadata>;
    scheduledAt?: Date;
}

// Message update input
export interface UpdateMessageInput {
    content?: Partial<MessageContent>;
    status?: MessageStatus;
    metadata?: Partial<ChannelMetadata>;
    sentAt?: Date;
}

// Message query filters
export interface MessageFilters {
    contactId?: string;
    userId?: string;
    channel?: MessageChannel;
    direction?: Direction;
    status?: MessageStatus;
    threadId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    searchText?: string;
}

// Message query options
export interface MessageQueryOptions {
    limit?: number;
    offset?: number;
    orderBy?: 'createdAt' | 'sentAt' | 'updatedAt';
    orderDirection?: 'asc' | 'desc';
    includeContact?: boolean;
    includeUser?: boolean;
}

// Thread information
export interface MessageThread {
    threadId: string;
    contactId: string;
    channel: MessageChannel;
    messageCount: number;
    lastMessageAt: Date;
    unreadCount: number;
    participants: string[]; // User IDs
}

// Message normalization result
export interface NormalizationResult {
    success: boolean;
    message?: UnifiedMessage;
    error?: string;
    warnings?: string[];
}

// Webhook payload interface for normalization
export interface WebhookPayload {
    channel: MessageChannel;
    rawPayload: any;
    signature?: string;
    timestamp: Date;
}

// Thread ID generation options
export interface ThreadIdOptions {
    contactId: string;
    channel: MessageChannel;
    groupId?: string; // For group conversations
}