import { MessageChannel } from '@prisma/client';
import { BaseIntegration } from '../integrations/base-integration';
import {
    IntegrationConfig,
    OutboundMessage,
    SendResult,
    ChannelCapabilities,
    ChannelCredentials,
    ChannelSettings,
    IntegrationError
} from '../types/integration';
import { UnifiedMessage, WebhookPayload, MessageContent } from '../types/message';

// Mock implementation for testing
class MockIntegration extends BaseIntegration {
    async send(message: OutboundMessage): Promise<SendResult> {
        this.validateOutboundMessage(message);

        return {
            success: true,
            externalId: this.generateExternalId(),
            metadata: { mockSent: true }
        };
    }

    async receive(webhook: WebhookPayload): Promise<UnifiedMessage> {
        return {
            id: 'test-id',
            contactId: 'test-contact',
            channel: this.channel,
            direction: 'INBOUND',
            content: { text: 'test message', type: 'text' },
            metadata: {
                channelId: 'test-channel',
                externalId: 'test-external',
                channelSpecific: {}
            },
            status: 'DELIVERED',
            threadId: 'test-thread',
            createdAt: new Date(),
            updatedAt: new Date()
        } as UnifiedMessage;
    }

    getCapabilities(): ChannelCapabilities {
        return {
            supportsMedia: true,
            supportedMediaTypes: ['image/jpeg', 'image/png'],
            maxMessageLength: 1600,
            supportsRichText: false,
            supportsDeliveryReceipts: true,
            supportsReadReceipts: false,
            supportsScheduling: false,
            supportsTemplates: false,
            rateLimits: {
                messagesPerSecond: 1,
                messagesPerMinute: 10,
                messagesPerHour: 100,
                messagesPerDay: 1000
            }
        };
    }

    // Expose protected methods for testing
    public testValidateOutboundMessage(message: OutboundMessage): void {
        return this.validateOutboundMessage(message);
    }

    public testCreateError(message: string, code: string, retryable?: boolean): IntegrationError {
        return this.createError(message, code, retryable);
    }

    public testGenerateExternalId(): string {
        return this.generateExternalId();
    }

    public testIsRetryableError(error: any): boolean {
        return this.isRetryableError(error);
    }
}

describe('BaseIntegration', () => {
    let mockConfig: IntegrationConfig;
    let integration: MockIntegration;

    beforeEach(() => {
        mockConfig = {
            channel: MessageChannel.SMS,
            enabled: true,
            credentials: {
                type: 'api_key',
                accountSid: 'test_sid',
                authToken: 'test_token'
            } as ChannelCredentials,
            settings: {
                defaultSender: '+1234567890'
            } as ChannelSettings,
            webhookUrl: 'https://example.com/webhook',
            webhookSecret: 'test_secret',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        integration = new MockIntegration(mockConfig);
    });

    describe('constructor', () => {
        it('should initialize with config', () => {
            expect(integration.getChannelType()).toBe(MessageChannel.SMS);
            expect(integration.isEnabled).toBe(true);
            expect(integration.webhookUrl).toBe('https://example.com/webhook');
        });
    });

    describe('getChannelType', () => {
        it('should return the correct channel type', () => {
            expect(integration.getChannelType()).toBe(MessageChannel.SMS);
        });
    });

    describe('validateWebhook', () => {
        it('should return true when no webhook secret is configured', () => {
            const configWithoutSecret = { ...mockConfig, webhookSecret: undefined };
            const integrationWithoutSecret = new MockIntegration(configWithoutSecret);

            const result = integrationWithoutSecret.validateWebhook({}, 'any_signature');
            expect(result).toBe(true);
        });

        it('should return false when signature is missing', () => {
            const result = integration.validateWebhook({});
            expect(result).toBe(false);
        });

        it('should call verifySignature when signature is provided', () => {
            const result = integration.validateWebhook({}, 'test_signature');
            // Base implementation always returns true
            expect(result).toBe(true);
        });
    });

    describe('validateOutboundMessage', () => {
        const validMessage: OutboundMessage = {
            contactId: 'test-contact',
            to: '+1234567890',
            content: {
                text: 'Hello world',
                type: 'text'
            } as MessageContent
        };

        it('should validate correct message', () => {
            expect(() => {
                integration.testValidateOutboundMessage(validMessage);
            }).not.toThrow();
        });

        it('should throw error for missing recipient', () => {
            const invalidMessage = { ...validMessage, to: '' };

            expect(() => {
                integration.testValidateOutboundMessage(invalidMessage);
            }).toThrow('Recipient is required');
        });

        it('should throw error for missing content', () => {
            const invalidMessage = {
                ...validMessage,
                content: { type: 'text' } as MessageContent
            };

            expect(() => {
                integration.testValidateOutboundMessage(invalidMessage);
            }).toThrow('Message content is required');
        });

        it('should throw error for message too long', () => {
            const longMessage = {
                ...validMessage,
                content: {
                    text: 'a'.repeat(2000), // Exceeds 1600 character limit
                    type: 'text'
                } as MessageContent
            };

            expect(() => {
                integration.testValidateOutboundMessage(longMessage);
            }).toThrow('Message exceeds maximum length');
        });

        it('should throw error for unsupported media type', () => {
            const mediaMessage = {
                ...validMessage,
                content: {
                    text: 'Hello',
                    type: 'media',
                    media: [{
                        id: 'test',
                        url: 'https://example.com/video.mp4',
                        type: 'video',
                        filename: 'video.mp4',
                        size: 1000,
                        mimeType: 'video/mp4' // Not in supported types
                    }]
                } as MessageContent
            };

            expect(() => {
                integration.testValidateOutboundMessage(mediaMessage);
            }).toThrow('Media type video/mp4 is not supported');
        });
    });

    describe('createError', () => {
        it('should create IntegrationError with correct properties', () => {
            const error = integration.testCreateError('Test error', 'TEST_CODE', true);

            expect(error).toBeInstanceOf(IntegrationError);
            expect(error.message).toBe('Test error');
            expect(error.code).toBe('TEST_CODE');
            expect(error.channel).toBe(MessageChannel.SMS);
            expect(error.retryable).toBe(true);
        });
    });

    describe('generateExternalId', () => {
        it('should generate unique external IDs', () => {
            const id1 = integration.testGenerateExternalId();
            const id2 = integration.testGenerateExternalId();

            expect(id1).not.toBe(id2);
            expect(id1).toMatch(/^sms_\d+_[a-z0-9]+$/);
        });
    });

    describe('isRetryableError', () => {
        it('should identify retryable IntegrationError', () => {
            const retryableError = new IntegrationError('Test', 'TEST', MessageChannel.SMS, true);
            const nonRetryableError = new IntegrationError('Test', 'TEST', MessageChannel.SMS, false);

            expect(integration.testIsRetryableError(retryableError)).toBe(true);
            expect(integration.testIsRetryableError(nonRetryableError)).toBe(false);
        });

        it('should identify retryable HTTP status codes', () => {
            const retryableStatuses = [408, 429, 500, 502, 503, 504];
            const nonRetryableStatuses = [400, 401, 403, 404];

            retryableStatuses.forEach(status => {
                const error = { status };
                expect(integration.testIsRetryableError(error)).toBe(true);
            });

            nonRetryableStatuses.forEach(status => {
                const error = { status };
                expect(integration.testIsRetryableError(error)).toBe(false);
            });
        });

        it('should return false for unknown errors', () => {
            const unknownError = new Error('Unknown error');
            expect(integration.testIsRetryableError(unknownError)).toBe(false);
        });
    });

    describe('healthCheck', () => {
        it('should return enabled status by default', async () => {
            const result = await integration.healthCheck();
            expect(result).toBe(true);
        });

        it('should return false for disabled integration', async () => {
            const disabledConfig = { ...mockConfig, enabled: false };
            const disabledIntegration = new MockIntegration(disabledConfig);

            const result = await disabledIntegration.healthCheck();
            expect(result).toBe(false);
        });
    });

    describe('configuration getters', () => {
        it('should return correct configuration values', () => {
            expect(integration.isEnabled).toBe(true);
            expect(integration.webhookUrl).toBe('https://example.com/webhook');
            expect(integration.credentials).toEqual(mockConfig.credentials);
            expect(integration.settings).toEqual(mockConfig.settings);
        });
    });

    describe('send method', () => {
        it('should send message successfully', async () => {
            const message: OutboundMessage = {
                contactId: 'test-contact',
                to: '+1234567890',
                content: {
                    text: 'Hello world',
                    type: 'text'
                } as MessageContent
            };

            const result = await integration.send(message);

            expect(result.success).toBe(true);
            expect(result.externalId).toBeDefined();
            expect(result.metadata?.mockSent).toBe(true);
        });

        it('should validate message before sending', async () => {
            const invalidMessage: OutboundMessage = {
                contactId: 'test-contact',
                to: '',
                content: {
                    text: 'Hello world',
                    type: 'text'
                } as MessageContent
            };

            await expect(integration.send(invalidMessage)).rejects.toThrow('Recipient is required');
        });
    });

    describe('receive method', () => {
        it('should receive webhook and return unified message', async () => {
            const webhook: WebhookPayload = {
                channel: MessageChannel.SMS,
                rawPayload: { test: 'data' },
                timestamp: new Date()
            };

            const result = await integration.receive(webhook);

            expect(result.id).toBe('test-id');
            expect(result.channel).toBe(MessageChannel.SMS);
            expect(result.direction).toBe('INBOUND');
        });
    });
});