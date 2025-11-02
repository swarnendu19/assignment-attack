import { MessageChannel } from '@prisma/client';
import {
    ChannelIntegration,
    OutboundMessage,
    SendResult,
    ChannelCapabilities,
    IntegrationConfig,
    IntegrationError,
    WebhookValidationResult
} from '../types/integration';
import { UnifiedMessage, WebhookPayload } from '../types/message';

export abstract class BaseIntegration implements ChannelIntegration {
    protected config: IntegrationConfig;
    protected channel: MessageChannel;

    constructor(config: IntegrationConfig) {
        this.config = config;
        this.channel = config.channel;
    }

    // Abstract methods that must be implemented by concrete integrations
    abstract send(message: OutboundMessage): Promise<SendResult>;
    abstract receive(webhook: WebhookPayload): Promise<UnifiedMessage>;
    abstract getCapabilities(): ChannelCapabilities;

    // Common implementation for channel type
    getChannelType(): MessageChannel {
        return this.channel;
    }

    // Base webhook validation - can be overridden by specific integrations
    validateWebhook(payload: any, signature?: string): boolean {
        if (!this.config.webhookSecret) {
            // If no webhook secret is configured, skip validation
            return true;
        }

        if (!signature) {
            return false;
        }

        return this.verifySignature(payload, signature, this.config.webhookSecret);
    }

    // Protected helper methods
    protected verifySignature(payload: any, signature: string, secret: string): boolean {
        // Default implementation - should be overridden by specific integrations
        // that have their own signature verification logic
        return true;
    }

    protected createError(
        message: string,
        code: string,
        retryable: boolean = false,
        details?: any
    ): IntegrationError {
        return new IntegrationError(message, code, this.channel, retryable, details);
    }

    protected validateOutboundMessage(message: OutboundMessage): void {
        if (!message.to) {
            throw this.createError('Recipient is required', 'MISSING_RECIPIENT');
        }

        if (!message.content || (!message.content.text && !message.content.media?.length)) {
            throw this.createError('Message content is required', 'MISSING_CONTENT');
        }

        const capabilities = this.getCapabilities();

        // Validate message length
        if (message.content.text && message.content.text.length > capabilities.maxMessageLength) {
            throw this.createError(
                `Message exceeds maximum length of ${capabilities.maxMessageLength} characters`,
                'MESSAGE_TOO_LONG'
            );
        }

        // Validate media support
        if (message.content.media?.length && !capabilities.supportsMedia) {
            throw this.createError(
                'Media attachments are not supported by this channel',
                'MEDIA_NOT_SUPPORTED'
            );
        }

        // Validate media types
        if (message.content.media?.length) {
            for (const media of message.content.media) {
                if (!capabilities.supportedMediaTypes.includes(media.mimeType)) {
                    throw this.createError(
                        `Media type ${media.mimeType} is not supported`,
                        'UNSUPPORTED_MEDIA_TYPE'
                    );
                }
            }
        }
    }

    protected generateExternalId(): string {
        return `${this.channel.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    protected isRetryableError(error: any): boolean {
        // Common retryable error patterns
        const retryableCodes = [
            'NETWORK_ERROR',
            'TIMEOUT',
            'RATE_LIMITED',
            'SERVICE_UNAVAILABLE',
            'TEMPORARY_FAILURE'
        ];

        if (error instanceof IntegrationError) {
            return error.retryable;
        }

        // Check for common HTTP status codes that are retryable
        if (error.status) {
            const retryableStatuses = [408, 429, 500, 502, 503, 504];
            return retryableStatuses.includes(error.status);
        }

        return false;
    }

    // Health check method
    async healthCheck(): Promise<boolean> {
        try {
            // Default implementation - can be overridden
            return this.config.enabled;
        } catch (error) {
            return false;
        }
    }

    // Configuration getters
    get isEnabled(): boolean {
        return this.config.enabled;
    }

    get webhookUrl(): string | undefined {
        return this.config.webhookUrl;
    }

    get credentials(): any {
        return this.config.credentials;
    }

    get settings(): any {
        return this.config.settings;
    }
}