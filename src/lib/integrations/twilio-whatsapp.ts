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

export interface TwilioWhatsAppCredentials {
    type: 'api_key';
    accountSid: string;
    authToken: string;
    phoneNumber: string; // WhatsApp Business number or sandbox number
    isSandbox?: boolean;
}

export interface TwilioWhatsAppSettings {
    defaultSender?: string;
    autoReply?: boolean;
    messageRetention?: number;
    enableDeliveryReceipts?: boolean;
    enableStatusCallbacks?: boolean;
    sandboxMode?: boolean;
    templateNamespace?: string;
}

export interface WhatsAppWebhookPayload {
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
    ProfileName?: string;
    WaId?: string;
    ButtonText?: string;
    ButtonPayload?: string;
    ListId?: string;
    ListTitle?: string;
    ListDescription?: string;
    Latitude?: string;
    Longitude?: string;
    Address?: string;
    [key: string]: string | undefined;
}

export class TwilioWhatsAppIntegration extends BaseIntegration {
    private client: Twilio;
    private phoneNumber: string;
    private isSandbox: boolean;

    constructor(config: IntegrationConfig) {
        super(config);

        const credentials = config.credentials as TwilioWhatsAppCredentials;

        if (!credentials.accountSid || !credentials.authToken || !credentials.phoneNumber) {
            throw this.createError(
                'Missing required Twilio WhatsApp credentials: accountSid, authToken, and phoneNumber are required',
                'MISSING_CREDENTIALS'
            );
        }

        this.client = new Twilio(credentials.accountSid, credentials.authToken);
        this.phoneNumber = credentials.phoneNumber;
        this.isSandbox = credentials.isSandbox || false;
    }

    async send(message: OutboundMessage): Promise<SendResult> {
        try {
            this.validateOutboundMessage(message);

            const settings = this.settings as TwilioWhatsAppSettings;
            const from = this.formatWhatsAppNumber(settings.defaultSender || this.phoneNumber);
            const to = this.formatWhatsAppNumber(message.to);

            // Prepare message options
            const messageOptions: any = {
                from,
                to,
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

            // Handle template messages if templateId is provided
            if (message.content.templateId) {
                messageOptions.contentSid = message.content.templateId;
                if (message.content.variables) {
                    messageOptions.contentVariables = JSON.stringify(message.content.variables);
                }
            }

            // Send message via Twilio WhatsApp API
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
                    numSegments: twilioMessage.numSegments,
                    whatsappFrom: from,
                    whatsappTo: to
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
        const payload = webhook.rawPayload as WhatsAppWebhookPayload;

        // Validate required fields
        if (!payload.MessageSid || !payload.From || !payload.To) {
            throw this.createError(
                'Invalid Twilio WhatsApp webhook payload: missing required fields',
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
                    filename: `whatsapp_attachment_${i}`,
                    size: 0, // Twilio doesn't provide size in webhook
                    mimeType: mediaContentType
                });
            }
        }

        // Handle interactive message responses
        let messageText = payload.Body || '';
        let messageType: 'text' | 'media' | 'template' | 'system' = 'text';

        if (payload.ButtonText && payload.ButtonPayload) {
            messageText = `Button: ${payload.ButtonText}`;
            messageType = 'system';
        } else if (payload.ListId && payload.ListTitle) {
            messageText = `List Selection: ${payload.ListTitle}`;
            messageType = 'system';
        } else if (payload.Latitude && payload.Longitude) {
            messageText = `Location: ${payload.Address || `${payload.Latitude}, ${payload.Longitude}`}`;
            messageType = 'system';
        } else if (media.length > 0) {
            messageType = 'media';
        }

        // Create message content
        const content: MessageContent = {
            text: messageText,
            media: media.length > 0 ? media : undefined,
            type: messageType
        };

        // Generate thread ID (contact-based, WhatsApp uses WaId when available)
        const contactIdentifier = payload.WaId || payload.From;
        const threadId = this.generateThreadId(contactIdentifier);

        // Create unified message
        const unifiedMessage: UnifiedMessage = {
            id: this.generateExternalId(),
            contactId: '', // Will be resolved by the message service
            channel: MessageChannel.WHATSAPP,
            direction: Direction.INBOUND,
            content,
            metadata: {
                channelId: 'twilio_whatsapp',
                externalId: payload.MessageSid,
                channelSpecific: {
                    accountSid: payload.AccountSid,
                    from: payload.From,
                    to: payload.To,
                    waId: payload.WaId,
                    profileName: payload.ProfileName,
                    buttonText: payload.ButtonText,
                    buttonPayload: payload.ButtonPayload,
                    listId: payload.ListId,
                    listTitle: payload.ListTitle,
                    listDescription: payload.ListDescription,
                    latitude: payload.Latitude,
                    longitude: payload.Longitude,
                    address: payload.Address,
                    isSandbox: this.isSandbox
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
                'image/webp',
                'video/mp4',
                'video/3gpp',
                'audio/aac',
                'audio/amr',
                'audio/mpeg',
                'audio/ogg',
                'application/pdf',
                'application/vnd.ms-powerpoint',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'text/plain',
                'text/csv'
            ],
            maxMessageLength: 4096, // WhatsApp limit
            supportsRichText: false,
            supportsDeliveryReceipts: true,
            supportsReadReceipts: true,
            supportsScheduling: false, // Twilio doesn't support native scheduling
            supportsTemplates: true, // WhatsApp supports message templates
            rateLimits: {
                messagesPerSecond: 10, // Higher than SMS
                messagesPerMinute: 600,
                messagesPerHour: 36000,
                messagesPerDay: 864000
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
    private formatWhatsAppNumber(phoneNumber: string): string {
        // WhatsApp numbers need to be in the format whatsapp:+1234567890
        const cleanNumber = phoneNumber.replace(/\D/g, '');

        if (this.isSandbox) {
            return `whatsapp:+14155238886`; // Twilio WhatsApp Sandbox number
        }

        // Ensure the number starts with + and country code
        if (!phoneNumber.startsWith('whatsapp:')) {
            if (phoneNumber.startsWith('+')) {
                return `whatsapp:${phoneNumber}`;
            } else {
                return `whatsapp:+${cleanNumber}`;
            }
        }

        return phoneNumber;
    }

    private verifyTwilioSignature(payload: any, signature: string, authToken: string): boolean {
        try {
            // Twilio signature validation (same as SMS)
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
        const errorMessage = error.message || 'Unknown Twilio WhatsApp error';

        // Determine if error is retryable
        const retryableErrors = [20429, 20003, 21610, 30001, 30002, 30003, 30004, 30005];
        const isRetryable = retryableErrors.includes(errorCode) || this.isRetryableError(error);

        // WhatsApp specific error handling
        if (errorCode === 63016) {
            // WhatsApp template not approved
            return this.createError(
                'WhatsApp message template is not approved or does not exist',
                'WHATSAPP_TEMPLATE_NOT_APPROVED',
                false,
                { originalError: error, twilioCode: errorCode }
            );
        }

        if (errorCode === 63017) {
            // WhatsApp template parameter mismatch
            return this.createError(
                'WhatsApp template parameter count mismatch',
                'WHATSAPP_TEMPLATE_PARAMETER_MISMATCH',
                false,
                { originalError: error, twilioCode: errorCode }
            );
        }

        return this.createError(
            `Twilio WhatsApp error: ${errorMessage}`,
            `TWILIO_WHATSAPP_${errorCode}`,
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

    private generateThreadId(identifier: string): string {
        // Remove any non-alphanumeric characters and create a consistent thread ID
        const cleanIdentifier = identifier.replace(/[^\w]/g, '');
        return `whatsapp_${cleanIdentifier}`;
    }

    // Utility methods for WhatsApp-specific features
    public async sendTemplate(
        to: string,
        templateName: string,
        templateLanguage: string = 'en',
        parameters?: string[]
    ): Promise<SendResult> {
        try {
            const from = this.formatWhatsAppNumber(this.phoneNumber);
            const toFormatted = this.formatWhatsAppNumber(to);

            const messageOptions: any = {
                from,
                to: toFormatted,
                contentSid: templateName
            };

            if (parameters && parameters.length > 0) {
                messageOptions.contentVariables = JSON.stringify({
                    1: parameters[0] || '',
                    2: parameters[1] || '',
                    3: parameters[2] || ''
                });
            }

            const twilioMessage = await this.client.messages.create(messageOptions);

            return {
                success: true,
                externalId: twilioMessage.sid,
                metadata: {
                    twilioSid: twilioMessage.sid,
                    templateName,
                    templateLanguage,
                    parameters
                }
            };

        } catch (error: any) {
            return {
                success: false,
                error: this.handleTwilioError(error)
            };
        }
    }

    // Static factory method
    static create(config?: Partial<IntegrationConfig>): TwilioWhatsAppIntegration {
        const defaultConfig: IntegrationConfig = {
            channel: MessageChannel.WHATSAPP,
            enabled: true,
            credentials: {
                type: 'api_key',
                accountSid: getEnvVar('TWILIO_ACCOUNT_SID') || '',
                authToken: getEnvVar('TWILIO_AUTH_TOKEN') || '',
                phoneNumber: getEnvVar('TWILIO_WHATSAPP_NUMBER') || getEnvVar('TWILIO_PHONE_NUMBER') || '',
                isSandbox: true // Default to sandbox for development
            } as TwilioWhatsAppCredentials,
            settings: {
                enableDeliveryReceipts: true,
                enableStatusCallbacks: true,
                messageRetention: 90,
                sandboxMode: true
            } as TwilioWhatsAppSettings,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...config
        };

        return new TwilioWhatsAppIntegration(defaultConfig);
    }
}