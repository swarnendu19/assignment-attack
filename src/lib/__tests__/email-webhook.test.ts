import { NextRequest } from 'next/server';
import { POST, GET } from '../../app/api/webhooks/email/route';
import { MessageChannel } from '@prisma/client';

// Mock the integration factory
const mockIntegration = {
    validateWebhook: jest.fn().mockReturnValue(true),
    receive: jest.fn()
};

jest.mock('../integrations/integration-factory', () => ({
    IntegrationFactory: {
        create: jest.fn(() => mockIntegration)
    }
}));

// Mock the message service
const mockMessageService = {
    createMessage: jest.fn().mockResolvedValue({
        id: 'message-123',
        contactId: 'contact-123',
        channel: MessageChannel.EMAIL
    }),
    findByExternalId: jest.fn(),
    updateMessageStatus: jest.fn(),
    updateMessageMetadata: jest.fn()
};

jest.mock('../services/message-service', () => ({
    MessageService: jest.fn(() => mockMessageService)
}));

describe('Email Webhook API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockIntegration.validateWebhook.mockReturnValue(true);
    });

    describe('POST /api/webhooks/email', () => {
        it('should process inbound email webhook successfully', async () => {
            const webhookPayload = {
                type: 'email.sent',
                created_at: '2024-01-01T12:00:00Z',
                data: {
                    email_id: 'email-123',
                    from: 'sender@example.com',
                    to: ['test@example.com'],
                    subject: 'Test Email',
                    text: 'This is a test email'
                }
            };

            const mockUnifiedMessage = {
                id: 'unified-123',
                contactId: 'contact-123',
                channel: MessageChannel.EMAIL,
                content: { text: 'This is a test email', type: 'text' },
                metadata: { externalId: 'email-123' }
            };

            mockIntegration.receive.mockResolvedValue(mockUnifiedMessage);

            const request = new NextRequest('http://localhost:3000/api/webhooks/email', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'resend-signature': 'valid-signature'
                },
                body: JSON.stringify(webhookPayload)
            });

            const response = await POST(request);
            const responseData = await response.json();

            expect(response.status).toBe(200);
            expect(responseData.success).toBe(true);
            expect(responseData.messageId).toBe('message-123');
            expect(mockIntegration.validateWebhook).toHaveBeenCalled();
            expect(mockIntegration.receive).toHaveBeenCalled();
            expect(mockMessageService.createMessage).toHaveBeenCalledWith(mockUnifiedMessage);
        });

        it('should handle outbound email webhooks gracefully', async () => {
            const webhookPayload = {
                type: 'email.sent',
                created_at: '2024-01-01T12:00:00Z',
                data: {
                    email_id: 'email-outbound-123',
                    from: 'test@example.com',
                    to: ['external@example.com'],
                    subject: 'Outbound Email',
                    text: 'This is an outbound email'
                }
            };

            const error = new Error('Webhook is not for an inbound email message');
            (error as any).code = 'NOT_INBOUND_MESSAGE';
            mockIntegration.receive.mockRejectedValue(error);

            const request = new NextRequest('http://localhost:3000/api/webhooks/email', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'resend-signature': 'valid-signature'
                },
                body: JSON.stringify(webhookPayload)
            });

            const response = await POST(request);
            const responseData = await response.json();

            expect(response.status).toBe(200);
            expect(responseData.success).toBe(true);
            expect(responseData.ignored).toBe(true);
        });

        it('should handle email delivery status updates', async () => {
            const webhookPayload = {
                type: 'email.delivered',
                created_at: '2024-01-01T12:00:00Z',
                data: {
                    email_id: 'email-123',
                    from: 'test@example.com',
                    to: ['recipient@example.com'],
                    subject: 'Test Email'
                }
            };

            mockMessageService.findByExternalId.mockResolvedValue({
                id: 'message-123',
                metadata: { channelSpecific: {} }
            });

            const request = new NextRequest('http://localhost:3000/api/webhooks/email', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'resend-signature': 'valid-signature'
                },
                body: JSON.stringify(webhookPayload)
            });

            const response = await POST(request);
            const responseData = await response.json();

            expect(response.status).toBe(200);
            expect(responseData.success).toBe(true);
            expect(responseData.type).toBe('status_update');
            expect(mockMessageService.findByExternalId).toHaveBeenCalledWith('email-123', MessageChannel.EMAIL);
            expect(mockMessageService.updateMessageStatus).toHaveBeenCalledWith('message-123', 'DELIVERED');
        });

        it('should handle email bounce status updates', async () => {
            const webhookPayload = {
                type: 'email.bounced',
                created_at: '2024-01-01T12:00:00Z',
                data: {
                    email_id: 'email-bounced-123',
                    from: 'test@example.com',
                    to: ['invalid@example.com'],
                    subject: 'Bounced Email'
                }
            };

            mockMessageService.findByExternalId.mockResolvedValue({
                id: 'message-bounced-123',
                metadata: { channelSpecific: {} }
            });

            const request = new NextRequest('http://localhost:3000/api/webhooks/email', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'resend-signature': 'valid-signature'
                },
                body: JSON.stringify(webhookPayload)
            });

            const response = await POST(request);
            const responseData = await response.json();

            expect(response.status).toBe(200);
            expect(responseData.success).toBe(true);
            expect(mockMessageService.updateMessageStatus).toHaveBeenCalledWith('message-bounced-123', 'FAILED');
        });

        it('should handle email open tracking', async () => {
            const webhookPayload = {
                type: 'email.opened',
                created_at: '2024-01-01T12:00:00Z',
                data: {
                    email_id: 'email-opened-123',
                    from: 'test@example.com',
                    to: ['recipient@example.com'],
                    subject: 'Opened Email'
                }
            };

            mockMessageService.findByExternalId.mockResolvedValue({
                id: 'message-opened-123',
                metadata: {
                    channelSpecific: {
                        subject: 'Opened Email'
                    }
                }
            });

            const request = new NextRequest('http://localhost:3000/api/webhooks/email', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'resend-signature': 'valid-signature'
                },
                body: JSON.stringify(webhookPayload)
            });

            const response = await POST(request);
            const responseData = await response.json();

            expect(response.status).toBe(200);
            expect(responseData.success).toBe(true);
            expect(mockMessageService.updateMessageMetadata).toHaveBeenCalledWith(
                'message-opened-123',
                expect.objectContaining({
                    channelSpecific: expect.objectContaining({
                        opened: true,
                        openedAt: expect.any(String)
                    })
                })
            );
        });

        it('should handle email click tracking', async () => {
            const webhookPayload = {
                type: 'email.clicked',
                created_at: '2024-01-01T12:00:00Z',
                data: {
                    email_id: 'email-clicked-123',
                    from: 'test@example.com',
                    to: ['recipient@example.com'],
                    subject: 'Clicked Email'
                }
            };

            mockMessageService.findByExternalId.mockResolvedValue({
                id: 'message-clicked-123',
                metadata: {
                    channelSpecific: {
                        subject: 'Clicked Email'
                    }
                }
            });

            const request = new NextRequest('http://localhost:3000/api/webhooks/email', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'resend-signature': 'valid-signature'
                },
                body: JSON.stringify(webhookPayload)
            });

            const response = await POST(request);
            const responseData = await response.json();

            expect(response.status).toBe(200);
            expect(responseData.success).toBe(true);
            expect(mockMessageService.updateMessageMetadata).toHaveBeenCalledWith(
                'message-clicked-123',
                expect.objectContaining({
                    channelSpecific: expect.objectContaining({
                        clicked: true,
                        clickedAt: expect.any(String)
                    })
                })
            );
        });

        it('should reject webhooks with invalid signature', async () => {
            mockIntegration.validateWebhook.mockReturnValue(false);

            const webhookPayload = {
                type: 'email.sent',
                data: { email_id: 'test' }
            };

            const request = new NextRequest('http://localhost:3000/api/webhooks/email', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'resend-signature': 'invalid-signature'
                },
                body: JSON.stringify(webhookPayload)
            });

            const response = await POST(request);
            const responseData = await response.json();

            expect(response.status).toBe(401);
            expect(responseData.error).toBe('Invalid signature');
        });

        it('should handle unknown webhook types', async () => {
            const webhookPayload = {
                type: 'email.unknown',
                data: { email_id: 'test' }
            };

            const request = new NextRequest('http://localhost:3000/api/webhooks/email', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'resend-signature': 'valid-signature'
                },
                body: JSON.stringify(webhookPayload)
            });

            const response = await POST(request);
            const responseData = await response.json();

            expect(response.status).toBe(400);
            expect(responseData.error).toBe('Unknown webhook type');
        });

        it('should handle invalid webhook payload', async () => {
            const error = new Error('Invalid payload');
            (error as any).code = 'INVALID_WEBHOOK_PAYLOAD';
            mockIntegration.receive.mockRejectedValue(error);

            const webhookPayload = {
                type: 'email.sent',
                data: {} // Invalid payload
            };

            const request = new NextRequest('http://localhost:3000/api/webhooks/email', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'resend-signature': 'valid-signature'
                },
                body: JSON.stringify(webhookPayload)
            });

            const response = await POST(request);
            const responseData = await response.json();

            expect(response.status).toBe(400);
            expect(responseData.error).toBe('Invalid payload');
        });

        it('should handle internal server errors', async () => {
            mockIntegration.receive.mockRejectedValue(new Error('Database connection failed'));

            const webhookPayload = {
                type: 'email.sent',
                data: {
                    email_id: 'test',
                    from: 'sender@example.com',
                    to: ['test@example.com']
                }
            };

            const request = new NextRequest('http://localhost:3000/api/webhooks/email', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'resend-signature': 'valid-signature'
                },
                body: JSON.stringify(webhookPayload)
            });

            const response = await POST(request);
            const responseData = await response.json();

            expect(response.status).toBe(500);
            expect(responseData.error).toBe('Internal server error');
        });
    });

    describe('GET /api/webhooks/email', () => {
        it('should handle webhook verification challenge', async () => {
            const request = new NextRequest('http://localhost:3000/api/webhooks/email?challenge=test-challenge', {
                method: 'GET'
            });

            const response = await GET(request);
            const responseData = await response.json();

            expect(response.status).toBe(200);
            expect(responseData.challenge).toBe('test-challenge');
        });

        it('should return method not allowed for GET without challenge', async () => {
            const request = new NextRequest('http://localhost:3000/api/webhooks/email', {
                method: 'GET'
            });

            const response = await GET(request);
            const responseData = await response.json();

            expect(response.status).toBe(405);
            expect(responseData.error).toBe('Method not allowed');
        });
    });
});