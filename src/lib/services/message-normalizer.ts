import { MessageChannel, Direction, MessageStatus } from '@prisma/client';
import {
    UnifiedMessage,
    MessageContent,
    ChannelMetadata,
    WebhookPayload,
    NormalizationResult,
    MediaAttachment,
    CreateMessageInput
} from '../types/message';
import { generateThreadId } from '../utils/thread-utils';

/**
 * MessageNormalizer handles the conversion of channel-specific webhook payloads
 * into the unified message format used throughout the application.
 */
export class MessageNormalizer {
    /**
     * Normalize a webhook payload into a unified message format
     */
    static async normalize(payload: WebhookPayload): Promise<NormalizationResult> {
        try {
            let normalizedMessage: UnifiedMessage;

            switch (payload.channel) {
                case 'SMS':
                    normalizedMessage = await this.normalizeTwilioSMS(payload);
                    break;
                case 'WHATSAPP':
                    normalizedMessage = await this.normalizeTwilioWhatsApp(payload);
                    break;
                case 'EMAIL':
                    normalizedMessage = await this.normalizeEmail(payload);
                    break;
                case 'TWITTER':
                    normalizedMessage = await this.normalizeTwitter(payload);
                    break;
                case 'FACEBOOK':
                    normalizedMessage = await this.normalizeFacebook(payload);
                    break;
                default:
                    throw new Error(`Unsupported channel: ${payload.channel}`);
            }

            return {
                success: true,
                message: normalizedMessage
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown normalization error'
            };
        }
    }

    /**
     * Normalize Twilio SMS webhook payload
     */
    private static async normalizeTwilioSMS(payload: WebhookPayload): Promise<UnifiedMessage> {
        const data = payload.rawPayload;

        // Extract contact information from phone number
        const phoneNumber = this.cleanPhoneNumber(data.From);
        const contactId = await this.getOrCreateContactByPhone(phoneNumber);

        // Generate thread ID
        const threadId = generateThreadId({
            contactId,
            channel: 'SMS'
        });

        // Parse message content
        const content: MessageContent = {
            text: data.Body || '',
            type: 'text',
            media: data.NumMedia && parseInt(data.NumMedia) > 0
                ? await this.extractTwilioMedia(data)
                : undefined
        };

        // Build channel metadata
        const metadata: ChannelMetadata = {
            channelId: 'twilio-sms',
            externalId: data.MessageSid,
            channelSpecific: {
                accountSid: data.AccountSid,
                messagingServiceSid: data.MessagingServiceSid,
                from: data.From,
                to: data.To,
                numSegments: data.NumSegments,
                price: data.Price,
                priceUnit: data.PriceUnit
            }
        };

        return {
            id: '', // Will be set by database
            contactId,
            channel: 'SMS',
            direction: 'INBOUND',
            content,
            metadata,
            status: 'DELIVERED',
            threadId,
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    /**
     * Normalize Twilio WhatsApp webhook payload
     */
    private static async normalizeTwilioWhatsApp(payload: WebhookPayload): Promise<UnifiedMessage> {
        const data = payload.rawPayload;

        // Extract WhatsApp number (remove whatsapp: prefix)
        const whatsappNumber = data.From?.replace('whatsapp:', '') || '';
        const contactId = await this.getOrCreateContactByPhone(whatsappNumber);

        const threadId = generateThreadId({
            contactId,
            channel: 'WHATSAPP'
        });

        const content: MessageContent = {
            text: data.Body || '',
            type: 'text',
            media: data.NumMedia && parseInt(data.NumMedia) > 0
                ? await this.extractTwilioMedia(data)
                : undefined
        };

        const metadata: ChannelMetadata = {
            channelId: 'twilio-whatsapp',
            externalId: data.MessageSid,
            channelSpecific: {
                accountSid: data.AccountSid,
                from: data.From,
                to: data.To,
                profileName: data.ProfileName,
                waId: data.WaId
            }
        };

        return {
            id: '',
            contactId,
            channel: 'WHATSAPP',
            direction: 'INBOUND',
            content,
            metadata,
            status: 'DELIVERED',
            threadId,
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    /**
     * Normalize email webhook payload (Resend/generic)
     */
    private static async normalizeEmail(payload: WebhookPayload): Promise<UnifiedMessage> {
        const data = payload.rawPayload;

        const contactId = await this.getOrCreateContactByEmail(data.from?.email || data.from);

        const threadId = generateThreadId({
            contactId,
            channel: 'EMAIL'
        });

        const content: MessageContent = {
            text: data.text || data.body,
            type: 'text',
            subject: data.subject,
            media: data.attachments ? await this.extractEmailAttachments(data.attachments) : undefined
        };

        const metadata: ChannelMetadata = {
            channelId: 'email',
            externalId: data.messageId || data.id,
            channelSpecific: {
                from: data.from,
                to: data.to,
                cc: data.cc,
                bcc: data.bcc,
                replyTo: data.replyTo,
                headers: data.headers
            }
        };

        return {
            id: '',
            contactId,
            channel: 'EMAIL',
            direction: 'INBOUND',
            content,
            metadata,
            status: 'DELIVERED',
            threadId,
            createdAt: new Date(data.date || Date.now()),
            updatedAt: new Date()
        };
    }

    /**
     * Normalize Twitter webhook payload
     */
    private static async normalizeTwitter(payload: WebhookPayload): Promise<UnifiedMessage> {
        const data = payload.rawPayload;

        // For Twitter DMs
        const twitterHandle = data.message_create?.sender_id || data.user?.screen_name;
        const contactId = await this.getOrCreateContactBySocial('twitter', twitterHandle);

        const threadId = generateThreadId({
            contactId,
            channel: 'TWITTER'
        });

        const content: MessageContent = {
            text: data.message_create?.message_data?.text || data.text,
            type: 'text',
            media: data.message_create?.message_data?.attachment
                ? await this.extractTwitterMedia(data.message_create.message_data.attachment)
                : undefined
        };

        const metadata: ChannelMetadata = {
            channelId: 'twitter',
            externalId: data.message_create?.id || data.id_str,
            channelSpecific: {
                senderId: data.message_create?.sender_id,
                recipientId: data.message_create?.target?.recipient_id,
                createdTimestamp: data.message_create?.created_timestamp
            }
        };

        return {
            id: '',
            contactId,
            channel: 'TWITTER',
            direction: 'INBOUND',
            content,
            metadata,
            status: 'DELIVERED',
            threadId,
            createdAt: new Date(parseInt(data.message_create?.created_timestamp || Date.now())),
            updatedAt: new Date()
        };
    }

    /**
     * Normalize Facebook webhook payload
     */
    private static async normalizeFacebook(payload: WebhookPayload): Promise<UnifiedMessage> {
        const data = payload.rawPayload;

        const facebookId = data.sender?.id;
        const contactId = await this.getOrCreateContactBySocial('facebook', facebookId);

        const threadId = generateThreadId({
            contactId,
            channel: 'FACEBOOK'
        });

        const content: MessageContent = {
            text: data.message?.text,
            type: 'text',
            media: data.message?.attachments
                ? await this.extractFacebookMedia(data.message.attachments)
                : undefined
        };

        const metadata: ChannelMetadata = {
            channelId: 'facebook',
            externalId: data.message?.mid,
            channelSpecific: {
                senderId: data.sender?.id,
                recipientId: data.recipient?.id,
                timestamp: data.timestamp
            }
        };

        return {
            id: '',
            contactId,
            channel: 'FACEBOOK',
            direction: 'INBOUND',
            content,
            metadata,
            status: 'DELIVERED',
            threadId,
            createdAt: new Date(data.timestamp || Date.now()),
            updatedAt: new Date()
        };
    }

    // Helper methods for contact resolution
    private static async getOrCreateContactByPhone(phone: string): Promise<string> {
        // This would integrate with ContactService to find or create contact
        // For now, return a placeholder - will be implemented when ContactService is available
        return `contact_${phone.replace(/\D/g, '')}`;
    }

    private static async getOrCreateContactByEmail(email: string): Promise<string> {
        return `contact_${email.replace(/[@.]/g, '_')}`;
    }

    private static async getOrCreateContactBySocial(platform: string, handle: string): Promise<string> {
        return `contact_${platform}_${handle}`;
    }

    // Helper methods for media extraction
    private static async extractTwilioMedia(data: any): Promise<MediaAttachment[]> {
        const media: MediaAttachment[] = [];
        const numMedia = parseInt(data.NumMedia || '0');

        for (let i = 0; i < numMedia; i++) {
            const mediaUrl = data[`MediaUrl${i}`];
            const contentType = data[`MediaContentType${i}`];

            if (mediaUrl) {
                media.push({
                    id: `twilio_${data.MessageSid}_${i}`,
                    url: mediaUrl,
                    type: this.getMediaTypeFromContentType(contentType),
                    filename: `attachment_${i}`,
                    size: 0, // Twilio doesn't provide size in webhook
                    mimeType: contentType
                });
            }
        }

        return media;
    }

    private static async extractEmailAttachments(attachments: any[]): Promise<MediaAttachment[]> {
        return attachments.map((attachment, index) => ({
            id: `email_${Date.now()}_${index}`,
            url: attachment.url || attachment.content,
            type: this.getMediaTypeFromContentType(attachment.contentType),
            filename: attachment.filename || `attachment_${index}`,
            size: attachment.size || 0,
            mimeType: attachment.contentType
        }));
    }

    private static async extractTwitterMedia(attachment: any): Promise<MediaAttachment[]> {
        if (attachment.type === 'media' && attachment.media) {
            return [{
                id: `twitter_${attachment.media.id}`,
                url: attachment.media.media_url_https,
                type: attachment.media.type === 'photo' ? 'image' : 'video',
                filename: `twitter_${attachment.media.id}`,
                size: 0,
                mimeType: attachment.media.type === 'photo' ? 'image/jpeg' : 'video/mp4'
            }];
        }
        return [];
    }

    private static async extractFacebookMedia(attachments: any[]): Promise<MediaAttachment[]> {
        return attachments.map((attachment, index) => ({
            id: `facebook_${Date.now()}_${index}`,
            url: attachment.payload?.url,
            type: attachment.type === 'image' ? 'image' : 'document',
            filename: `facebook_attachment_${index}`,
            size: 0,
            mimeType: attachment.type === 'image' ? 'image/jpeg' : 'application/octet-stream'
        }));
    }

    // Utility methods
    private static cleanPhoneNumber(phone: string): string {
        return phone.replace(/\D/g, '');
    }

    private static getMediaTypeFromContentType(contentType: string): 'image' | 'video' | 'audio' | 'document' {
        if (contentType.startsWith('image/')) return 'image';
        if (contentType.startsWith('video/')) return 'video';
        if (contentType.startsWith('audio/')) return 'audio';
        return 'document';
    }
}