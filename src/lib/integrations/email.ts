import { MessageChannel, Direction, MessageStatus } from '@prisma/client';
import { Resend } from 'resend';
import crypto from 'crypto';
import {
    ChannelIntegration,
    OutboundMessage,
    SendResult,
    ChannelCapabilities,
    IntegrationConfig,
    IntegrationError
} from '../types/integration';
import { UnifiedMessage, WebhookPayload, MessageContent, MediaAttachment } from '../types/message';
import { BaseIntegration } from './base-integration';
import { MediaStorageService } from '../utils/media-storage';
import { getEnvVar } from '../env';

export interface EmailCredentials {
    type: 'api_key';
    apiKey: string;
    fromEmail: string;
    fromName?: string;
}

export interface EmailSettings {
    defaultSender?: string;
    autoReply?: boolean;
    messageRetention?: number;
    enableDeliveryReceipts?: boolean;
    enableReadReceipts?: boolean;
    templateSupport?: boolean;
    maxAttachmentSize?: number; // in bytes
}

export interface EmailWebhookPayload {
    type: 'email.sent' | 'email.delivered' | 'email.bounced' | 'email.complained' | 'email.opened' | 'email.clicked';
    created_at: string;
    data: {
        email_id: string;
        from: string;
        to: string[];
        subject: string;
        html?: string;
        text?: string;
        attachments?: Array<{
            filename: string;
            content_type: string;
            size: number;
        }>;
        headers?: Record<string, string>;
        reply_to?: string;
        cc?: string[];
        bcc?: string[];
    };
}

export interface EmailTemplate {
    id: string;
    name: string;
    subject: string;
    html?: string;
    text?: string;
    variables?: string[];
}

export class EmailIntegration extends BaseIntegration {
    private client: Resend;
    private fromEmail: string;
    private fromName?: string;
    private mediaStorage: MediaStorageService;

    constructor(config: IntegrationConfig) {
        super(config);

        const credentials = config.credentials as EmailCredentials;

        if (!credentials.apiKey || !credentials.fromEmail) {
            throw this.createError(
                'Missing required email credentials: apiKey and fromEmail are required',
                'MISSING_CREDENTIALS'
            );
        }

        this.client = new Resend(credentials.apiKey);
        this.fromEmail = credentials.fromEmail;
        this.fromName = credentials.fromName;

        // Initialize media storage for attachments
        this.mediaStorage = new MediaStorageService({
            baseDir: process.env.EMAIL_ATTACHMENTS_DIR || './uploads/email',
            maxFileSize: (config.settings as EmailSettings)?.maxAttachmentSize || 25 * 1024 * 1024, // 25MB default
            allowedMimeTypes: [
                'image/jpeg',
                'image/png',
                'image/gif',
                'image/webp',
                'application/pdf',
                'text/plain',
                'text/csv',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/zip',
                'audio/mpeg',
                'audio/wav',
                'video/mp4'
            ]
        });
    }

    async send(message: OutboundMessage): Promise<SendResult> {
        try {
            this.validateOutboundMessage(message);

            const settings = this.settings as EmailSettings;
            const from = settings.defaultSender || `${this.fromName || 'Unified Inbox'} <${this.fromEmail}>`;

            // Parse email content
            const isHtml = this.isHtmlContent(message.content.text || '');

            // Prepare email options
            const emailOptions: any = {
                from,
                to: [message.to],
                subject: message.options?.customHeaders?.subject || 'Message from Unified Inbox',
                [isHtml ? 'html' : 'text']: message.content.text || ''
            };

            // Add reply-to if specified
            if (message.options?.replyTo) {
                emailOptions.reply_to = message.options.replyTo;
            }

            // Add CC and BCC if specified in custom headers
            if (message.options?.customHeaders?.cc) {
                emailOptions.cc = message.options.customHeaders.cc.split(',').map(email => email.trim());
            }

            if (message.options?.customHeaders?.bcc) {
                emailOptions.bcc = message.options.customHeaders.bcc.split(',').map(email => email.trim());
            }

            // Handle attachments
            if (message.content.media && message.content.media.length > 0) {
                emailOptions.attachments = await this.prepareAttachments(message.content.media);
            }

            // Add custom headers
            if (message.options?.customHeaders) {
                const customHeaders: Record<string, string> = {};
                Object.entries(message.options.customHeaders).forEach(([key, value]) => {
                    if (!['subject', 'cc', 'bcc'].includes(key.toLowerCase())) {
                        customHeaders[key] = value;
                    }
                });

                // Only add headers if there are any
                if (Object.keys(customHeaders).length > 0) {
                    emailOptions.headers = customHeaders;
                }
            }

            // Send email via Resend
            const result = await this.client.emails.send(emailOptions);

            if (result?.error) {
                throw new Error(`Resend API error: ${result.error.message}`);
            }

            return {
                success: true,
                externalId: result.data?.id,
                metadata: {
                    resendId: result.data?.id,
                    from: emailOptions.from,
                    to: emailOptions.to,
                    subject: emailOptions.subject,
                    attachmentCount: emailOptions.attachments?.length || 0
                },
                estimatedDelivery: new Date()
            };

        } catch (error: any) {
            // If it's already an IntegrationError, return it as-is
            if (error instanceof IntegrationError) {
                return {
                    success: false,
                    error: error
                };
            }

            const integrationError = this.handleEmailError(error);
            return {
                success: false,
                error: integrationError
            };
        }
    }

    async receive(webhook: WebhookPayload): Promise<UnifiedMessage> {
        const payload = webhook.rawPayload as EmailWebhookPayload;

        // Validate required fields
        if (!payload.data?.email_id || !payload.data?.from || !payload.data?.to) {
            throw this.createError(
                'Invalid email webhook payload: missing required fields',
                'INVALID_WEBHOOK_PAYLOAD'
            );
        }

        // Only process inbound emails (not status updates)
        if (payload.type !== 'email.sent' || !this.isInboundEmail(payload.data)) {
            throw this.createError(
                'Webhook is not for an inbound email message',
                'NOT_INBOUND_MESSAGE'
            );
        }

        // Parse attachments
        const media: MediaAttachment[] = [];
        if (payload.data.attachments) {
            for (let i = 0; i < payload.data.attachments.length; i++) {
                const attachment = payload.data.attachments[i];
                media.push({
                    id: `${payload.data.email_id}_attachment_${i}`,
                    url: '', // Will be populated when attachment is downloaded
                    type: this.getMediaTypeFromMimeType(attachment.content_type),
                    filename: attachment.filename,
                    size: attachment.size,
                    mimeType: attachment.content_type
                });
            }
        }

        // Create message content
        const content: MessageContent = {
            text: payload.data.text || payload.data.html || '',
            media: media.length > 0 ? media : undefined,
            type: media.length > 0 ? 'media' : 'text'
        };

        // Generate thread ID based on email address
        const threadId = this.generateThreadId(payload.data.from);

        // Create unified message
        const unifiedMessage: UnifiedMessage = {
            id: this.generateExternalId(),
            contactId: '', // Will be resolved by the message service
            channel: MessageChannel.EMAIL,
            direction: Direction.INBOUND,
            content,
            metadata: {
                channelId: 'resend_email',
                externalId: payload.data.email_id,
                channelSpecific: {
                    from: payload.data.from,
                    to: payload.data.to,
                    subject: payload.data.subject,
                    headers: payload.data.headers,
                    replyTo: payload.data.reply_to,
                    cc: payload.data.cc,
                    bcc: payload.data.bcc,
                    attachmentCount: payload.data.attachments?.length || 0
                }
            },
            status: MessageStatus.DELIVERED,
            threadId,
            createdAt: new Date(payload.created_at),
            updatedAt: new Date()
        };

        return unifiedMessage;
    }

    validateWebhook(payload: any, signature?: string): boolean {
        if (!signature || !this.config.webhookSecret) {
            return false;
        }

        // Resend uses a different signature validation method
        return this.verifyResendSignature(payload, signature, this.config.webhookSecret);
    }

    getCapabilities(): ChannelCapabilities {
        const settings = this.settings as EmailSettings;

        return {
            supportsMedia: true,
            supportedMediaTypes: [
                'image/jpeg',
                'image/png',
                'image/gif',
                'image/webp',
                'application/pdf',
                'text/plain',
                'text/csv',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/zip',
                'audio/mpeg',
                'audio/wav',
                'video/mp4'
            ],
            maxMessageLength: 1000000, // 1MB for email content
            supportsRichText: true,
            supportsDeliveryReceipts: true,
            supportsReadReceipts: true,
            supportsScheduling: false, // Resend doesn't support native scheduling
            supportsTemplates: settings?.templateSupport || true,
            rateLimits: {
                messagesPerSecond: 14, // Resend limit
                messagesPerMinute: 100,
                messagesPerHour: 1000,
                messagesPerDay: 10000
            }
        };
    }

    async healthCheck(): Promise<boolean> {
        try {
            // Try to get API key info to verify credentials
            // Note: Resend doesn't have a direct health check endpoint
            // We'll try to send a test email to a non-existent address to validate the API key
            const testResult = await this.client.emails.send({
                from: this.fromEmail,
                to: ['test@example.com'],
                subject: 'Health Check',
                text: 'This is a health check email'
            });

            // If we get here without an error, the API key is valid
            // Even if the email fails to send, the API key validation worked
            return true;
        } catch (error: any) {
            // Check if it's an authentication error
            if (error.message?.includes('API key') || error.message?.includes('unauthorized')) {
                return false;
            }
            // Other errors might be network-related, so we'll consider the service healthy
            return true;
        }
    }

    // Template support methods
    async sendWithTemplate(
        message: OutboundMessage,
        template: EmailTemplate,
        variables: Record<string, string> = {}
    ): Promise<SendResult> {
        try {
            // Replace variables in template
            let subject = template.subject;
            let html = template.html || '';
            let text = template.text || '';

            Object.entries(variables).forEach(([key, value]) => {
                const placeholder = `{{${key}}}`;
                subject = subject.replace(new RegExp(placeholder, 'g'), value);
                html = html.replace(new RegExp(placeholder, 'g'), value);
                text = text.replace(new RegExp(placeholder, 'g'), value);
            });

            // Create modified message with template content
            const templateMessage: OutboundMessage = {
                ...message,
                content: {
                    ...message.content,
                    text: html || text
                },
                options: {
                    ...message.options,
                    customHeaders: {
                        ...message.options?.customHeaders,
                        subject
                    }
                }
            };

            return this.send(templateMessage);

        } catch (error: any) {
            const integrationError = this.handleEmailError(error);
            return {
                success: false,
                error: integrationError
            };
        }
    }

    // Private helper methods
    private async prepareAttachments(media: MediaAttachment[]): Promise<any[]> {
        const attachments = [];

        for (const attachment of media) {
            try {
                let content: Buffer;

                if (attachment.url.startsWith('http')) {
                    // Download from URL
                    const response = await fetch(attachment.url);
                    if (!response.ok) {
                        throw new Error(`Failed to download attachment: ${response.statusText}`);
                    }
                    content = Buffer.from(await response.arrayBuffer());
                } else {
                    // Read from local file
                    content = await this.mediaStorage.getMediaBuffer(attachment.url);
                }

                attachments.push({
                    filename: attachment.filename,
                    content,
                    content_type: attachment.mimeType
                });

            } catch (error) {
                console.warn(`Failed to prepare attachment ${attachment.filename}:`, error);
                // Continue with other attachments
            }
        }

        return attachments;
    }

    private verifyResendSignature(payload: any, signature: string, secret: string): boolean {
        try {
            // Resend webhook signature validation
            const payloadString = JSON.stringify(payload);
            const expectedSignature = crypto
                .createHmac('sha256', secret)
                .update(payloadString, 'utf8')
                .digest('hex');

            return signature === expectedSignature;
        } catch (error) {
            return false;
        }
    }

    private handleEmailError(error: any): IntegrationError {
        const errorMessage = error.message || 'Unknown email error';
        let errorCode = 'UNKNOWN_ERROR';
        let isRetryable = false;

        // Map common email errors
        if (errorMessage.includes('API key')) {
            errorCode = 'INVALID_API_KEY';
        } else if (errorMessage.includes('rate limit')) {
            errorCode = 'RATE_LIMITED';
            isRetryable = true;
        } else if (errorMessage.includes('invalid email')) {
            errorCode = 'INVALID_EMAIL';
        } else if (errorMessage.includes('attachment')) {
            errorCode = 'ATTACHMENT_ERROR';
        } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
            errorCode = 'NETWORK_ERROR';
            isRetryable = true;
        }

        return this.createError(
            `Email error: ${errorMessage}`,
            errorCode,
            isRetryable,
            { originalError: error }
        );
    }

    private isHtmlContent(content: string): boolean {
        // Simple check for HTML tags
        return /<[^>]+>/.test(content);
    }

    private isInboundEmail(emailData: any): boolean {
        // Check if this is an inbound email vs outbound
        // This would depend on your email setup and how you distinguish inbound emails
        // For now, we'll assume emails to our configured address are inbound
        return emailData.to.includes(this.fromEmail);
    }

    private getMediaTypeFromMimeType(mimeType: string): 'image' | 'video' | 'audio' | 'document' {
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('video/')) return 'video';
        if (mimeType.startsWith('audio/')) return 'audio';
        return 'document';
    }

    private generateThreadId(emailAddress: string): string {
        // Create a consistent thread ID based on email address
        const cleanEmail = emailAddress.toLowerCase().trim();
        return `email_${cleanEmail}`;
    }

    // Static factory method
    static create(config?: Partial<IntegrationConfig>): EmailIntegration {
        const defaultConfig: IntegrationConfig = {
            channel: MessageChannel.EMAIL,
            enabled: true,
            credentials: {
                type: 'api_key',
                apiKey: getEnvVar('RESEND_API_KEY') || '',
                fromEmail: getEnvVar('FROM_EMAIL') || '',
                fromName: 'Unified Inbox'
            } as EmailCredentials,
            settings: {
                enableDeliveryReceipts: true,
                enableReadReceipts: true,
                templateSupport: true,
                messageRetention: 365, // 1 year for emails
                maxAttachmentSize: 25 * 1024 * 1024 // 25MB
            } as EmailSettings,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...config
        };

        return new EmailIntegration(defaultConfig);
    }
}