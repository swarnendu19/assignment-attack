import crypto from 'crypto';
import { MessageChannel } from '@prisma/client';
import { WebhookValidationResult, IntegrationError } from '../types/integration';

export class WebhookValidator {
    private static readonly SIGNATURE_TOLERANCE = 300; // 5 minutes in seconds

    // Main validation method
    static validate(
        channel: MessageChannel,
        payload: any,
        signature: string,
        secret: string,
        timestamp?: string
    ): WebhookValidationResult {
        try {
            switch (channel) {
                case MessageChannel.SMS:
                case MessageChannel.WHATSAPP:
                    return this.validateTwilioWebhook(payload, signature, secret);

                case MessageChannel.EMAIL:
                    return this.validateEmailWebhook(payload, signature, secret, timestamp);

                case MessageChannel.TWITTER:
                    return this.validateTwitterWebhook(payload, signature, secret);

                case MessageChannel.FACEBOOK:
                    return this.validateFacebookWebhook(payload, signature, secret);

                default:
                    return {
                        valid: false,
                        error: `Webhook validation not implemented for channel: ${channel}`
                    };
            }
        } catch (error) {
            return {
                valid: false,
                error: error instanceof Error ? error.message : 'Unknown validation error'
            };
        }
    }

    // Twilio webhook validation (SMS and WhatsApp)
    private static validateTwilioWebhook(
        payload: any,
        signature: string,
        authToken: string
    ): WebhookValidationResult {
        try {
            // Twilio uses X-Twilio-Signature header
            const url = payload.url || '';
            const params = new URLSearchParams();

            // Sort parameters alphabetically and build query string
            Object.keys(payload)
                .sort()
                .forEach(key => {
                    if (key !== 'url') {
                        params.append(key, payload[key]);
                    }
                });

            const data = url + params.toString();
            const expectedSignature = crypto
                .createHmac('sha1', authToken)
                .update(data, 'utf8')
                .digest('base64');

            const isValid = crypto.timingSafeEqual(
                Buffer.from(signature),
                Buffer.from(expectedSignature)
            );

            return {
                valid: isValid,
                payload: isValid ? payload : undefined,
                error: isValid ? undefined : 'Invalid Twilio signature'
            };
        } catch (error) {
            return {
                valid: false,
                error: `Twilio validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    // Email webhook validation (generic implementation)
    private static validateEmailWebhook(
        payload: any,
        signature: string,
        secret: string,
        timestamp?: string
    ): WebhookValidationResult {
        try {
            // Check timestamp if provided (prevent replay attacks)
            if (timestamp) {
                const webhookTimestamp = parseInt(timestamp, 10);
                const currentTimestamp = Math.floor(Date.now() / 1000);

                if (Math.abs(currentTimestamp - webhookTimestamp) > this.SIGNATURE_TOLERANCE) {
                    return {
                        valid: false,
                        error: 'Webhook timestamp is too old'
                    };
                }
            }

            // Create expected signature
            const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
            const signaturePayload = timestamp ? `${timestamp}.${payloadString}` : payloadString;

            const expectedSignature = crypto
                .createHmac('sha256', secret)
                .update(signaturePayload, 'utf8')
                .digest('hex');

            // Handle different signature formats
            const providedSignature = signature.startsWith('sha256=')
                ? signature.slice(7)
                : signature;

            const isValid = crypto.timingSafeEqual(
                Buffer.from(expectedSignature),
                Buffer.from(providedSignature)
            );

            return {
                valid: isValid,
                payload: isValid ? payload : undefined,
                error: isValid ? undefined : 'Invalid email webhook signature'
            };
        } catch (error) {
            return {
                valid: false,
                error: `Email validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    // Twitter webhook validation
    private static validateTwitterWebhook(
        payload: any,
        signature: string,
        secret: string
    ): WebhookValidationResult {
        try {
            // Twitter uses sha256 HMAC
            const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
            const expectedSignature = crypto
                .createHmac('sha256', secret)
                .update(payloadString, 'utf8')
                .digest('base64');

            const providedSignature = signature.startsWith('sha256=')
                ? signature.slice(7)
                : signature;

            const isValid = crypto.timingSafeEqual(
                Buffer.from(expectedSignature),
                Buffer.from(providedSignature)
            );

            return {
                valid: isValid,
                payload: isValid ? payload : undefined,
                error: isValid ? undefined : 'Invalid Twitter signature'
            };
        } catch (error) {
            return {
                valid: false,
                error: `Twitter validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    // Facebook webhook validation
    private static validateFacebookWebhook(
        payload: any,
        signature: string,
        secret: string
    ): WebhookValidationResult {
        try {
            // Facebook uses sha1 HMAC with 'sha1=' prefix
            const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
            const expectedSignature = 'sha1=' + crypto
                .createHmac('sha1', secret)
                .update(payloadString, 'utf8')
                .digest('hex');

            const isValid = crypto.timingSafeEqual(
                Buffer.from(signature),
                Buffer.from(expectedSignature)
            );

            return {
                valid: isValid,
                payload: isValid ? payload : undefined,
                error: isValid ? undefined : 'Invalid Facebook signature'
            };
        } catch (error) {
            return {
                valid: false,
                error: `Facebook validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    // Utility method to extract signature from headers
    static extractSignature(headers: Record<string, string>, channel: MessageChannel): string | null {
        const headerMap: Record<MessageChannel, string[]> = {
            [MessageChannel.SMS]: ['x-twilio-signature'],
            [MessageChannel.WHATSAPP]: ['x-twilio-signature'],
            [MessageChannel.EMAIL]: ['x-signature', 'signature'],
            [MessageChannel.TWITTER]: ['x-twitter-webhooks-signature'],
            [MessageChannel.FACEBOOK]: ['x-hub-signature']
        };

        const possibleHeaders = headerMap[channel] || [];

        for (const headerName of possibleHeaders) {
            const signature = headers[headerName] || headers[headerName.toLowerCase()];
            if (signature) {
                return signature;
            }
        }

        return null;
    }

    // Utility method to extract timestamp from headers
    static extractTimestamp(headers: Record<string, string>): string | null {
        const timestampHeaders = ['x-timestamp', 'timestamp', 'x-webhook-timestamp'];

        for (const headerName of timestampHeaders) {
            const timestamp = headers[headerName] || headers[headerName.toLowerCase()];
            if (timestamp) {
                return timestamp;
            }
        }

        return null;
    }

    // Generate webhook secret
    static generateWebhookSecret(): string {
        return crypto.randomBytes(32).toString('hex');
    }

    // Validate webhook URL format
    static validateWebhookUrl(url: string): boolean {
        try {
            const parsedUrl = new URL(url);
            return parsedUrl.protocol === 'https:' && parsedUrl.hostname !== 'localhost';
        } catch {
            return false;
        }
    }
}