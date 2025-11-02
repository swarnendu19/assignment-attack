import { Server as SocketIOServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedSocket } from './server';

export interface CollaborativeEdit {
    id: string;
    userId: string;
    contactId: string;
    type: 'note' | 'message_draft' | 'template';
    resourceId: string;
    operation: EditOperation;
    timestamp: Date;
    version: number;
}

export interface EditOperation {
    type: 'insert' | 'delete' | 'replace';
    position: number;
    content?: string;
    length?: number;
}

export interface DocumentState {
    id: string;
    content: string;
    version: number;
    lastModified: Date;
    activeEditors: string[];
}

export interface ConflictResolution {
    originalOperation: EditOperation;
    transformedOperation: EditOperation;
    conflictType: 'concurrent_edit' | 'version_mismatch' | 'position_conflict';
}

export class CollaborationManager {
    private io: SocketIOServer;
    private prisma: PrismaClient;
    private documentStates: Map<string, DocumentState> = new Map();
    private operationQueue: Map<string, CollaborativeEdit[]> = new Map();

    constructor(io: SocketIOServer, prisma: PrismaClient) {
        this.io = io;
        this.prisma = prisma;
    }

    public handleConnection(socket: AuthenticatedSocket) {
        // Handle collaborative editing events
        socket.on('collaboration:start_editing', async (data: { contactId: string; type: string; resourceId: string }) => {
            await this.startCollaborativeEditing(socket, data);
        });

        socket.on('collaboration:stop_editing', async (data: { contactId: string; type: string; resourceId: string }) => {
            await this.stopCollaborativeEditing(socket, data);
        });

        socket.on('collaboration:edit_operation', async (data: CollaborativeEdit) => {
            await this.handleEditOperation(socket, data);
        });

        socket.on('collaboration:request_sync', async (data: { resourceId: string; version: number }) => {
            await this.syncDocument(socket, data);
        });

        socket.on('collaboration:cursor_position', (data: { contactId: string; resourceId: string; position: number }) => {
            this.broadcastCursorPosition(socket, data);
        });
    }

    private async startCollaborativeEditing(socket: AuthenticatedSocket, data: { contactId: string; type: string; resourceId: string }) {
        try {
            const documentKey = `${data.type}:${data.resourceId}`;

            // Initialize document state if not exists
            if (!this.documentStates.has(documentKey)) {
                const content = await this.getDocumentContent(data.type, data.resourceId);
                this.documentStates.set(documentKey, {
                    id: documentKey,
                    content: content || '',
                    version: 1,
                    lastModified: new Date(),
                    activeEditors: []
                });
            }

            const docState = this.documentStates.get(documentKey)!;

            // Add user to active editors if not already present
            if (!docState.activeEditors.includes(socket.userId)) {
                docState.activeEditors.push(socket.userId);
            }

            // Join collaboration room
            socket.join(`collab:${documentKey}`);

            // Send current document state to the user
            socket.emit('collaboration:document_state', {
                resourceId: data.resourceId,
                content: docState.content,
                version: docState.version,
                activeEditors: docState.activeEditors
            });

            // Broadcast new editor to other collaborators
            socket.to(`collab:${documentKey}`).emit('collaboration:editor_joined', {
                userId: socket.userId,
                user: socket.user,
                resourceId: data.resourceId
            });

            console.log(`User ${socket.user.email} started editing ${documentKey}`);
        } catch (error) {
            console.error('Error starting collaborative editing:', error);
            socket.emit('collaboration:error', { message: 'Failed to start collaborative editing' });
        }
    }

    private async stopCollaborativeEditing(socket: AuthenticatedSocket, data: { contactId: string; type: string; resourceId: string }) {
        try {
            const documentKey = `${data.type}:${data.resourceId}`;
            const docState = this.documentStates.get(documentKey);

            if (docState) {
                // Remove user from active editors
                docState.activeEditors = docState.activeEditors.filter(id => id !== socket.userId);

                // Leave collaboration room
                socket.leave(`collab:${documentKey}`);

                // Broadcast editor left to other collaborators
                socket.to(`collab:${documentKey}`).emit('collaboration:editor_left', {
                    userId: socket.userId,
                    user: socket.user,
                    resourceId: data.resourceId
                });

                // Save document if no more active editors
                if (docState.activeEditors.length === 0) {
                    await this.saveDocument(data.type, data.resourceId, docState.content);
                    this.documentStates.delete(documentKey);
                }
            }

            console.log(`User ${socket.user.email} stopped editing ${documentKey}`);
        } catch (error) {
            console.error('Error stopping collaborative editing:', error);
        }
    }

    private async handleEditOperation(socket: AuthenticatedSocket, edit: CollaborativeEdit) {
        try {
            const documentKey = `${edit.type}:${edit.resourceId}`;
            const docState = this.documentStates.get(documentKey);

            if (!docState) {
                socket.emit('collaboration:error', { message: 'Document not found for editing' });
                return;
            }

            // Check for version conflicts
            if (edit.version !== docState.version) {
                await this.handleVersionConflict(socket, edit, docState);
                return;
            }

            // Apply operation to document
            const newContent = this.applyOperation(docState.content, edit.operation);

            // Update document state
            docState.content = newContent;
            docState.version += 1;
            docState.lastModified = new Date();

            // Add to operation queue for conflict resolution
            if (!this.operationQueue.has(documentKey)) {
                this.operationQueue.set(documentKey, []);
            }
            this.operationQueue.get(documentKey)!.push(edit);

            // Broadcast operation to other collaborators
            socket.to(`collab:${documentKey}`).emit('collaboration:operation_applied', {
                operation: edit.operation,
                userId: socket.userId,
                user: socket.user,
                version: docState.version,
                resourceId: edit.resourceId
            });

            // Send acknowledgment to the editor
            socket.emit('collaboration:operation_ack', {
                operationId: edit.id,
                newVersion: docState.version
            });

            console.log(`Applied edit operation for ${documentKey} by ${socket.user.email}`);
        } catch (error) {
            console.error('Error handling edit operation:', error);
            socket.emit('collaboration:error', { message: 'Failed to apply edit operation' });
        }
    }

    private async handleVersionConflict(socket: AuthenticatedSocket, edit: CollaborativeEdit, docState: DocumentState) {
        try {
            const documentKey = `${edit.type}:${edit.resourceId}`;
            const operations = this.operationQueue.get(documentKey) || [];

            // Find operations that occurred after the client's version
            const conflictingOps = operations.filter(op => op.version >= edit.version);

            // Transform the operation to resolve conflicts
            const transformedOperation = this.transformOperation(edit.operation, conflictingOps.map(op => op.operation));

            // Apply transformed operation
            const newContent = this.applyOperation(docState.content, transformedOperation);

            docState.content = newContent;
            docState.version += 1;
            docState.lastModified = new Date();

            // Send conflict resolution to the client
            socket.emit('collaboration:conflict_resolved', {
                originalOperation: edit.operation,
                transformedOperation,
                newContent: docState.content,
                newVersion: docState.version,
                conflictType: 'version_mismatch'
            });

            // Broadcast to other collaborators
            socket.to(`collab:${documentKey}`).emit('collaboration:operation_applied', {
                operation: transformedOperation,
                userId: socket.userId,
                user: socket.user,
                version: docState.version,
                resourceId: edit.resourceId
            });

            console.log(`Resolved version conflict for ${documentKey}`);
        } catch (error) {
            console.error('Error handling version conflict:', error);
            socket.emit('collaboration:error', { message: 'Failed to resolve version conflict' });
        }
    }

    private transformOperation(operation: EditOperation, conflictingOps: EditOperation[]): EditOperation {
        let transformedOp = { ...operation };

        for (const conflictOp of conflictingOps) {
            transformedOp = this.transformTwoOperations(transformedOp, conflictOp);
        }

        return transformedOp;
    }

    private transformTwoOperations(op1: EditOperation, op2: EditOperation): EditOperation {
        // Operational Transform algorithm for conflict resolution
        if (op1.type === 'insert' && op2.type === 'insert') {
            if (op2.position <= op1.position) {
                return {
                    ...op1,
                    position: op1.position + (op2.content?.length || 0)
                };
            }
        } else if (op1.type === 'insert' && op2.type === 'delete') {
            if (op2.position < op1.position) {
                return {
                    ...op1,
                    position: Math.max(op1.position - (op2.length || 0), op2.position)
                };
            }
        } else if (op1.type === 'delete' && op2.type === 'insert') {
            if (op2.position <= op1.position) {
                return {
                    ...op1,
                    position: op1.position + (op2.content?.length || 0)
                };
            }
        } else if (op1.type === 'delete' && op2.type === 'delete') {
            if (op2.position < op1.position) {
                return {
                    ...op1,
                    position: Math.max(op1.position - (op2.length || 0), op2.position)
                };
            } else if (op2.position < op1.position + (op1.length || 0)) {
                // Overlapping deletes
                const overlapStart = Math.max(op1.position, op2.position);
                const overlapEnd = Math.min(op1.position + (op1.length || 0), op2.position + (op2.length || 0));
                const overlapLength = overlapEnd - overlapStart;

                return {
                    ...op1,
                    length: (op1.length || 0) - overlapLength
                };
            }
        }

        return op1;
    }

    private applyOperation(content: string, operation: EditOperation): string {
        switch (operation.type) {
            case 'insert':
                return content.slice(0, operation.position) +
                    (operation.content || '') +
                    content.slice(operation.position);

            case 'delete':
                return content.slice(0, operation.position) +
                    content.slice(operation.position + (operation.length || 0));

            case 'replace':
                return content.slice(0, operation.position) +
                    (operation.content || '') +
                    content.slice(operation.position + (operation.length || 0));

            default:
                return content;
        }
    }

    private async syncDocument(socket: AuthenticatedSocket, data: { resourceId: string; version: number }) {
        try {
            // Find document by resourceId across all types
            let documentKey = '';
            let docState: DocumentState | undefined;

            for (const [key, state] of this.documentStates.entries()) {
                if (key.endsWith(`:${data.resourceId}`)) {
                    documentKey = key;
                    docState = state;
                    break;
                }
            }

            if (!docState) {
                socket.emit('collaboration:sync_error', { message: 'Document not found' });
                return;
            }

            // Send full document state if versions don't match
            if (data.version !== docState.version) {
                socket.emit('collaboration:full_sync', {
                    resourceId: data.resourceId,
                    content: docState.content,
                    version: docState.version,
                    activeEditors: docState.activeEditors
                });
            } else {
                socket.emit('collaboration:sync_complete', {
                    resourceId: data.resourceId,
                    version: docState.version
                });
            }
        } catch (error) {
            console.error('Error syncing document:', error);
            socket.emit('collaboration:sync_error', { message: 'Failed to sync document' });
        }
    }

    private broadcastCursorPosition(socket: AuthenticatedSocket, data: { contactId: string; resourceId: string; position: number }) {
        const documentKey = `note:${data.resourceId}`;

        socket.to(`collab:${documentKey}`).emit('collaboration:cursor_moved', {
            userId: socket.userId,
            user: socket.user,
            position: data.position,
            resourceId: data.resourceId
        });
    }

    private async getDocumentContent(type: string, resourceId: string): Promise<string | null> {
        try {
            switch (type) {
                case 'note':
                    const note = await this.prisma.note.findUnique({
                        where: { id: resourceId }
                    });
                    return note?.content || null;

                case 'template':
                    const template = await this.prisma.template.findUnique({
                        where: { id: resourceId }
                    });
                    return template?.content || null;

                default:
                    return null;
            }
        } catch (error) {
            console.error('Error getting document content:', error);
            return null;
        }
    }

    private async saveDocument(type: string, resourceId: string, content: string): Promise<void> {
        try {
            switch (type) {
                case 'note':
                    await this.prisma.note.update({
                        where: { id: resourceId },
                        data: { content, updatedAt: new Date() }
                    });
                    break;

                case 'template':
                    await this.prisma.template.update({
                        where: { id: resourceId },
                        data: { content, updatedAt: new Date() }
                    });
                    break;
            }
        } catch (error) {
            console.error('Error saving document:', error);
        }
    }

    public cleanup() {
        // Clean up document states and operation queues
        this.documentStates.clear();
        this.operationQueue.clear();
    }
}