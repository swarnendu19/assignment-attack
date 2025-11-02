import { Server as SocketIOServer } from 'socket.io';
import { PrismaClient, PresenceStatus } from '@prisma/client';
import { AuthenticatedSocket } from './server';

export interface PresenceUpdate {
    userId: string;
    status: PresenceStatus;
    contactId?: string;
    currentAction?: string;
    lastSeen: Date;
}

export interface UserPresence {
    userId: string;
    status: PresenceStatus;
    contactId?: string;
    currentAction?: string;
    lastSeen: Date;
    user: {
        id: string;
        name: string | null;
        email: string;
    };
}

export class PresenceManager {
    private io: SocketIOServer;
    private prisma: PrismaClient;
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
    private readonly OFFLINE_THRESHOLD = 60000; // 1 minute

    constructor(io: SocketIOServer, prisma: PrismaClient) {
        this.io = io;
        this.prisma = prisma;
        this.startHeartbeat();
    }

    public handleConnection(socket: AuthenticatedSocket) {
        // Update user presence to online
        this.updateUserPresence(socket.userId, {
            status: 'ONLINE',
            lastSeen: new Date()
        });

        // Handle presence updates
        socket.on('presence:update', async (data: Partial<PresenceUpdate>) => {
            await this.updateUserPresence(socket.userId, data);
        });

        // Handle joining contact rooms
        socket.on('presence:join_contact', async (contactId: string) => {
            await this.joinContactRoom(socket, contactId);
        });

        // Handle leaving contact rooms
        socket.on('presence:leave_contact', async (contactId: string) => {
            await this.leaveContactRoom(socket, contactId);
        });

        // Handle status changes (online, away, etc.)
        socket.on('presence:status_change', async (status: PresenceStatus) => {
            await this.updateUserPresence(socket.userId, { status });
        });

        // Handle activity updates (typing, editing, etc.)
        socket.on('presence:activity', async (data: { contactId?: string; action?: string }) => {
            await this.updateUserPresence(socket.userId, {
                contactId: data.contactId,
                currentAction: data.action,
                lastSeen: new Date()
            });
        });

        // Send current presence data to the connected user
        this.sendPresenceData(socket);
    }

    public handleDisconnection(socket: AuthenticatedSocket) {
        // Update user presence to offline
        this.updateUserPresence(socket.userId, {
            status: 'OFFLINE',
            currentAction: null,
            lastSeen: new Date()
        });
    }

    private async updateUserPresence(userId: string, updates: Partial<PresenceUpdate>) {
        try {
            // Update presence in database
            const presence = await this.prisma.presence.upsert({
                where: { userId },
                update: {
                    status: updates.status,
                    contactId: updates.contactId,
                    currentAction: updates.currentAction,
                    lastSeen: updates.lastSeen || new Date()
                },
                create: {
                    userId,
                    status: updates.status || 'ONLINE',
                    contactId: updates.contactId,
                    currentAction: updates.currentAction,
                    lastSeen: updates.lastSeen || new Date()
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    }
                }
            });

            // Broadcast presence update to all connected users
            const presenceData: UserPresence = {
                userId: presence.userId,
                status: presence.status,
                contactId: presence.contactId || undefined,
                currentAction: presence.currentAction || undefined,
                lastSeen: presence.lastSeen,
                user: presence.user
            };

            this.io.emit('presence:user_updated', presenceData);

            // If user is viewing a specific contact, broadcast to that contact room
            if (presence.contactId) {
                this.io.to(`contact:${presence.contactId}`).emit('presence:contact_activity', {
                    userId: presence.userId,
                    action: presence.currentAction,
                    user: presence.user
                });
            }

        } catch (error) {
            console.error('Error updating user presence:', error);
        }
    }

    private async joinContactRoom(socket: AuthenticatedSocket, contactId: string) {
        try {
            // Join the contact room
            socket.join(`contact:${contactId}`);

            // Update presence with current contact
            await this.updateUserPresence(socket.userId, {
                contactId,
                currentAction: 'viewing',
                lastSeen: new Date()
            });

            // Get all users currently in this contact room
            const usersInRoom = await this.getUsersInContactRoom(contactId);

            // Send room users to the joining user
            socket.emit('presence:contact_users', {
                contactId,
                users: usersInRoom
            });

            console.log(`User ${socket.user.email} joined contact room: ${contactId}`);
        } catch (error) {
            console.error('Error joining contact room:', error);
        }
    }

    private async leaveContactRoom(socket: AuthenticatedSocket, contactId: string) {
        try {
            // Leave the contact room
            socket.leave(`contact:${contactId}`);

            // Update presence to remove current contact
            await this.updateUserPresence(socket.userId, {
                contactId: null,
                currentAction: null,
                lastSeen: new Date()
            });

            console.log(`User ${socket.user.email} left contact room: ${contactId}`);
        } catch (error) {
            console.error('Error leaving contact room:', error);
        }
    }

    private async getUsersInContactRoom(contactId: string): Promise<UserPresence[]> {
        try {
            const presences = await this.prisma.presence.findMany({
                where: {
                    contactId,
                    status: { in: ['ONLINE', 'AWAY'] }
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    }
                }
            });

            return presences.map(presence => ({
                userId: presence.userId,
                status: presence.status,
                contactId: presence.contactId || undefined,
                currentAction: presence.currentAction || undefined,
                lastSeen: presence.lastSeen,
                user: presence.user
            }));
        } catch (error) {
            console.error('Error getting users in contact room:', error);
            return [];
        }
    }

    private async sendPresenceData(socket: AuthenticatedSocket) {
        try {
            // Get all online users
            const onlineUsers = await this.prisma.presence.findMany({
                where: {
                    status: { in: ['ONLINE', 'AWAY'] }
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    }
                }
            });

            const presenceData: UserPresence[] = onlineUsers.map(presence => ({
                userId: presence.userId,
                status: presence.status,
                contactId: presence.contactId || undefined,
                currentAction: presence.currentAction || undefined,
                lastSeen: presence.lastSeen,
                user: presence.user
            }));

            socket.emit('presence:initial_data', presenceData);
        } catch (error) {
            console.error('Error sending presence data:', error);
        }
    }

    private startHeartbeat() {
        this.heartbeatInterval = setInterval(async () => {
            await this.cleanupOfflineUsers();
        }, this.HEARTBEAT_INTERVAL);
    }

    private async cleanupOfflineUsers() {
        try {
            const offlineThreshold = new Date(Date.now() - this.OFFLINE_THRESHOLD);

            // Find users who haven't been seen recently and mark them as offline
            const stalePresences = await this.prisma.presence.findMany({
                where: {
                    lastSeen: { lt: offlineThreshold },
                    status: { not: 'OFFLINE' }
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    }
                }
            });

            for (const presence of stalePresences) {
                await this.prisma.presence.update({
                    where: { userId: presence.userId },
                    data: {
                        status: 'OFFLINE',
                        currentAction: null,
                        contactId: null
                    }
                });

                // Broadcast offline status
                const presenceData: UserPresence = {
                    userId: presence.userId,
                    status: 'OFFLINE',
                    lastSeen: presence.lastSeen,
                    user: presence.user
                };

                this.io.emit('presence:user_updated', presenceData);
            }
        } catch (error) {
            console.error('Error cleaning up offline users:', error);
        }
    }

    public async getOnlineUsers(): Promise<UserPresence[]> {
        try {
            const onlineUsers = await this.prisma.presence.findMany({
                where: {
                    status: { in: ['ONLINE', 'AWAY'] }
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    }
                }
            });

            return onlineUsers.map(presence => ({
                userId: presence.userId,
                status: presence.status,
                contactId: presence.contactId || undefined,
                currentAction: presence.currentAction || undefined,
                lastSeen: presence.lastSeen,
                user: presence.user
            }));
        } catch (error) {
            console.error('Error getting online users:', error);
            return [];
        }
    }

    public destroy() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
}