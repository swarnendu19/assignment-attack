import { MessageChannel } from '@prisma/client';
import { UnifiedMessage, MessageContent, WebhookPayload } from './message';

// Core integration interfaces
export interface ChannelIntegration {
    send(message: OutboundMessage): Promise<SendResult>;
    receive(webhook: WebhookPayload): Promise<UnifiedMessage>;
    validateWebhook(payload: any, signature?: string): boolean;
    getCapabilities(): ChannelCapabilities;
    getChannelType(): MessageChannel;
}

// Outbound message for sending
export interface OutboundMessage {
    contactId: string;
    to: string; // Phone number, email, or handle
    content: MessageContent;
    metadata?: Record<string, any>;
    options?: SendOptions;
}

// Send options for different channels
export interface SendOptions {
    priority?: 'low' | 'normal' | 'high';
    deliveryReceipt?: boolean;
    readReceipt?: boolean;
    expiresAt?: Date;
    replyTo?: string;
    customHeaders?: Record<string, string>;
}

// Result of sending a message
export interface SendResult {
    success: boolean;
    externalId?: string;
    error?: IntegrationError;
    metadata?: Record<string, any>;
    estimatedDelivery?: Date;
}

// Channel capabilities
export interface ChannelCapabilities {
    supportsMedia: boolean;
    supportedMediaTypes: string[];
    maxMessageLength: number;
    supportsRichText: boolean;
    supportsDeliveryReceipts: boolean;
    supportsReadReceipts: boolean;
    supportsScheduling: boolean;
    supportsTemplates: boolean;
    rateLimits: RateLimits;
}

// Rate limiting information
export interface RateLimits {
    messagesPerSecond: number;
    messagesPerMinute: number;
    messagesPerHour: number;
    messagesPerDay: number;
}

// Integration configuration
export interface IntegrationConfig {
    channel: MessageChannel;
    enabled: boolean;
    credentials: ChannelCredentials;
    settings: ChannelSettings;
    webhookUrl?: string;
    webhookSecret?: string;
    createdAt: Date;
    updatedAt: Date;
}

// Base credentials interface
export interface ChannelCredentials {
    type: 'api_key' | 'oauth' | 'basic_auth' | 'custom';
    [key: string]: any;
}

// Channel-specific settings
export interface ChannelSettings {
    defaultSender?: string;
    autoReply?: boolean;
    messageRetention?: number; // days
    [key: string]: any;
}

// Integration errors
export class IntegrationError extends Error {
    constructor(
        message: string,
        public code: string,
        public channel: MessageChannel,
        public retryable: boolean = false,
        public details?: any
    ) {
        super(message);
        this.name = 'IntegrationError';
    }
}

// Webhook validation result
export interface WebhookValidationResult {
    valid: boolean;
    error?: string;
    payload?: any;
}

// Integration health status
export interface IntegrationHealth {
    channel: MessageChannel;
    status: 'healthy' | 'degraded' | 'down';
    lastCheck: Date;
    responseTime?: number;
    errorRate?: number;
    details?: string;
}

// Factory configuration
export interface FactoryConfig {
    integrations: Map<MessageChannel, IntegrationConfig>;
    defaultRetryAttempts: number;
    defaultTimeout: number;
    webhookValidationEnabled: boolean;
}