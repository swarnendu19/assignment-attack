import { Server as SocketIOServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedSocket } from './server';

export interface MentionNotification {
    id: string;
    type: 'mention' | 'assignment' | 'message' | 'system';
    fromUserId: string;
    toUserId: string;
    contactId?: string;
    messageId?: string;
    noteId?: string;
    content: string;
    metadata?: Record<string, any>;
    isRead: boolean;
    createdAt: Date;
}

export interface NotificationPreferences {
    userId: string;
    mentions: boolean;
    assignments: boolean;
    newMessages: boolean;
    systemAlerts: boolean;
    emailNotifications: boolean;
    pushNotifications: boolean;
}

export class NotificationManager {
    private io: SocketIOServer;
    private prisma: PrismaClient;
    private mentionRegex = /@(\w+)/g;

    constructor(io: SocketIOServer, prisma: PrismaClient) {
        this.io = io;
        this.prisma = prisma;
    }

    public handleConnection(socket: AuthenticatedSocket) {
        // Handle notification events
        socket.on('notifications:mark_read', async (notificationIds: string[]) => {
            await this.markNotificationsAsRead(socket.userId, notificationIds);
        });

        socket.on('notifications:mark_all_read', async () => {
            await this.markAllNotificationsAsRead(socket.userId);
        });

        socket.on('notifications:get_unread_count', async () => {
            const count = await this.getUnreadNotificationCount(socket.userId);
            socket.emit('notifications:unread_count', count);
        });

        socket.on('notifications:get_recent', async (limit: number = 20) => {
            const notifications = await this.getRecentNotifications(socket.userId, limit);
            socket.emit('notifications:recent', notifications);
        });

        socket.on('notifications:update_preferences', async (preferences: Partial<NotificationPreferences>) => {
            await this.updateNotificationPreferences(socket.userId, preferences);
        });

        // Send initial unread count
        this.sendUnreadCount(socket);
    }

    // Process mentions in text content
    public async processMentions(content: string, fromUserId: string, context: {
        contactId?: string;
        messageId?: string;
        noteId?: string;
        type: 'message' | 'note' | 'comment';
    }) {
        const mentions = this.extractMentions(content);

        for (const mention of mentions) {
            const mentionedUser = await this.findUserByMention(mention);
            if (mentionedUser && mentionedUser.id !== fromUserId) {
                await this.createMentionNotification(fromUserId, mentionedUser.id, content, context);
            }
        }
    }

    // Create a mention notification
    private async createMentionNotification(
        fromUserId: string,
        toUserId: string,
        content: string,
        context: {
            contactId?: string;
            messageId?: string;
            noteId?: string;
            type: 'message' | 'note' | 'comment';
        }
    ) {
        try {
            // Get sender information
            const fromUser = await this.prisma.user.findUnique({
                where: { id: fromUserId },
                select: { id: true, name: true, email: true }
            });

            if (!fromUser) return;

            // Create notification record (we'll use audit log for now since there's no notification table)
            const notification = await this.prisma.auditLog.create({
                data: {
                    userId: toUserId,
                    action: 'MENTION',
                    resource: context.type,
                    resourceId: context.messageId || context.noteId || context.contactId,
                    metadata: {
                        fromUserId,
                        fromUser: fromUser,
                        content: content.substring(0, 200), // Truncate content
                        contactId: context.contactId,
                        messageId: context.messageId,
                        noteId: context.noteId,
                        type: 'mention',
                        isRead: false
                    }
                }
            });

            // Create notification object
            const mentionNotification: MentionNotification = {
                id: notification.id,
                type: 'mention',
                fromUserId,
                toUserId,
                contactId: context.contactId,
                messageId: context.messageId,
                noteId: context.noteId,
                content: `${fromUser.name || fromUser.email} mentioned you: ${content.substring(0, 100)}...`,
                metadata: {
                    fromUser,
                    originalContent: content,
                    context
                },
                isRead: false,
                createdAt: notification.createdAt
            };

            // Send real-time notification
            this.io.to(`user:${toUserId}`).emit('notifications:new_mention', mentionNotification);

            // Update unread count
            await this.sendUnreadCountToUser(toUserId);

            console.log(`Created mention notification from ${fromUser.email} to user ${toUserId}`);
        } catch (error) {
            console.error('Error creating mention notification:', error);
        }
    }

    // Create assignment notification
    public async createAssignmentNotification(assignedUserId: string, assignedByUserId: string, contactId: string) {
        try {
            const assignedByUser = await this.prisma.user.findUnique({
                where: { id: assignedByUserId },
                select: { id: true, name: true, email: true }
            });

            const contact = await this.prisma.contact.findUnique({
                where: { id: contactId },
                select: { id: true, name: true, phone: true, email: true }
            });

            if (!assignedByUser || !contact) return;

            const notification = await this.prisma.auditLog.create({
                data: {
                    userId: assignedUserId,
                    action: 'ASSIGNMENT',
                    resource: 'contact',
                    resourceId: contactId,
                    metadata: {
                        fromUserId: assignedByUserId,
                        fromUser: assignedByUser,
                        contact,
                        type: 'assignment',
                        isRead: false
                    }
                }
            });

            const assignmentNotification: MentionNotification = {
                id: notification.id,
                type: 'assignment',
                fromUserId: assignedByUserId,
                toUserId: assignedUserId,
                contactId,
                content: `${assignedByUser.name || assignedByUser.email} assigned you to ${contact.name || contact.phone || contact.email}`,
                metadata: {
                    fromUser: assignedByUser,
                    contact
                },
                isRead: false,
                createdAt: notification.createdAt
            };

            // Send real-time notification
            this.io.to(`user:${assignedUserId}`).emit('notifications:new_assignment', assignmentNotification);

            // Update unread count
            await this.sendUnreadCountToUser(assignedUserId);

            console.log(`Created assignment notification for user ${assignedUserId}`);
        } catch (error) {
            console.error('Error creating assignment notification:', error);
        }
    }

    // Create message notification
    public async createMessageNotification(messageId: string, contactId: string, excludeUserId?: string) {
        try {
            const message = await this.prisma.message.findUnique({
                where: { id: messageId },
                include: {
                    contact: {
                        select: { id: true, name: true, phone: true, email: true }
                    },
                    user: {
                        select: { id: true, name: true, email: true }
                    }
                }
            });

            if (!message) return;

            // Get users who should be notified (assigned user, recent participants)
            const assignment = await this.prisma.assignment.findUnique({
                where: { contactId },
                select: { userId: true }
            });

            const notifyUserIds: string[] = [];
            if (assignment && assignment.userId !== excludeUserId) {
                notifyUserIds.push(assignment.userId);
            }

            // Get recent message participants
            const recentParticipants = await this.prisma.message.findMany({
                where: {
                    contactId,
                    userId: { not: null },
                    createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
                },
                select: { userId: true },
                distinct: ['userId']
            });

            recentParticipants.forEach(participant => {
                if (participant.userId && participant.userId !== excludeUserId && !notifyUserIds.includes(participant.userId)) {
                    notifyUserIds.push(participant.userId);
                }
            });

            // Create notifications for each user
            for (const userId of notifyUserIds) {
                const notification = await this.prisma.auditLog.create({
                    data: {
                        userId,
                        action: 'NEW_MESSAGE',
                        resource: 'message',
                        resourceId: messageId,
                        metadata: {
                            contactId,
                            contact: message.contact,
                            message: {
                                id: message.id,
                                content: message.content,
                                channel: message.channel,
                                direction: message.direction
                            },
                            type: 'message',
                            isRead: false
                        }
                    }
                });

                const messageNotification: MentionNotification = {
                    id: notification.id,
                    type: 'message',
                    fromUserId: message.userId || 'system',
                    toUserId: userId,
                    contactId,
                    messageId,
                    content: `New message from ${message.contact.name || message.contact.phone || message.contact.email}`,
                    metadata: {
                        contact: message.contact,
                        message: message
                    },
                    isRead: false,
                    createdAt: notification.createdAt
                };

                // Send real-time notification
                this.io.to(`user:${userId}`).emit('notifications:new_message', messageNotification);
            }

            // Update unread counts
            for (const userId of notifyUserIds) {
                await this.sendUnreadCountToUser(userId);
            }

        } catch (error) {
            console.error('Error creating message notification:', error);
        }
    }

    // Extract mentions from text
    private extractMentions(content: string): string[] {
        const matches = content.match(this.mentionRegex);
        return matches ? matches.map(match => match.substring(1)) : [];
    }

    // Find user by mention (could be username, email, or name)
    private async findUserByMention(mention: string) {
        try {
            // Try to find by email first
            let user = await this.prisma.user.findUnique({
                where: { email: mention },
                select: { id: true, name: true, email: true }
            });

            if (!user) {
                // Try to find by name (case insensitive)
                user = await this.prisma.user.findFirst({
                    where: {
                        name: {
                            contains: mention,
                            mode: 'insensitive'
                        }
                    },
                    select: { id: true, name: true, email: true }
                });
            }

            return user;
        } catch (error) {
            console.error('Error finding user by mention:', error);
            return null;
        }
    }

    // Mark notifications as read
    private async markNotificationsAsRead(userId: string, notificationIds: string[]) {
        try {
            await this.prisma.auditLog.updateMany({
                where: {
                    id: { in: notificationIds },
                    userId
                },
                data: {
                    metadata: {
                        // This is a simplified approach - in a real app you'd want a proper notification table
                        isRead: true
                    }
                }
            });

            // Broadcast read status update
            this.io.to(`user:${userId}`).emit('notifications:marked_read', notificationIds);

            // Update unread count
            await this.sendUnreadCountToUser(userId);
        } catch (error) {
            console.error('Error marking notifications as read:', error);
        }
    }

    // Mark all notifications as read
    private async markAllNotificationsAsRead(userId: string) {
        try {
            // This is simplified - in a real app you'd have a proper notification table
            const notifications = await this.prisma.auditLog.findMany({
                where: {
                    userId,
                    action: { in: ['MENTION', 'ASSIGNMENT', 'NEW_MESSAGE'] }
                }
            });

            const notificationIds = notifications.map(n => n.id);
            await this.markNotificationsAsRead(userId, notificationIds);
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    }

    // Get unread notification count
    private async getUnreadNotificationCount(userId: string): Promise<number> {
        try {
            const count = await this.prisma.auditLog.count({
                where: {
                    userId,
                    action: { in: ['MENTION', 'ASSIGNMENT', 'NEW_MESSAGE'] },
                    // In a real app, you'd check isRead field in metadata or have a proper notification table
                }
            });

            return count;
        } catch (error) {
            console.error('Error getting unread notification count:', error);
            return 0;
        }
    }

    // Get recent notifications
    private async getRecentNotifications(userId: string, limit: number): Promise<MentionNotification[]> {
        try {
            const auditLogs = await this.prisma.auditLog.findMany({
                where: {
                    userId,
                    action: { in: ['MENTION', 'ASSIGNMENT', 'NEW_MESSAGE'] }
                },
                orderBy: { createdAt: 'desc' },
                take: limit
            });

            return auditLogs.map(log => ({
                id: log.id,
                type: log.action.toLowerCase() as 'mention' | 'assignment' | 'message',
                fromUserId: (log.metadata as any)?.fromUserId || 'system',
                toUserId: userId,
                contactId: (log.metadata as any)?.contactId,
                messageId: (log.metadata as any)?.messageId,
                noteId: (log.metadata as any)?.noteId,
                content: this.generateNotificationContent(log),
                metadata: log.metadata as any,
                isRead: (log.metadata as any)?.isRead || false,
                createdAt: log.createdAt
            }));
        } catch (error) {
            console.error('Error getting recent notifications:', error);
            return [];
        }
    }

    // Generate notification content based on audit log
    private generateNotificationContent(auditLog: any): string {
        const metadata = auditLog.metadata || {};

        switch (auditLog.action) {
            case 'MENTION':
                return `${metadata.fromUser?.name || 'Someone'} mentioned you`;
            case 'ASSIGNMENT':
                return `${metadata.fromUser?.name || 'Someone'} assigned you to ${metadata.contact?.name || 'a contact'}`;
            case 'NEW_MESSAGE':
                return `New message from ${metadata.contact?.name || 'a contact'}`;
            default:
                return 'New notification';
        }
    }

    // Update notification preferences
    private async updateNotificationPreferences(userId: string, preferences: Partial<NotificationPreferences>) {
        try {
            // Store preferences in user metadata or create a separate preferences table
            // For now, we'll use the user table's metadata field if it exists
            console.log(`Updated notification preferences for user ${userId}:`, preferences);
        } catch (error) {
            console.error('Error updating notification preferences:', error);
        }
    }

    // Send unread count to user
    private async sendUnreadCountToUser(userId: string) {
        const count = await this.getUnreadNotificationCount(userId);
        this.io.to(`user:${userId}`).emit('notifications:unread_count', count);
    }

    // Send initial unread count on connection
    private async sendUnreadCount(socket: AuthenticatedSocket) {
        const count = await this.getUnreadNotificationCount(socket.userId);
        socket.emit('notifications:unread_count', count);
    }
}