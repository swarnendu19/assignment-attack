import crypto from 'crypto';
import { MessageChannel } from '@prisma/client';
import { WebhookValidator } from '../integrations/webhook-validator';

describe('WebhookValidator', () => {
    const testSecret = 'test_secret_key';
    const testPayload = { message: 'test', from: '+1234567890' };

    describe('validate', () => {
        it('should return error for unsupported channel', () => {
            const result = WebhookValidator.validate(
                'UNSUPPORTED' as MessageChannel,
                testPayload,
                'signature',
                testSecret
            );

            expect(result.valid).toBe(false);
            expect(result.error).toContain('not implemented');
        });

        it('should handle validation errors gracefully', () => {
            const result = WebhookValidator.validate(
                MessageChannel.SMS,
                null,
                'invalid_signature',
                testSecret
            );

            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe('validateTwilioWebhook', () => {
        it('should validate correct Twilio signature', () => {
            const url = 'https://example.com/webhook';
            const params = {
                MessageSid: 'SM123',
                From: '+1234567890',
                Body: 'Hello',
                url: url
            };

            // Create expected signature
            const sortedParams = new URLSearchParams();
            Object.keys(params)
                .filter(key => key !== 'url')
                .sort()
                .forEach(key => {
                    sortedParams.append(key, params[key as keyof typeof params]);
                });

            const data = url + sortedParams.toString();
            const expectedSignature = crypto
                .createHmac('sha1', testSecret)
                .update(data, 'utf8')
                .digest('base64');

            const result = WebhookValidator.validate(
                MessageChannel.SMS,
                params,
                expectedSignature,
                testSecret
            );

            expect(result.valid).toBe(true);
            expect(result.payload).toEqual(params);
        });

        it('should reject invalid Twilio signature', () => {
            const params = {
                MessageSid: 'SM123',
                From: '+1234567890',
                Body: 'Hello',
                url: 'https://example.com/webhook'
            };

            const result = WebhookValidator.validate(
                MessageChannel.SMS,
                params,
                'invalid_signature',
                testSecret
            );

            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe('validateEmailWebhook', () => {
        it('should validate correct email webhook signature', () => {
            const payloadString = JSON.stringify(testPayload);
            const expectedSignature = crypto
                .createHmac('sha256', testSecret)
                .update(payloadString, 'utf8')
                .digest('hex');

            const result = WebhookValidator.validate(
                MessageChannel.EMAIL,
                testPayload,
                expectedSignature,
                testSecret
            );

            expect(result.valid).toBe(true);
            expect(result.payload).toEqual(testPayload);
        });

        it('should validate signature with sha256 prefix', () => {
            const payloadString = JSON.stringify(testPayload);
            const signature = crypto
                .createHmac('sha256', testSecret)
                .update(payloadString, 'utf8')
                .digest('hex');

            const result = WebhookValidator.validate(
                MessageChannel.EMAIL,
                testPayload,
                `sha256=${signature}`,
                testSecret
            );

            expect(result.valid).toBe(true);
        });

        it('should validate signature with timestamp', () => {
            const timestamp = Math.floor(Date.now() / 1000).toString();
            const payloadString = JSON.stringify(testPayload);
            const signaturePayload = `${timestamp}.${payloadString}`;

            const expectedSignature = crypto
                .createHmac('sha256', testSecret)
                .update(signaturePayload, 'utf8')
                .digest('hex');

            const result = WebhookValidator.validate(
                MessageChannel.EMAIL,
                testPayload,
                expectedSignature,
                testSecret,
                timestamp
            );

            expect(result.valid).toBe(true);
        });

        it('should reject old timestamp', () => {
            const oldTimestamp = (Math.floor(Date.now() / 1000) - 400).toString(); // 400 seconds ago
            const payloadString = JSON.stringify(testPayload);
            const signaturePayload = `${oldTimestamp}.${payloadString}`;

            const signature = crypto
                .createHmac('sha256', testSecret)
                .update(signaturePayload, 'utf8')
                .digest('hex');

            const result = WebhookValidator.validate(
                MessageChannel.EMAIL,
                testPayload,
                signature,
                testSecret,
                oldTimestamp
            );

            expect(result.valid).toBe(false);
            expect(result.error).toContain('timestamp is too old');
        });
    });

    describe('validateTwitterWebhook', () => {
        it('should validate correct Twitter signature', () => {
            const payloadString = JSON.stringify(testPayload);
            const expectedSignature = crypto
                .createHmac('sha256', testSecret)
                .update(payloadString, 'utf8')
                .digest('base64');

            const result = WebhookValidator.validate(
                MessageChannel.TWITTER,
                testPayload,
                expectedSignature,
                testSecret
            );

            expect(result.valid).toBe(true);
        });

        it('should handle sha256 prefix in Twitter signature', () => {
            const payloadString = JSON.stringify(testPayload);
            const signature = crypto
                .createHmac('sha256', testSecret)
                .update(payloadString, 'utf8')
                .digest('base64');

            const result = WebhookValidator.validate(
                MessageChannel.TWITTER,
                testPayload,
                `sha256=${signature}`,
                testSecret
            );

            expect(result.valid).toBe(true);
        });
    });

    describe('validateFacebookWebhook', () => {
        it('should validate correct Facebook signature', () => {
            const payloadString = JSON.stringify(testPayload);
            const expectedSignature = 'sha1=' + crypto
                .createHmac('sha1', testSecret)
                .update(payloadString, 'utf8')
                .digest('hex');

            const result = WebhookValidator.validate(
                MessageChannel.FACEBOOK,
                testPayload,
                expectedSignature,
                testSecret
            );

            expect(result.valid).toBe(true);
        });

        it('should reject invalid Facebook signature', () => {
            const result = WebhookValidator.validate(
                MessageChannel.FACEBOOK,
                testPayload,
                'sha1=invalid_signature',
                testSecret
            );

            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe('extractSignature', () => {
        it('should extract Twilio signature from headers', () => {
            const headers = {
                'x-twilio-signature': 'test_signature',
                'content-type': 'application/x-www-form-urlencoded'
            };

            const signature = WebhookValidator.extractSignature(headers, MessageChannel.SMS);
            expect(signature).toBe('test_signature');
        });

        it('should extract email signature from headers', () => {
            const headers = {
                'x-signature': 'test_signature',
                'content-type': 'application/json'
            };

            const signature = WebhookValidator.extractSignature(headers, MessageChannel.EMAIL);
            expect(signature).toBe('test_signature');
        });

        it('should handle case-insensitive headers', () => {
            const headers = {
                'x-twilio-signature': 'test_signature'
            };

            const signature = WebhookValidator.extractSignature(headers, MessageChannel.SMS);
            expect(signature).toBe('test_signature');
        });

        it('should return null if no signature found', () => {
            const headers = {
                'content-type': 'application/json'
            };

            const signature = WebhookValidator.extractSignature(headers, MessageChannel.SMS);
            expect(signature).toBeNull();
        });
    });

    describe('extractTimestamp', () => {
        it('should extract timestamp from headers', () => {
            const timestamp = '1234567890';
            const headers = {
                'x-timestamp': timestamp,
                'content-type': 'application/json'
            };

            const extracted = WebhookValidator.extractTimestamp(headers);
            expect(extracted).toBe(timestamp);
        });

        it('should return null if no timestamp found', () => {
            const headers = {
                'content-type': 'application/json'
            };

            const timestamp = WebhookValidator.extractTimestamp(headers);
            expect(timestamp).toBeNull();
        });
    });

    describe('generateWebhookSecret', () => {
        it('should generate a valid webhook secret', () => {
            const secret = WebhookValidator.generateWebhookSecret();

            expect(secret).toBeDefined();
            expect(typeof secret).toBe('string');
            expect(secret.length).toBe(64); // 32 bytes * 2 (hex)
        });

        it('should generate different secrets each time', () => {
            const secret1 = WebhookValidator.generateWebhookSecret();
            const secret2 = WebhookValidator.generateWebhookSecret();

            expect(secret1).not.toBe(secret2);
        });
    });

    describe('validateWebhookUrl', () => {
        it('should validate correct HTTPS URLs', () => {
            const validUrls = [
                'https://example.com/webhook',
                'https://api.example.com/webhooks/twilio',
                'https://subdomain.example.com:8080/webhook'
            ];

            validUrls.forEach(url => {
                expect(WebhookValidator.validateWebhookUrl(url)).toBe(true);
            });
        });

        it('should reject HTTP URLs', () => {
            const httpUrl = 'http://example.com/webhook';
            expect(WebhookValidator.validateWebhookUrl(httpUrl)).toBe(false);
        });

        it('should reject localhost URLs', () => {
            const localhostUrl = 'https://localhost:3000/webhook';
            expect(WebhookValidator.validateWebhookUrl(localhostUrl)).toBe(false);
        });

        it('should reject invalid URLs', () => {
            const invalidUrls = [
                'not-a-url',
                'ftp://example.com',
                '',
                'https://'
            ];

            invalidUrls.forEach(url => {
                expect(WebhookValidator.validateWebhookUrl(url)).toBe(false);
            });
        });
    });
});