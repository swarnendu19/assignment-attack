import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { NextApiRequest } from 'next';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PresenceManager } from './presence-manager';
import { CollaborationManager } from './collaboration-manager';
import { NotificationManager } from './notification-manager';
import { MessageBroadcaster } from './message-broadcaster';

export interface AuthenticatedSocket extends Socket {
    userId: string;
    user: {
        id: string;
        email: string;
        name: string | null;
        role: string;
    };
}

export class WebSocketServer {
    private io: SocketIOServer;
    private presenceManager: PresenceManager;
    private collaborationManager: CollaborationManager;
    private notificationManager: NotificationManager;
    private messageBroadcaster: MessageBroadcaster;

    constructor(httpServer: HTTPServer) {
        this.io = new SocketIOServer(httpServer, {
            cors: {
                origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
                methods: ["GET", "POST"],
                credentials: true
            },
            transports: ['websocket', 'polling']
        });

        this.presenceManager = new PresenceManager(this.io, prisma);
        this.collaborationManager = new CollaborationManager(this.io, prisma);
        this.notificationManager = new NotificationManager(this.io, prisma);
        this.messageBroadcaster = new MessageBroadcaster(this.io, prisma);

        this.setupMiddleware();
        this.setupEventHandlers();
    }

    private setupMiddleware() {
        // Authentication middleware
        this.io.use(async (socket: Socket, next) => {
            try {
                const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

                if (!token) {
                    return next(new Error('Authentication token required'));
                }

                // Verify the session token using Better Auth
                const session = await prisma.session.findUnique({
                    where: { token },
                    include: { user: true }
                });

                if (!session || session.expiresAt < new Date()) {
                    return next(new Error('Invalid or expired token'));
                }

                // Attach user info to socket
                (socket as AuthenticatedSocket).userId = session.userId;
                (socket as AuthenticatedSocket).user = {
                    id: session.user.id,
                    email: session.user.email,
                    name: session.user.name,
                    role: session.user.role
                };

                next();
            } catch (error) {
                console.error('WebSocket authentication error:', error);
                next(new Error('Authentication failed'));
            }
        });
    }

    private setupEventHandlers() {
        this.io.on('connection', (socket: AuthenticatedSocket) => {
            console.log(`User ${socket.user.email} connected with socket ${socket.id}`);

            // Join user to their personal room
            socket.join(`user:${socket.userId}`);

            // Handle presence events
            this.presenceManager.handleConnection(socket);

            // Handle collaboration events
            this.collaborationManager.handleConnection(socket);

            // Handle notification events
            this.notificationManager.handleConnection(socket);

            // Handle disconnection
            socket.on('disconnect', (reason) => {
                console.log(`User ${socket.user.email} disconnected: ${reason}`);
                this.presenceManager.handleDisconnection(socket);
            });

            // Handle errors
            socket.on('error', (error) => {
                console.error(`Socket error for user ${socket.user.email}:`, error);
            });
        });
    }

    // Broadcast message to specific users
    public broadcastToUsers(userIds: string[], event: string, data: any) {
        userIds.forEach(userId => {
            this.io.to(`user:${userId}`).emit(event, data);
        });
    }

    // Broadcast message to contact room (all users viewing a contact)
    public broadcastToContact(contactId: string, event: string, data: any) {
        this.io.to(`contact:${contactId}`).emit(event, data);
    }

    // Broadcast message to all connected users
    public broadcastToAll(event: string, data: any) {
        this.io.emit(event, data);
    }

    // Get connected users count
    public getConnectedUsersCount(): number {
        return this.io.sockets.sockets.size;
    }

    // Get users in a specific room
    public async getUsersInRoom(room: string): Promise<string[]> {
        const sockets = await this.io.in(room).fetchSockets();
        return sockets.map(socket => (socket as AuthenticatedSocket).userId);
    }

    // Get manager instances
    public getPresenceManager(): PresenceManager {
        return this.presenceManager;
    }

    public getCollaborationManager(): CollaborationManager {
        return this.collaborationManager;
    }

    public getNotificationManager(): NotificationManager {
        return this.notificationManager;
    }

    public getMessageBroadcaster(): MessageBroadcaster {
        return this.messageBroadcaster;
    }

    // Graceful shutdown
    public async close(): Promise<void> {
        return new Promise((resolve) => {
            this.presenceManager.destroy();
            this.collaborationManager.cleanup();
            this.io.close(() => {
                console.log('WebSocket server closed');
                resolve();
            });
        });
    }
}

// Global WebSocket server instance
let wsServer: WebSocketServer | null = null;

export function initializeWebSocketServer(httpServer: HTTPServer): WebSocketServer {
    if (!wsServer) {
        wsServer = new WebSocketServer(httpServer);
    }
    return wsServer;
}

export function getWebSocketServer(): WebSocketServer | null {
    return wsServer;
}