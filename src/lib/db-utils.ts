import { prisma } from './prisma';
import { Prisma } from '@prisma/client';

// Type definitions for common query options
export type PaginationOptions = {
    page?: number;
    limit?: number;
};

export type SortOptions<T> = {
    field: keyof T;
    direction: 'asc' | 'desc';
};

// Generic pagination helper
export function getPaginationParams(options: PaginationOptions = {}) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    return { skip, take: limit, page, limit };
}

// Contact search and filtering utilities
export class ContactQueries {
    static async searchContacts(
        query: string,
        options: PaginationOptions = {}
    ) {
        const { skip, take } = getPaginationParams(options);

        const where: Prisma.ContactWhereInput = {
            OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { email: { contains: query, mode: 'insensitive' } },
                { phone: { contains: query } },
            ],
        };

        const [contacts, total] = await Promise.all([
            prisma.contact.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    messages: {
                        take: 1,
                        orderBy: { createdAt: 'desc' },
                    },
                    notes: {
                        take: 3,
                        orderBy: { createdAt: 'desc' },
                    },
                    assignments: {
                        include: { user: true },
                    },
                },
            }),
            prisma.contact.count({ where }),
        ]);

        return {
            contacts,
            pagination: {
                total,
                page: Math.floor(skip / take) + 1,
                limit: take,
                totalPages: Math.ceil(total / take),
            },
        };
    }

    static async findDuplicateContacts(contactId: string) {
        const contact = await prisma.contact.findUnique({
            where: { id: contactId },
        });

        if (!contact) return [];

        const duplicates = await prisma.contact.findMany({
            where: {
                AND: [
                    { id: { not: contactId } },
                    {
                        OR: [
                            contact.email ? { email: contact.email } : {},
                            contact.phone ? { phone: contact.phone } : {},
                            contact.name ? {
                                name: {
                                    contains: contact.name,
                                    mode: 'insensitive'
                                }
                            } : {},
                        ].filter(condition => Object.keys(condition).length > 0),
                    },
                ],
            },
        });

        return duplicates;
    }
}

// Message queries and utilities
export class MessageQueries {
    static async getMessageThread(
        contactId: string,
        channel?: string,
        options: PaginationOptions = {}
    ) {
        const { skip, take } = getPaginationParams(options);

        const where: Prisma.MessageWhereInput = {
            contactId,
            ...(channel && { channel: channel as any }),
        };

        const [messages, total] = await Promise.all([
            prisma.message.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: true,
                    contact: true,
                },
            }),
            prisma.message.count({ where }),
        ]);

        return {
            messages: messages.reverse(), // Show oldest first in thread
            pagination: {
                total,
                page: Math.floor(skip / take) + 1,
                limit: take,
                totalPages: Math.ceil(total / take),
            },
        };
    }

    static async getUnreadMessageCount(userId?: string) {
        const where: Prisma.MessageWhereInput = {
            direction: 'INBOUND',
            status: { not: 'READ' },
            ...(userId && {
                contact: {
                    assignments: {
                        some: { userId },
                    },
                },
            }),
        };

        return await prisma.message.count({ where });
    }

    static async markMessagesAsRead(messageIds: string[], userId: string) {
        return await prisma.message.updateMany({
            where: {
                id: { in: messageIds },
                direction: 'INBOUND',
            },
            data: {
                status: 'READ',
                updatedAt: new Date(),
            },
        });
    }
}

// Analytics and reporting utilities
export class AnalyticsQueries {
    static async getMessageStats(
        startDate: Date,
        endDate: Date,
        userId?: string
    ) {
        const where: Prisma.MessageWhereInput = {
            createdAt: {
                gte: startDate,
                lte: endDate,
            },
            ...(userId && { userId }),
        };

        const [
            totalMessages,
            sentMessages,
            receivedMessages,
            channelStats,
        ] = await Promise.all([
            prisma.message.count({ where }),
            prisma.message.count({
                where: { ...where, direction: 'OUTBOUND' }
            }),
            prisma.message.count({
                where: { ...where, direction: 'INBOUND' }
            }),
            prisma.message.groupBy({
                by: ['channel'],
                where,
                _count: { id: true },
            }),
        ]);

        return {
            totalMessages,
            sentMessages,
            receivedMessages,
            channelBreakdown: channelStats.map(stat => ({
                channel: stat.channel,
                count: stat._count.id,
            })),
        };
    }

    static async getResponseTimeStats(
        startDate: Date,
        endDate: Date,
        userId?: string
    ) {
        // This would require more complex SQL to calculate response times
        // For now, return a placeholder structure
        return {
            averageResponseTime: 0,
            medianResponseTime: 0,
            responseTimeByChannel: [],
        };
    }
}

// Audit logging utilities
export class AuditLogger {
    static async log(
        action: string,
        resource: string,
        resourceId?: string,
        userId?: string,
        metadata?: any,
        request?: { ip?: string; userAgent?: string }
    ) {
        return await prisma.auditLog.create({
            data: {
                action,
                resource,
                resourceId,
                userId,
                metadata,
                ipAddress: request?.ip,
                userAgent: request?.userAgent,
            },
        });
    }

    static async getAuditTrail(
        resource: string,
        resourceId: string,
        options: PaginationOptions = {}
    ) {
        const { skip, take } = getPaginationParams(options);

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where: { resource, resourceId },
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: { user: true },
            }),
            prisma.auditLog.count({
                where: { resource, resourceId },
            }),
        ]);

        return {
            logs,
            pagination: {
                total,
                page: Math.floor(skip / take) + 1,
                limit: take,
                totalPages: Math.ceil(total / take),
            },
        };
    }
}

// Database maintenance utilities
export class DatabaseMaintenance {
    static async cleanupOldAuditLogs(daysToKeep: number = 90) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        const result = await prisma.auditLog.deleteMany({
            where: {
                createdAt: { lt: cutoffDate },
            },
        });

        return result.count;
    }

    static async cleanupFailedJobs(daysToKeep: number = 7) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        const result = await prisma.scheduledJob.deleteMany({
            where: {
                status: 'FAILED',
                createdAt: { lt: cutoffDate },
            },
        });

        return result.count;
    }

    static async getTableSizes() {
        const tables = [
            'users', 'contacts', 'messages', 'notes', 'integrations',
            'assignments', 'presence', 'audit_logs', 'scheduled_jobs', 'templates'
        ];

        const sizes = await Promise.all(
            tables.map(async (table) => {
                const result = await prisma.$queryRawUnsafe(`
          SELECT 
            schemaname,
            tablename,
            attname,
            n_distinct,
            correlation
          FROM pg_stats 
          WHERE tablename = '${table}'
          LIMIT 1
        `) as any[];

                return {
                    table,
                    exists: result.length > 0,
                };
            })
        );

        return sizes;
    }
}