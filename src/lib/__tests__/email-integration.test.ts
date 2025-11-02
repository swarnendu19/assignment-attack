import { MessageChannel, Direction, MessageStatus } from '@prisma/client';
import { EmailIntegration, EmailCredentials, EmailSettings } from '../integrations/email';
import { IntegrationConfig } from '../types/integration';
import { OutboundMessage, MessageContent } from '../types/message';

// Mock Resend
const mockSend = jest.fn();
jest.mock('resend', () => ({
    Resend: jest.fn().mockImplementation(() => ({
        emails: {
            send: mockSend
        }
    }))
}));

// Mock MediaStorageService
jest.mock('../utils/media-storage', () => ({
    MediaStorageService: jest.fn().mockImplementation(() => ({
        getMediaBuffer: jest.fn().mockResolvedValue(Buffer.from('test file content')),
        storeMediaFromUrl: jest.fn().mockResolvedValue({
            id: 'test-media-id',
            localPath: '/test/path/file.jpg',
            filename: 'test.jpg',
            size: 1024,
            mimeType: 'image/jpeg'
        })
    }))
}));

// Mock fetch for attachment downloads
global.fetch = jest.fn();

// Mock environment variables
jest.mock('../env', () => ({
    getEnvVar: jest.fn((key: string) => {
        const envVars: Record<string, string> = {
            'RESEND_API_KEY': 'test-api-key',
            'FROM_EMAIL': 'test@example.com'
        };
        return envVars[key];
    })
}));

describe('EmailIntegration', () => {
    let integration: EmailIntegration;
    let config: IntegrationConfig;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Create test configuration
        config = {
            channel: MessageChannel.EMAIL,
            enabled: true,
            credentials: {
                type: 'api_key',
                apiKey: 'test-api-key',
                fromEmail: 'test@example.com',
                fromName: 'Test Sender'
            } as EmailCredentials,
            settings: {
                enableDeliveryReceipts: true,
                enableReadReceipts: true,
                templateSupport: true,
                maxAttachmentSize: 25 * 1024 * 1024
            } as EmailSettings,
            webhookSecret: 'test-webhook-secret',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        integration = new EmailIntegration(config);

        // Mock fetch for successful responses
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
            headers: new Map([
                ['content-type', 'application/pdf'],
                ['content-length', '1024']
            ])
        });
    });

    describe('constructor', () => {
        it('should initialize with valid configuration', () => {
            expect(integration).toBeInstanceOf(EmailIntegration);
            expect(integration.getChannelType()).toBe(MessageChannel.EMAIL);
        });

        it('should throw error with missing credentials', () => {
            const invalidConfig = {
                ...config,
                credentials: {
                    type: 'api_key',
                    apiKey: '',
                    fromEmail: ''
                }
            };

            expect(() => new EmailIntegration(invalidConfig)).toThrow('Missing required email credentials');
        });
    });

    describe('send', () => {
        it('should send text email successfully', async () => {
            const mockResponse = {
                data: { id: 'email-123' },
                error: null
            };
            mockSend.mockResolvedValue(mockResponse);

            const message: OutboundMessage = {
                contactId: 'contact-123',
                to: 'recipient@example.com',
                content: {
                    text: 'Hello, this is a test email!',
                    type: 'text'
                },
                options: {
                    customHeaders: {
                        subject: 'Test Email'
                    }
                }
            };

            const result = await integration.send(message);

            expect(result.success).toBe(true);
            expect(result.externalId).toBe('email-123');
            expect(mockSend).toHaveBeenCalledWith({
                from: 'Test Sender <test@example.com>',
                to: ['recipient@example.com'],
                subject: 'Test Email',
                text: 'Hello, this is a test email!'
            });
        });

        it('should send HTML email successfully', async () => {
            const mockResponse = {
                data: { id: 'email-456' },
                error: null
            };
            mockSend.mockResolvedValue(mockResponse);

            const message: OutboundMessage = {
                contactId: 'contact-123',
                to: 'recipient@example.com',
                content: {
                    text: '<h1>Hello</h1><p>This is an HTML email!</p>',
                    type: 'text'
                },
                options: {
                    customHeaders: {
                        subject: 'HTML Test Email'
                    }
                }
            };

            const result = await integration.send(message);

            expect(result.success).toBe(true);
            expect(mockSend).toHaveBeenCalledWith({
                from: 'Test Sender <test@example.com>',
                to: ['recipient@example.com'],
                subject: 'HTML Test Email',
                html: '<h1>Hello</h1><p>This is an HTML email!</p>'
            });
        });

        it('should send email with attachments', async () => {
            const mockResponse = {
                data: { id: 'email-789' },
                error: null
            };
            mockSend.mockResolvedValue(mockResponse);

            const message: OutboundMessage = {
                contactId: 'contact-123',
                to: 'recipient@example.com',
                content: {
                    text: 'Email with attachment',
                    media: [{
                        id: 'attachment-1',
                        url: 'https://example.com/file.pdf',
                        type: 'document',
                        filename: 'document.pdf',
                        size: 1024,
                        mimeType: 'application/pdf'
                    }],
                    type: 'media'
                },
                options: {
                    customHeaders: {
                        subject: 'Email with Attachment'
                    }
                }
            };

            const result = await integration.send(message);

            expect(result.success).toBe(true);
            expect(mockSend).toHaveBeenCalledWith(
                expect.objectContaining({
                    attachments: expect.arrayContaining([
                        expect.objectContaining({
                            filename: 'document.pdf',
                            content_type: 'application/pdf'
                        })
                    ])
                })
            );
        });

        it('should handle CC and BCC recipients', async () => {
            const mockResponse = {
                data: { id: 'email-cc-bcc' },
                error: null
            };
            mockSend.mockResolvedValue(mockResponse);

            const message: OutboundMessage = {
                contactId: 'contact-123',
                to: 'recipient@example.com',
                content: {
                    text: 'Email with CC and BCC',
                    type: 'text'
                },
                options: {
                    customHeaders: {
                        subject: 'Test Email',
                        cc: 'cc1@example.com, cc2@example.com',
                        bcc: 'bcc@example.com'
                    }
                }
            };

            const result = await integration.send(message);

            expect(result.success).toBe(true);
            expect(mockSend).toHaveBeenCalledWith(
                expect.objectContaining({
                    cc: ['cc1@example.com', 'cc2@example.com'],
                    bcc: ['bcc@example.com']
                })
            );
        });

        it('should handle send errors', async () => {
            const mockError = {
                error: { message: 'Invalid API key' }
            };
            mockSend.mockResolvedValue(mockError);

            const message: OutboundMessage = {
                contactId: 'contact-123',
                to: 'recipient@example.com',
                content: {
                    text: 'Test email',
                    type: 'text'
                }
            };

            const result = await integration.send(message);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain('Invalid API key');
        });

        it('should validate message before sending', async () => {
            const invalidMessage: OutboundMessage = {
                contactId: 'contact-123',
                to: '', // Missing recipient
                content: {
                    text: 'Test email',
                    type: 'text'
                }
            };

            const result = await integration.send(invalidMessage);

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('MISSING_RECIPIENT');
        });
    });

    describe('receive', () => {
        it('should process inbound email webhook', async () => {
            const webhookPayload = {
                source: 'resend',
                timestamp: new Date(),
                rawPayload: {
                    type: 'email.sent',
                    created_at: '2024-01-01T12:00:00Z',
                    data: {
                        email_id: 'email-inbound-123',
                        from: 'sender@example.com',
                        to: ['test@example.com'],
                        subject: 'Inbound Email',
                        text: 'This is an inbound email message',
                        attachments: [{
                            filename: 'attachment.pdf',
                            content_type: 'application/pdf',
                            size: 2048
                        }]
                    }
                },
                headers: {}
            };

            const result = await integration.receive(webhookPayload);

            expect(result.channel).toBe(MessageChannel.EMAIL);
            expect(result.direction).toBe(Direction.INBOUND);
            expect(result.content.text).toBe('This is an inbound email message');
            expect(result.content.media).toHaveLength(1);
            expect(result.metadata.externalId).toBe('email-inbound-123');
            expect(result.metadata.channelSpecific.subject).toBe('Inbound Email');
            expect(result.threadId).toBe('email_sender@example.com');
        });

        it('should handle email without attachments', async () => {
            const webhookPayload = {
                source: 'resend',
                timestamp: new Date(),
                rawPayload: {
                    type: 'email.sent',
                    created_at: '2024-01-01T12:00:00Z',
                    data: {
                        email_id: 'email-simple-123',
                        from: 'sender@example.com',
                        to: ['test@example.com'],
                        subject: 'Simple Email',
                        text: 'Simple text email'
                    }
                },
                headers: {}
            };

            const result = await integration.receive(webhookPayload);

            expect(result.content.media).toBeUndefined();
            expect(result.content.type).toBe('text');
        });

        it('should reject non-inbound emails', async () => {
            const webhookPayload = {
                source: 'resend',
                timestamp: new Date(),
                rawPayload: {
                    type: 'email.sent',
                    created_at: '2024-01-01T12:00:00Z',
                    data: {
                        email_id: 'email-outbound-123',
                        from: 'test@example.com', // From our address
                        to: ['external@example.com'],
                        subject: 'Outbound Email',
                        text: 'This is an outbound email'
                    }
                },
                headers: {}
            };

            await expect(integration.receive(webhookPayload)).rejects.toThrow('Webhook is not for an inbound email message');
        });

        it('should handle invalid webhook payload', async () => {
            const invalidPayload = {
                source: 'resend',
                timestamp: new Date(),
                rawPayload: {
                    type: 'email.sent',
                    data: {
                        // Missing required fields
                    }
                },
                headers: {}
            };

            await expect(integration.receive(invalidPayload)).rejects.toThrow('Invalid email webhook payload');
        });
    });

    describe('validateWebhook', () => {
        it('should validate webhook signature', () => {
            const payload = { test: 'data' };
            const validSignature = require('crypto')
                .createHmac('sha256', 'test-webhook-secret')
                .update(JSON.stringify(payload))
                .digest('hex');

            const isValid = integration.validateWebhook(payload, validSignature);
            expect(isValid).toBe(true);
        });

        it('should reject invalid signature', () => {
            const payload = { test: 'data' };
            const invalidSignature = 'invalid-signature';

            const isValid = integration.validateWebhook(payload, invalidSignature);
            expect(isValid).toBe(false);
        });

        it('should handle missing signature', () => {
            const payload = { test: 'data' };

            const isValid = integration.validateWebhook(payload);
            expect(isValid).toBe(false);
        });
    });

    describe('getCapabilities', () => {
        it('should return correct capabilities', () => {
            const capabilities = integration.getCapabilities();

            expect(capabilities.supportsMedia).toBe(true);
            expect(capabilities.supportsRichText).toBe(true);
            expect(capabilities.supportsTemplates).toBe(true);
            expect(capabilities.maxMessageLength).toBe(1000000);
            expect(capabilities.supportedMediaTypes).toContain('application/pdf');
            expect(capabilities.rateLimits.messagesPerSecond).toBe(14);
        });
    });

    describe('healthCheck', () => {
        it('should return true for healthy service', async () => {
            mockSend.mockResolvedValue({ data: { id: 'test' } });

            const isHealthy = await integration.healthCheck();
            expect(isHealthy).toBe(true);
        });

        it('should return false for authentication errors', async () => {
            mockSend.mockRejectedValue(new Error('API key invalid'));

            const isHealthy = await integration.healthCheck();
            expect(isHealthy).toBe(false);
        });

        it('should return true for non-auth errors', async () => {
            mockSend.mockRejectedValue(new Error('Network timeout'));

            const isHealthy = await integration.healthCheck();
            expect(isHealthy).toBe(true);
        });
    });

    describe('sendWithTemplate', () => {
        it('should send email with template variables', async () => {
            const mockResponse = {
                data: { id: 'template-email-123' },
                error: null
            };
            mockSend.mockResolvedValue(mockResponse);

            const message: OutboundMessage = {
                contactId: 'contact-123',
                to: 'recipient@example.com',
                content: {
                    text: '',
                    type: 'text'
                }
            };

            const template = {
                id: 'template-1',
                name: 'Welcome Email',
                subject: 'Welcome {{name}}!',
                html: '<h1>Hello {{name}}</h1><p>Welcome to {{company}}!</p>',
                text: 'Hello {{name}}, welcome to {{company}}!',
                variables: ['name', 'company']
            };

            const variables = {
                name: 'John Doe',
                company: 'Acme Corp'
            };

            const result = await integration.sendWithTemplate(message, template, variables);

            expect(result.success).toBe(true);
            expect(mockSend).toHaveBeenCalledWith(
                expect.objectContaining({
                    subject: 'Welcome John Doe!',
                    html: '<h1>Hello John Doe</h1><p>Welcome to Acme Corp!</p>'
                })
            );
        });
    });

    describe('static create method', () => {
        it('should create instance with default configuration', () => {
            const instance = EmailIntegration.create();

            expect(instance).toBeInstanceOf(EmailIntegration);
            expect(instance.getChannelType()).toBe(MessageChannel.EMAIL);
        });

        it('should create instance with custom configuration', () => {
            const customConfig = {
                credentials: {
                    type: 'api_key' as const,
                    apiKey: 'custom-key',
                    fromEmail: 'custom@example.com'
                }
            };

            const instance = EmailIntegration.create(customConfig);

            expect(instance).toBeInstanceOf(EmailIntegration);
        });
    });
});