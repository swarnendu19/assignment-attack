imps
er)
this.io.to(`contact:${contactId}`).except(`user:${userId}`).emit('typing:indicator', typingEvent);

console.log(`User ${userInfo.email} ${isTyping ? 'started' : 'stopped'} typing in contact ${contactId}`);
  }

  // Broadcast bulk message updates (for batch operations)
  public async broadcastBulkMessageUpdate(contactId: string, messageIds: string[]) {
    try {
        const messages = await this.prisma.message.findMany({
            where: {
                id: { in: messageIds },
                contactId
            },
            include: {
                contact: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        email: true
                    }
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });

        const event = {
            type: 'message:bulk_update' as const,
            contactId,
            messages,
            timestamp: new Date()
        };

        // Broadcast to contact room
        this.io.to(`contact:${contactId}`).emit('message:bulk_update', event);

        console.log(`Broadcasted bulk update for ${messageIds.length} messages in contact ${contactId}`);
    } catch (error) {
        console.error('Error broadcasting bulk message update:', error);
    }
}

  // Broadcast thread updates
  public async broadcastThreadUpdate(threadId: string) {
    try {
        const messages = await this.prisma.message.findMany({
            where: { threadId },
            include: {
                contact: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        email: true
                    }
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            },
            orderBy: { createdAt: 'asc' }
        });

        if (messages.length === 0) return;

        const contactId = messages[0].contactId;
        const event = {
            type: 'thread:updated' as const,
            threadId,
            contactId,
            messages,
            timestamp: new Date()
        };

        // Broadcast to contact room
        this.io.to(`contact:${contactId}`).emit('thread:updated', event);

        console.log(`Broadcasted thread update for ${threadId}`);
    } catch (error) {
        console.error('Error broadcasting thread update:', error);
    }
}

  // Broadcast contact assignment changes
  public async broadcastContactAssignment(contactId: string, userId: string | null, assignedBy ?: string) {
    try {
        let assignedUser = null;
        let assignedByUser = null;

        if (userId) {
            assignedUser = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, name: true, email: true }
            });
        }

        if (assignedBy) {
            assignedByUser = await this.prisma.user.findUnique({
                where: { id: assignedBy },
                select: { id: true, name: true, email: true }
            });
        }

        const event = {
            type: 'contact:assignment_changed' as const,
            contactId,
            assignedUser,
            assignedByUser,
            timestamp: new Date()
        };

        // Broadcast to contact room
        this.io.to(`contact:${contactId}`).emit('contact:assignment_changed', event);

        // Broadcast to assigned user
        if (userId) {
            this.io.to(`user:${userId}`).emit('contact:assigned_to_me', event);
        }

        console.log(`Broadcasted contact assignment change for ${contactId}`);
    } catch (error) {
        console.error('Error broadcasting contact assignment:', error);
    }
}

  // Get message with full details for broadcasting
  private async getMessageWithDetails(messageId: string): Promise < MessageWithContact | null > {
    try {
        const message = await this.prisma.message.findUnique({
            where: { id: messageId },
            include: {
                contact: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        email: true
                    }
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });

        return message as MessageWithContact | null;
    } catch(error) {
        console.error('Error getting message details:', error);
        return null;
    }
}

  // Broadcast system notifications
  public broadcastSystemNotification(type: 'info' | 'warning' | 'error' | 'success', message: string, targetUsers ?: string[]) {
    const notification = {
        type,
        message,
        timestamp: new Date(),
        id: `notification_${Date.now()}`
    };

    if (targetUsers && targetUsers.length > 0) {
        // Broadcast to specific users
        targetUsers.forEach(userId => {
            this.io.to(`user:${userId}`).emit('system:notification', notification);
        });
    } else {
        // Broadcast to all users
        this.io.emit('system:notification', notification);
    }

    console.log(`Broadcasted system notification: ${type} - ${message}`);
}

  // Broadcast integration status changes
  public broadcastIntegrationStatus(channel: MessageChannel, status: 'connected' | 'disconnected' | 'error', message ?: string) {
    const event = {
        channel,
        status,
        message,
        timestamp: new Date()
    };

    this.io.emit('integration:status_changed', event);
    console.log(`Broadcasted integration status change: ${channel} - ${status}`);
}
}