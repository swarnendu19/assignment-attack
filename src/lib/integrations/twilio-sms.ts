import { MessageChannel, Direction, MessageStatus } from '@prisma/client';
import { Twilio } from 'twilio';
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
import { getEnvVar } from '../env';

export interface TwilioSMSCredentials {
    type: 'api_key';
    accountSid: string;
    authToken: string;
    phoneNumber: string;
}

export interface TwilioSMSSettings {
    defaultSender?: string;
    autoReply?: boolean;
    messageRetention?: number;
    enableDeliveryReceipts?: boolean;
    enableStatusCallbacks?: boolean;
}

export interface TwilioWebhookPayload {
    MessageSid: string;
    AccountSid: string;
    From: string;
    To: string;
    Body?: string;
    NumMedia?: string;
    MediaUrl0?: string;
    MediaContentType0?: string;
    MessageStatus?: string;
    SmsStatus?: string;
    SmsSid?: string;
    SmsMessageSid?: string;
    NumSegments?: string;
    Price?: string;
    PriceUnit?: string;
    ApiVersion?: string;
    [key: string]: string | undefined;
}

export class TwilioSMSIntegration extends BaseIntegration {
    private client: Twilio;
    private phoneNumber: string;

    constructor(config: IntegrationConfig) {
        super(config);

        const credentials = config.credentials as TwilioSMSCredentials;

        if (!credentials.accountSid || !credentials.authToken || !credentials.phoneNumber) {
            throw this.createError(
                'Missing required Twilio credentials: accountSid, authToken, and phoneNumber are required',
                'MISSING_CREDENTIALS'
            );
        }

        this.client = new Twilio(credentials.accountSid, credentials.authToken);
        this.phoneNumber = credentials.phoneNumber;
    }

    async send(message: OutboundMessage): Promise<SendResult> {
        try {
            this.validateOutboundMessage(message);

            const settings = this.settings as TwilioSMSSettings;
            const from = settings.defaultSender || this.phoneNumber;

            // Prepare message options
            const messageOptions: any = {
                from,
                to: message.to,
                body: message.content.text
            };

            // Add media if present
            if (message.content.media && message.content.media.length > 0) {
                messageOptions.mediaUrl = message.content.media.map(media => media.url);
            }

            // Add status callback if enabled
            if (settings.enableStatusCallbacks && this.config.webhookUrl) {
                messageOptions.statusCallback = `${this.config.webhookUrl}/status`;
            }

            // Send message via Twilio
            const twilioMessage = await this.client.messages.create(messageOptions);

            return {
                success: true,
                externalId: twilioMessage.sid,
                metadata: {
                    twilioSid: twilioMessage.sid,
                    status: twilioMessage.status,
                    direction: twilioMessage.direction,
                    price: twilioMessage.price,
                    priceUnit: twilioMessage.priceUnit,
                    numSegments: twilioMessage.numSegments
                },
                estimatedDelivery: twilioMessage.dateCreated
            };

        } catch (error: any) {
            const integrationError = this.handleTwilioError(error);
            return {
                success: false,
                error: integrationError
            };
        }
    }

    async receive(webhook: WebhookPayload): Promise<UnifiedMessage> {
        const payload = webhook.rawPayload as TwilioWebhookPayload;

        // Validate required fields
        if (!payload.MessageSid || !payload.From || !payload.To) {
            throw this.createError(
                'Invalid Twilio webhook payload: missing required fields',
                'INVALID_WEBHOOK_PAYLOAD'
            );
        }

        // Determine if this is an inbound message or status update
        const isStatusUpdate = payload.MessageStatus || payload.SmsStatus;

        if (isStatusUpdate) {
            // This is a status update, not a new message
            throw this.createError(
                'Status updates should be handled separately',
                'STATUS_UPDATE_NOT_MESSAGE'
            );
        }

        // Parse media attachments
        const media: MediaAttachment[] = [];
        const numMedia = parseInt(payload.NumMedia || '0');

        for (let i = 0; i < numMedia; i++) {
            const mediaUrl = payload[`MediaUrl${i}`];
            const mediaContentType = payload[`MediaContentType${i}`];

            if (mediaUrl && mediaContentType) {
                media.push({
                    id: `${payload.MessageSid}_media_${i}`,
                    url: mediaUrl,
                    type: this.getMediaTypeFromMimeType(mediaContentType),
                    filename: `attachment_${i}`,
                    size: 0, // Twilio doesn't provide size in webhook
                    mimeType: mediaContentType
                });
            }
        }

        // Create message content
        const content: MessageContent = {
            text: payload.Body || '',
            media: media.length > 0 ? media : undefined,
            type: media.length > 0 ? 'media' : 'text'
        };

        // Generate thread ID (contact-based)
        const threadId = this.generateThreadId(payload.From);

        // Create unified message
        const unifiedMessage: UnifiedMessage = {
            id: this.generateExternalId(),
            contactId: '', // Will be resolved by the message service
            channel: MessageChannel.SMS,
            direction: Direction.INBOUND,
            content,
            metadata: {
                channelId: 'twilio_sms',
                externalId: payload.MessageSid,
                channelSpecific: {
                    accountSid: payload.AccountSid,
                    from: payload.From,
                    to: payload.To,
                    numSegments: payload.NumSegments,
                    price: payload.Price,
                    priceUnit: payload.PriceUnit,
                    apiVersion: payload.ApiVersion
                }
            },
            status: MessageStatus.DELIVERED,
            threadId,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        return unifiedMessage;
    }

    validateWebhook(payload: any, signature?: string): boolean {
        if (!signature || !this.config.webhookSecret) {
            return false;
        }

        // Twilio uses X-Twilio-Signature header
        return this.verifyTwilioSignature(payload, signature, this.config.webhookSecret);
    }

    getCapabilities(): ChannelCapabilities {
        return {
            supportsMedia: true,
            supportedMediaTypes: [
                'image/jpeg',
                'image/png',
                'image/gif',
                'image/webp',
                'video/mp4',
                'video/3gpp',
                'audio/mpeg',
                'audio/ogg',
                'audio/wav',
                'application/pdf',
                'text/plain',
                'text/csv',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            ],
            maxMessageLength: 1600, // SMS limit
            supportsRichText: false,
            supportsDeliveryReceipts: true,
            supportsReadReceipts: false,
            supportsScheduling: false, // Twilio doesn't support native scheduling
            supportsTemplates: false,
            rateLimits: {
                messagesPerSecond: 1,
                messagesPerMinute: 60,
                messagesPerHour: 3600,
                messagesPerDay: 86400
            }
        };
    }

    async healthCheck(): Promise<boolean> {
        try {
            // Try to fetch account information to verify credentials
            await this.client.api.accounts(this.credentials.accountSid).fetch();
            return true;
        } catch (error) {
            return false;
        }
    }

    // Private helper methods
    private verifyTwilioSignature(payload: any, signature: string, authToken: string): boolean {
        try {
            // Twilio signature validation
            const url = this.config.webhookUrl || '';

            // Create the signature string
            let signatureString = url;

            // Sort parameters and append to signature string
            const sortedKeys = Object.keys(payload).sort();
            for (const key of sortedKeys) {
                signatureString += key + payload[key];
            }

            // Create HMAC SHA1 hash
            const expectedSignature = crypto
                .createHmac('sha1', authToken)
                .update(signatureString, 'utf8')
                .digest('base64');

            return signature === expectedSignature;
        } catch (error) {
            return false;
        }
    }

    private handleTwilioError(error: any): IntegrationError {
        // Map Twilio error codes to integration errors
        const errorCode = error.code || error.status || 'UNKNOWN_ERROR';
        const errorMessage = error.message || 'Unknown Twilio error';

        // Determine if error is retryable
        const retryableErrors = [20429, 20003, 21610, 30001, 30002, 30003, 30004, 30005];
        const isRetryable = retryableErrors.includes(errorCode) || this.isRetryableError(error);

        return this.createError(
            `Twilio SMS error: ${errorMessage}`,
            `TWILIO_${errorCode}`,
            isRetryable,
            {
                originalError: error,
                twilioCode: errorCode,
                moreInfo: error.moreInfo
            }
        );
    }

    private getMediaTypeFromMimeType(mimeType: string): 'image' | 'video' | 'audio' | 'document' {
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('video/')) return 'video';
        if (mimeType.startsWith('audio/')) return 'audio';
        return 'document';
    }

    private generateThreadId(phoneNumber: string): string {
        // Remove any non-digit characters and create a consistent thread ID
        const cleanNumber = phoneNumber.replace(/\D/g, '');
        return `sms_${cleanNumber}`;
    }

    // Static factory method
    static create(config?: Partial<IntegrationConfig>): TwilioSMSIntegration {
        const defaultConfig: IntegrationConfig = {
            channel: MessageChannel.SMS,
            enabled: true,
            credentials: {
                type: 'api_key',
                accountSid: getEnvVar('TWILIO_ACCOUNT_SID') || '',
                authToken: getEnvVar('TWILIO_AUTH_TOKEN') || '',
                phoneNumber: getEnvVar('TWILIO_PHONE_NUMBER') || ''
            } as TwilioSMSCredentials,
            settings: {
                enableDeliveryReceipts: true,
                enableStatusCallbacks: true,
                messageRetention: 90
            } as TwilioSMSSettings,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...config
        };

        return new TwilioSMSIntegration(defaultConfig);
    }
}