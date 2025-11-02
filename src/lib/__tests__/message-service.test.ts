import { MessageService } from '../services/message-service';
import { CreateMessageInput, UpdateMessageInput, MessageFilters } from '../types/message';
import { PrismaClient } from '@prisma/client';

// Mock Prisma client
const mockPrisma = {
    message: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        groupBy: jest.fn(),
        updateMany: jest.fn()
    }
} as unknown as PrismaClient;

// Mock thread utils
jest.mock('../utils/thread-utils', () => ({
    generateThreadId: jest.fn(({ contactId, channel }) => `${contactId}_${channel.toLowerCase()}`),
    parseThreadId: jest.fn((threadId) => {
        const parts = threadId.split('_');
        return {
            contactId: parts[0],
            channel: parts[1].toUpperCase(),
            groupId: parts.length > 2 ? parts.slice(2).join('_') : undefined
        };
    }),
    isValidThreadId: jest.fn((threadId) => threadId.includes('_'))
}));

describe('MessageService', () => {
    let messageService: MessageService;

    beforeEach(() => {
        messageService = new MessageService(mockPrisma);
        jest.clearAllMocks();
    });

    describe('createMessage', () => {
        it('should create a new message successfully', async () => {
            const input: CreateMessageInput = {
                contactId: 'contact_123',
                userId: 'user_456',
                channel: 'SMS',
                direction: 'OUTBOUND',
                content: {
                    text: 'Hello, world!',
                    type: 'text'
                }
            };

            const mockCreatedMessage = {
                id: 'msg_789',
                contactId: 'contact_123',
                userId: 'user_456',
                channel: 'SMS',
                direction: 'OUTBOUND',
                content: { text: 'Hello, world!', type: 'text' },
                metadata: {},
                status: 'PENDING',
                threadId: 'contact_123_sms',
                scheduledAt: null,
                sentAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                contact: { id: 'contact_123', name: 'John Doe' },
                user: { id: 'user_456', name: 'Jane Smith' }
            };

            mockPrisma.message.create = jest.fn().mockResolvedValue(mockCreatedMessage);

            const result = await messageService.createMessage(input);

            expect(mockPrisma.message.create).toHaveBeenCalledWith({
                data: {
                    contact: { connect: { id: 'contact_123' } },
                    user: { connect: { id: 'user_456' } },
                    channel: 'SMS',
                    direction: 'OUTBOUND',
                    content: { text: 'Hello, world!', type: 'text' },
                    metadata: undefined,
                    status: 'PENDING',
                    threadId: 'contact_123_sms',
                    scheduledAt: undefined
                },
                include: {
                    contact: true,
                    user: true
                }
            });

            expect(result.id).toBe('msg_789');
            expect(result.threadId).toBe('contact_123_sms');
            expect(result.status).toBe('PENDING');
        });

        it('should create inbound message with DELIVERED status', async () => {
            const input: CreateMessageInput = {
                contactId: 'contact_123',
                channel: 'SMS',
                direction: 'INBOUND',
                content: {
                    text: 'Hello back!',
                    type: 'text'
                }
            };

            const mockCreatedMessage = {
                id: 'msg_789',
                contactId: 'contact_123',
                userId: null,
                channel: 'SMS',
                direction: 'INBOUND',
                content: { text: 'Hello back!', type: 'text' },
                metadata: {},
                status: 'DELIVERED',
                threadId: 'contact_123_sms',
                scheduledAt: null,
                sentAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                contact: { id: 'contact_123', name: 'John Doe' },
                user: null
            };

            mockPrisma.message.create = jest.fn().mockResolvedValue(mockCreatedMessage);

            const result = await messageService.createMessage(input);

            expect(result.status).toBe('DELIVERED');
            expect(result.direction).toBe('INBOUND');
        });

        it('should handle scheduled messages', async () => {
            const scheduledAt = new Date(Date.now() + 3600000); // 1 hour from now
            const input: CreateMessageInput = {
                contactId: 'contact_123',
                channel: 'SMS',
                direction: 'OUTBOUND',
                content: {
                    text: 'Scheduled message',
                    type: 'text'
                },
                scheduledAt
            };

            const mockCreatedMessage = {
                id: 'msg_789',
                contactId: 'contact_123',
                userId: null,
                channel: 'SMS',
                direction: 'OUTBOUND',
                content: { text: 'Scheduled message', type: 'text' },
                metadata: {},
                status: 'PENDING',
                threadId: 'contact_123_sms',
                scheduledAt,
                sentAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                contact: { id: 'contact_123', name: 'John Doe' },
                user: null
            };

            mockPrisma.message.create = jest.fn().mockResolvedValue(mockCreatedMessage);

            const result = await messageService.createMessage(input);

            expect(result.scheduledAt).toEqual(scheduledAt);
        });
    });

    describe('getMessageById', () => {
        it('should return message when found', async () => {
            const mockMessage = {
                id: 'msg_123',
                contactId: 'contact_456',
                userId: 'user_789',
                channel: 'SMS',
                direction: 'INBOUND',
                content: { text: 'Test message', type: 'text' },
                metadata: {},
                status: 'DELIVERED',
                threadId: 'contact_456_sms',
                scheduledAt: null,
                sentAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                contact: { id: 'contact_456', name: 'John Doe' },
                user: { id: 'user_789', name: 'Jane Smith' }
            };

            mockPrisma.message.findUnique = jest.fn().mockResolvedValue(mockMessage);

            const result = await messageService.getMessageById('msg_123');

            expect(mockPrisma.message.findUnique).toHaveBeenCalledWith({
                where: { id: 'msg_123' },
                include: {
                    contact: true,
                    user: true
                }
            });

            expect(result).toBeDefined();
            expect(result!.id).toBe('msg_123');
        });

        it('should return null when message not found', async () => {
            mockPrisma.message.findUnique = jest.fn().mockResolvedValue(null);

            const result = await messageService.getMessageById('nonexistent');

            expect(result).toBeNull();
        });
    });

    describe('updateMessage', () => {
        it('should update message content', async () => {
            const updateInput: UpdateMessageInput = {
                content: {
                    text: 'Updated message text',
                    type: 'text'
                }
            };

            const mockUpdatedMessage = {
                id: 'msg_123',
                contactId: 'contact_456',
                userId: 'user_789',
                channel: 'SMS',
                direction: 'OUTBOUND',
                content: { text: 'Updated message text', type: 'text' },
                metadata: {},
                status: 'PENDING',
                threadId: 'contact_456_sms',
                scheduledAt: null,
                sentAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                contact: { id: 'contact_456', name: 'John Doe' },
                user: { id: 'user_789', name: 'Jane Smith' }
            };

            mockPrisma.message.update = jest.fn().mockResolvedValue(mockUpdatedMessage);

            const result = await messageService.updateMessage('msg_123', updateInput);

            expect(mockPrisma.message.update).toHaveBeenCalledWith({
                where: { id: 'msg_123' },
                data: {
                    content: { text: 'Updated message text', type: 'text' }
                },
                include: {
                    contact: true,
                    user: true
                }
            });

            expect(result.content.text).toBe('Updated message text');
        });

        it('should update message status and set sentAt when status is SENT', async () => {
            const updateInput: UpdateMessageInput = {
                status: 'SENT'
            };

            const mockUpdatedMessage = {
                id: 'msg_123',
                contactId: 'contact_456',
                userId: 'user_789',
                channel: 'SMS',
                direction: 'OUTBOUND',
                content: { text: 'Test message', type: 'text' },
                metadata: {},
                status: 'SENT',
                threadId: 'contact_456_sms',
                scheduledAt: null,
                sentAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
                contact: { id: 'contact_456', name: 'John Doe' },
                user: { id: 'user_789', name: 'Jane Smith' }
            };

            mockPrisma.message.update = jest.fn().mockResolvedValue(mockUpdatedMessage);

            const result = await messageService.updateMessage('msg_123', updateInput);

            expect(mockPrisma.message.update).toHaveBeenCalledWith({
                where: { id: 'msg_123' },
                data: {
                    status: 'SENT',
                    sentAt: expect.any(Date)
                },
                include: {
                    contact: true,
                    user: true
                }
            });

            expect(result.status).toBe('SENT');
            expect(result.sentAt).toBeDefined();
        });
    });

    describe('getMessages', () => {
        it('should return messages with default options', async () => {
            const mockMessages = [
                {
                    id: 'msg_1',
                    contactId: 'contact_123',
                    userId: 'user_456',
                    channel: 'SMS',
                    direction: 'INBOUND',
                    content: { text: 'Message 1', type: 'text' },
                    metadata: {},
                    status: 'DELIVERED',
                    threadId: 'contact_123_sms',
                    scheduledAt: null,
                    sentAt: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    contact: { id: 'contact_123', name: 'John Doe' },
                    user: { id: 'user_456', name: 'Jane Smith' }
                }
            ];

            mockPrisma.message.findMany = jest.fn().mockResolvedValue(mockMessages);
            mockPrisma.message.count = jest.fn().mockResolvedValue(1);

            const result = await messageService.getMessages();

            expect(mockPrisma.message.findMany).toHaveBeenCalledWith({
                where: {},
                include: {
                    contact: true,
                    user: true
                },
                orderBy: { createdAt: 'desc' },
                take: 50,
                skip: 0
            });

            expect(result.messages).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(result.hasMore).toBe(false);
        });

        it('should apply filters correctly', async () => {
            const filters: MessageFilters = {
                contactId: 'contact_123',
                channel: 'SMS',
                status: 'DELIVERED',
                searchText: 'hello'
            };

            mockPrisma.message.findMany = jest.fn().mockResolvedValue([]);
            mockPrisma.message.count = jest.fn().mockResolvedValue(0);

            await messageService.getMessages(filters);

            expect(mockPrisma.message.findMany).toHaveBeenCalledWith({
                where: {
                    contactId: 'contact_123',
                    channel: 'SMS',
                    status: 'DELIVERED',
                    OR: [
                        {
                            content: {
                                path: ['text'],
                                string_contains: 'hello'
                            }
                        },
                        {
                            content: {
                                path: ['subject'],
                                string_contains: 'hello'
                            }
                        }
                    ]
                },
                include: {
                    contact: true,
                    user: true
                },
                orderBy: { createdAt: 'desc' },
                take: 50,
                skip: 0
            });
        });

        it('should apply date range filters', async () => {
            const dateFrom = new Date('2024-01-01');
            const dateTo = new Date('2024-01-31');
            const filters: MessageFilters = {
                dateFrom,
                dateTo
            };

            mockPrisma.message.findMany = jest.fn().mockResolvedValue([]);
            mockPrisma.message.count = jest.fn().mockResolvedValue(0);

            await messageService.getMessages(filters);

            expect(mockPrisma.message.findMany).toHaveBeenCalledWith({
                where: {
                    createdAt: {
                        gte: dateFrom,
                        lte: dateTo
                    }
                },
                include: {
                    contact: true,
                    user: true
                },
                orderBy: { createdAt: 'desc' },
                take: 50,
                skip: 0
            });
        });
    });

    describe('getMessagesByThread', () => {
        it('should return messages for valid thread ID', async () => {
            const threadId = 'contact_123_sms';
            const mockMessages = [
                {
                    id: 'msg_1',
                    contactId: 'contact_123',
                    userId: null,
                    channel: 'SMS',
                    direction: 'INBOUND',
                    content: { text: 'Message 1', type: 'text' },
                    metadata: {},
                    status: 'DELIVERED',
                    threadId,
                    scheduledAt: null,
                    sentAt: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    contact: { id: 'contact_123', name: 'John Doe' },
                    user: null
                }
            ];

            mockPrisma.message.findMany = jest.fn().mockResolvedValue(mockMessages);
            mockPrisma.message.count = jest.fn().mockResolvedValue(1);

            const result = await messageService.getMessagesByThread(threadId);

            expect(mockPrisma.message.findMany).toHaveBeenCalledWith({
                where: { threadId },
                include: {
                    contact: true,
                    user: true
                },
                orderBy: { createdAt: 'asc' },
                take: 50,
                skip: 0
            });

            expect(result).toHaveLength(1);
            expect(result[0].threadId).toBe(threadId);
        });

        it('should throw error for invalid thread ID', async () => {
            await expect(messageService.getMessagesByThread('invalid')).rejects.toThrow(
                'Invalid thread ID: invalid'
            );
        });
    });

    describe('markMessagesAsRead', () => {
        it('should mark multiple messages as read', async () => {
            const messageIds = ['msg_1', 'msg_2', 'msg_3'];

            mockPrisma.message.updateMany = jest.fn().mockResolvedValue({ count: 3 });

            const result = await messageService.markMessagesAsRead(messageIds);

            expect(mockPrisma.message.updateMany).toHaveBeenCalledWith({
                where: {
                    id: { in: messageIds },
                    status: { not: 'READ' }
                },
                data: {
                    status: 'READ',
                    updatedAt: expect.any(Date)
                }
            });

            expect(result).toBe(3);
        });
    });

    describe('markThreadAsRead', () => {
        it('should mark all inbound messages in thread as read', async () => {
            const threadId = 'contact_123_sms';

            mockPrisma.message.updateMany = jest.fn().mockResolvedValue({ count: 2 });

            const result = await messageService.markThreadAsRead(threadId);

            expect(mockPrisma.message.updateMany).toHaveBeenCalledWith({
                where: {
                    threadId,
                    direction: 'INBOUND',
                    status: { not: 'READ' }
                },
                data: {
                    status: 'READ',
                    updatedAt: expect.any(Date)
                }
            });

            expect(result).toBe(2);
        });
    });

    describe('getScheduledMessages', () => {
        it('should return scheduled messages', async () => {
            const mockScheduledMessages = [
                {
                    id: 'msg_1',
                    contactId: 'contact_123',
                    userId: 'user_456',
                    channel: 'SMS',
                    direction: 'OUTBOUND',
                    content: { text: 'Scheduled message', type: 'text' },
                    metadata: {},
                    status: 'SCHEDULED',
                    threadId: 'contact_123_sms',
                    scheduledAt: new Date(Date.now() + 3600000),
                    sentAt: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    contact: { id: 'contact_123', name: 'John Doe' },
                    user: { id: 'user_456', name: 'Jane Smith' }
                }
            ];

            mockPrisma.message.findMany = jest.fn().mockResolvedValue(mockScheduledMessages);

            const result = await messageService.getScheduledMessages();

            expect(mockPrisma.message.findMany).toHaveBeenCalledWith({
                where: {
                    status: 'SCHEDULED',
                    scheduledAt: { not: null }
                },
                include: {
                    contact: true,
                    user: true
                },
                orderBy: { scheduledAt: 'asc' }
            });

            expect(result).toHaveLength(1);
            expect(result[0].status).toBe('SCHEDULED');
        });
    });

    describe('getMessagesReadyForSending', () => {
        it('should return messages scheduled for now or past', async () => {
            const pastDate = new Date(Date.now() - 3600000); // 1 hour ago
            const mockReadyMessages = [
                {
                    id: 'msg_1',
                    contactId: 'contact_123',
                    userId: 'user_456',
                    channel: 'SMS',
                    direction: 'OUTBOUND',
                    content: { text: 'Ready to send', type: 'text' },
                    metadata: {},
                    status: 'SCHEDULED',
                    threadId: 'contact_123_sms',
                    scheduledAt: pastDate,
                    sentAt: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    contact: { id: 'contact_123', name: 'John Doe' },
                    user: { id: 'user_456', name: 'Jane Smith' }
                }
            ];

            mockPrisma.message.findMany = jest.fn().mockResolvedValue(mockReadyMessages);

            const result = await messageService.getMessagesReadyForSending();

            expect(mockPrisma.message.findMany).toHaveBeenCalledWith({
                where: {
                    status: 'SCHEDULED',
                    scheduledAt: {
                        lte: expect.any(Date)
                    }
                },
                include: {
                    contact: true,
                    user: true
                },
                orderBy: { scheduledAt: 'asc' }
            });

            expect(result).toHaveLength(1);
        });
    });
});