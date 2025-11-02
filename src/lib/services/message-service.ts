import { PrismaClient, MessageChannel, Direction, MessageStatus, Prisma } from '@prisma/client';
import {
    UnifiedMessage,
    CreateMessageInput,
    UpdateMessageInput,
    MessageFilters,
    MessageQueryOptions,
    MessageThread,
    NormalizationResult,
    WebhookPayload
} from '../types/message';
import { MessageNormalizer } from './message-normalizer';
import { generateThreadId, parseThreadId, isValidThreadId } from '../utils/thread-utils';
import { prisma } from '../prisma';

/**
 * MessageService handles all message-related operations including CRUD,
 * normalization, threading, and status tracking.
 */
export class MessageService {
    private prisma: PrismaClient;

    constructor(prismaClient?: PrismaClient) {
        this.prisma = prismaClient || prisma;
    }

    /**
     * Create a new message
     */
    async createMessage(input: CreateMessageInput): Promise<UnifiedMessage> {
        // Generate thread ID if not provided
        const threadId = generateThreadId({
            contactId: input.contactId,
            channel: input.channel,
            groupId: input.metadata?.channelSpecific?.groupId
        });

        // Prepare message data for database
        const messageData: Prisma.MessageCreateInput = {
            contact: { connect: { id: input.contactId } },
            user: input.userId ? { connect: { id: input.userId } } : undefined,
            channel: input.channel,
            direction: input.direction,
            content: input.content as Prisma.JsonObject,
            metadata: input.metadata as Prisma.JsonObject,
            status: input.direction === 'OUTBOUND' ? 'PENDING' : 'DELIVERED',
            threadId,
            scheduledAt: input.scheduledAt
        };

        const createdMessage = await this.prisma.message.create({
            data: messageData,
            include: {
                contact: true,
                user: true
            }
        });

        return this.mapToUnifiedMessage(createdMessage);
    }

    /**
     * Get a message by ID
     */
    async getMessageById(id: string): Promise<UnifiedMessage | null> {
        const message = await this.prisma.message.findUnique({
            where: { id },
            include: {
                contact: true,
                user: true
            }
        });

        return message ? this.mapToUnifiedMessage(message) : null;
    }

    /**
     * Update a message
     */
    async updateMessage(id: string, input: UpdateMessageInput): Promise<UnifiedMessage> {
        const updateData: Prisma.MessageUpdateInput = {};

        if (input.content) {
            updateData.content = input.content as Prisma.JsonObject;
        }

        if (input.status) {
            updateData.status = input.status;

            // Set sentAt timestamp when status changes to SENT
            if (input.status === 'SENT' && !input.sentAt) {
                updateData.sentAt = new Date();
            }
        }

        if (input.metadata) {
            updateData.metadata = input.metadata as Prisma.JsonObject;
        }

        if (input.sentAt) {
            updateData.sentAt = input.sentAt;
        }

        const updatedMessage = await this.prisma.message.update({
            where: { id },
            data: updateData,
            include: {
                contact: true,
                user: true
            }
        });

        return this.mapToUnifiedMessage(updatedMessage);
    }

    /**
     * Delete a message
     */
    async deleteMessage(id: string): Promise<void> {
        await this.prisma.message.delete({
            where: { id }
        });
    }

    /**
     * Get messages with filtering and pagination
     */
    async getMessages(
        filters: MessageFilters = {},
        options: MessageQueryOptions = {}
    ): Promise<{
        messages: UnifiedMessage[];
        total: number;
        hasMore: boolean;
    }> {
        const {
            limit = 50,
            offset = 0,
            orderBy = 'createdAt',
            orderDirection = 'desc',
            includeContact = true,
            includeUser = true
        } = options;

        // Build where clause
        const where: Prisma.MessageWhereInput = {};

        if (filters.contactId) {
            where.contactId = filters.contactId;
        }

        if (filters.userId) {
            where.userId = filters.userId;
        }

        if (filters.channel) {
            where.channel = filters.channel;
        }

        if (filters.direction) {
            where.direction = filters.direction;
        }

        if (filters.status) {
            where.status = filters.status;
        }

        if (filters.threadId) {
            where.threadId = filters.threadId;
        }

        if (filters.dateFrom || filters.dateTo) {
            where.createdAt = {};
            if (filters.dateFrom) {
                where.createdAt.gte = filters.dateFrom;
            }
            if (filters.dateTo) {
                where.createdAt.lte = filters.dateTo;
            }
        }

        if (filters.searchText) {
            where.OR = [
                {
                    content: {
                        path: ['text'],
                        string_contains: filters.searchText
                    }
                },
                {
                    content: {
                        path: ['subject'],
                        string_contains: filters.searchText
                    }
                }
            ];
        }

        // Execute queries
        const [messages, total] = await Promise.all([
            this.prisma.message.findMany({
                where,
                include: {
                    contact: includeContact,
                    user: includeUser
                },
                orderBy: { [orderBy]: orderDirection },
                take: limit,
                skip: offset
            }),
            this.prisma.message.count({ where })
        ]);

        return {
            messages: messages.map(msg => this.mapToUnifiedMessage(msg)),
            total,
            hasMore: offset + messages.length < total
        };
    }

    /**
     * Get messages by thread ID
     */
    async getMessagesByThread(
        threadId: string,
        options: MessageQueryOptions = {}
    ): Promise<UnifiedMessage[]> {
        if (!isValidThreadId(threadId)) {
            throw new Error(`Invalid thread ID: ${threadId}`);
        }

        const result = await this.getMessages(
            { threadId },
            { ...options, orderDirection: 'asc' }
        );

        return result.messages;
    }

    /**
     * Get thread information
     */
    async getThreadInfo(threadId: string): Promise<MessageThread | null> {
        if (!isValidThreadId(threadId)) {
            throw new Error(`Invalid thread ID: ${threadId}`);
        }

        const threadData = parseThreadId(threadId);

        const [messageCount, lastMessage, unreadCount] = await Promise.all([
            this.prisma.message.count({
                where: { threadId }
            }),
            this.prisma.message.findFirst({
                where: { threadId },
                orderBy: { createdAt: 'desc' }
            }),
            this.prisma.message.count({
                where: {
                    threadId,
                    status: { not: 'READ' },
                    direction: 'INBOUND'
                }
            })
        ]);

        if (messageCount === 0) {
            return null;
        }

        // Get unique participants (users who sent messages in this thread)
        const participants = await this.prisma.message.findMany({
            where: {
                threadId,
                userId: { not: null }
            },
            select: { userId: true },
            distinct: ['userId']
        });

        return {
            threadId,
            contactId: threadData.contactId,
            channel: threadData.channel as MessageChannel,
            messageCount,
            lastMessageAt: lastMessage?.createdAt || new Date(),
            unreadCount,
            participants: participants.map(p => p.userId!).filter(Boolean)
        };
    }

    /**
     * Get all threads for a contact
     */
    async getContactThreads(contactId: string): Promise<MessageThread[]> {
        const threads = await this.prisma.message.groupBy({
            by: ['threadId'],
            where: { contactId },
            _count: { id: true },
            _max: { createdAt: true }
        });

        const threadInfoPromises = threads.map(async (thread) => {
            const threadInfo = await this.getThreadInfo(thread.threadId);
            return threadInfo;
        });

        const threadInfos = await Promise.all(threadInfoPromises);
        return threadInfos.filter((info): info is MessageThread => info !== null);
    }

    /**
     * Update message status
     */
    async updateMessageStatus(
        id: string,
        status: MessageStatus,
        metadata?: Record<string, any>
    ): Promise<UnifiedMessage> {
        const updateInput: UpdateMessageInput = { status };

        if (metadata) {
            updateInput.metadata = metadata;
        }

        return this.updateMessage(id, updateInput);
    }

    /**
     * Mark messages as read
     */
    async markMessagesAsRead(
        messageIds: string[],
        userId?: string
    ): Promise<number> {
        const updateData: Prisma.MessageUpdateManyArgs = {
            where: {
                id: { in: messageIds },
                status: { not: 'READ' }
            },
            data: {
                status: 'READ',
                updatedAt: new Date()
            }
        };

        const result = await this.prisma.message.updateMany(updateData);
        return result.count;
    }

    /**
     * Mark thread as read
     */
    async markThreadAsRead(threadId: string, userId?: string): Promise<number> {
        const result = await this.prisma.message.updateMany({
            where: {
                threadId,
                direction: 'INBOUND',
                status: { not: 'READ' }
            },
            data: {
                status: 'READ',
                updatedAt: new Date()
            }
        });

        return result.count;
    }

    /**
     * Process webhook payload and create message
     */
    async processWebhook(payload: WebhookPayload): Promise<NormalizationResult> {
        try {
            // Normalize the webhook payload
            const normalizationResult = await MessageNormalizer.normalize(payload);

            if (!normalizationResult.success || !normalizationResult.message) {
                return normalizationResult;
            }

            // Create the message in database
            const createInput: CreateMessageInput = {
                contactId: normalizationResult.message.contactId,
                userId: normalizationResult.message.userId,
                channel: normalizationResult.message.channel,
                direction: normalizationResult.message.direction,
                content: normalizationResult.message.content,
                metadata: normalizationResult.message.metadata
            };

            const createdMessage = await this.createMessage(createInput);

            return {
                success: true,
                message: createdMessage
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to process webhook'
            };
        }
    }

    /**
     * Get scheduled messages
     */
    async getScheduledMessages(
        filters: { userId?: string; channel?: MessageChannel } = {}
    ): Promise<UnifiedMessage[]> {
        const where: Prisma.MessageWhereInput = {
            status: 'SCHEDULED',
            scheduledAt: { not: null }
        };

        if (filters.userId) {
            where.userId = filters.userId;
        }

        if (filters.channel) {
            where.channel = filters.channel;
        }

        const messages = await this.prisma.message.findMany({
            where,
            include: {
                contact: true,
                user: true
            },
            orderBy: { scheduledAt: 'asc' }
        });

        return messages.map(msg => this.mapToUnifiedMessage(msg));
    }

    /**
     * Get messages ready for sending (scheduled messages that are due)
     */
    async getMessagesReadyForSending(): Promise<UnifiedMessage[]> {
        const messages = await this.prisma.message.findMany({
            where: {
                status: 'SCHEDULED',
                scheduledAt: {
                    lte: new Date()
                }
            },
            include: {
                contact: true,
                user: true
            },
            orderBy: { scheduledAt: 'asc' }
        });

        return messages.map(msg => this.mapToUnifiedMessage(msg));
    }

    /**
     * Map database message to UnifiedMessage interface
     */
    private mapToUnifiedMessage(message: any): UnifiedMessage {
        return {
            id: message.id,
            contactId: message.contactId,
            userId: message.userId,
            channel: message.channel,
            direction: message.direction,
            content: message.content,
            metadata: message.metadata || {},
            status: message.status,
            threadId: message.threadId,
            scheduledAt: message.scheduledAt,
            sentAt: message.sentAt,
            createdAt: message.createdAt,
            updatedAt: message.updatedAt
        };
    }
}