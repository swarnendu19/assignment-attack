import { prisma } from '@/lib/prisma'

export interface CollaborativeEdit {
  id: string
  userId: string
  userName: string
  resourceId: string
  resourceType: 'note' | 'contact'
  operation: EditOperation
  timestamp: Date
  cursor?: CursorPosition
}

export interface EditOperation {
  type: 'insert' | 'delete' | 'retain'
  position: number
  content?: string
  length?: number
}

export interface CursorPosition {
  start: number
  end: number
}

export interface PresenceInfo {
  userId: string
  userName: string
  resourceId: string
  resourceType: 'note' | 'contact'
  status: 'viewing' | 'editing'
  cursor?: CursorPosition
  lastSeen: Date
}

export interface MentionNotification {
  id: string
  fromUserId: string
  fromUserName: string
  toUserId: string
  resourceId: string
  resourceType: 'note' | 'contact'
  content: string
  position: number
  createdAt: Date
  isRead: boolean
}

export interface EditHistory {
  id: string
  resourceId: string
  resourceType: 'note' | 'contact'
  userId: string
  userName: string
  operation: EditOperation
  previousContent?: string
  newContent?: string
  timestamp: Date
}

export class CollaborationService {
  private presenceMap = new Map<string, PresenceInfo>()
  private editHistory = new Map<string, EditHistory[]>()

  /**
   * Track user presence on a resource
   */
  trackPresence(presence: Omit<PresenceInfo, 'lastSeen'>): PresenceInfo {
    const key = `${presence.userId}_${presence.resourceId}`
    const presenceInfo: PresenceInfo = {
      ...presence,
      lastSeen: new Date(),
    }
    
    this.presenceMap.set(key, presenceInfo)
    
    // Clean up old presence entries (older than 5 minutes)
    this.cleanupPresence()
    
    return presenceInfo
  }

  /**
   * Get all users currently present on a resource
   */
  getResourcePresence(resourceId: string, resourceType: string): PresenceInfo[] {
    const presence: PresenceInfo[] = []
    
    for (const [key, info] of this.presenceMap.entries()) {
      if (info.resourceId === resourceId && info.resourceType === resourceType) {
        // Only include recent presence (within last 2 minutes)
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000)
        if (info.lastSeen > twoMinutesAgo) {
          presence.push(info)
        }
      }
    }
    
    return presence
  }

  /**
   * Remove user presence from a resource
   */
  removePresence(userId: string, resourceId: string): void {
    const key = `${userId}_${resourceId}`
    this.presenceMap.delete(key)
  }

  /**
   * Apply operational transformation to resolve conflicts
   */
  transformOperation(
    operation: EditOperation,
    againstOperation: EditOperation
  ): EditOperation {
    // Simplified operational transformation
    // In a production system, you'd want a more sophisticated OT algorithm
    
    if (operation.type === 'insert' && againstOperation.type === 'insert') {
      // Both operations are inserts
      if (operation.position <= againstOperation.position) {
        // Our operation comes first, adjust the other operation
        return {
          ...againstOperation,
          position: againstOperation.position + (operation.content?.length || 0),
        }
      } else {
        // Other operation comes first, adjust our operation
        return {
          ...operation,
          position: operation.position + (againstOperation.content?.length || 0),
        }
      }
    }
    
    if (operation.type === 'delete' && againstOperation.type === 'insert') {
      if (operation.position <= againstOperation.position) {
        return {
          ...againstOperation,
          position: againstOperation.position - (operation.length || 0),
        }
      } else {
        return operation
      }
    }
    
    if (operation.type === 'insert' && againstOperation.type === 'delete') {
      if (operation.position <= againstOperation.position) {
        return {
          ...againstOperation,
          position: againstOperation.position + (operation.content?.length || 0),
        }
      } else {
        return operation
      }
    }
    
    if (operation.type === 'delete' && againstOperation.type === 'delete') {
      if (operation.position <= againstOperation.position) {
        return {
          ...againstOperation,
          position: Math.max(0, againstOperation.position - (operation.length || 0)),
        }
      } else {
        return {
          ...operation,
          position: Math.max(0, operation.position - (againstOperation.length || 0)),
        }
      }
    }
    
    return operation
  }

  /**
   * Apply a collaborative edit with conflict resolution
   */
  async applyEdit(edit: Omit<CollaborativeEdit, 'id' | 'timestamp'>): Promise<CollaborativeEdit> {
    const collaborativeEdit: CollaborativeEdit = {
      ...edit,
      id: `edit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    }

    // Get recent edits for conflict resolution
    const recentEdits = this.getRecentEdits(edit.resourceId, edit.resourceType)
    
    // Apply operational transformation against recent edits
    let transformedOperation = edit.operation
    for (const recentEdit of recentEdits) {
      if (recentEdit.userId !== edit.userId && recentEdit.timestamp > new Date(Date.now() - 5000)) {
        transformedOperation = this.transformOperation(transformedOperation, recentEdit.operation)
      }
    }
    
    collaborativeEdit.operation = transformedOperation

    // Store edit in history
    this.addToEditHistory({
      id: collaborativeEdit.id,
      resourceId: edit.resourceId,
      resourceType: edit.resourceType,
      userId: edit.userId,
      userName: edit.userName,
      operation: transformedOperation,
      timestamp: collaborativeEdit.timestamp,
    })

    return collaborativeEdit
  }

  /**
   * Get recent edits for a resource
   */
  getRecentEdits(resourceId: string, resourceType: string, limit = 50): EditHistory[] {
    const key = `${resourceId}_${resourceType}`
    const history = this.editHistory.get(key) || []
    
    // Return recent edits (within last 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
    return history
      .filter(edit => edit.timestamp > tenMinutesAgo)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit)
  }

  /**
   * Get full edit history for a resource
   */
  getEditHistory(resourceId: string, resourceType: string, limit = 100): EditHistory[] {
    const key = `${resourceId}_${resourceType}`
    const history = this.editHistory.get(key) || []
    
    return history
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit)
  }

  /**
   * Process @mentions and create notifications
   */
  async processMentions(
    content: string,
    resourceId: string,
    resourceType: 'note' | 'contact',
    fromUserId: string,
    fromUserName: string
  ): Promise<MentionNotification[]> {
    const mentionRegex = /@(\w+)/g
    const mentions: MentionNotification[] = []
    let match

    while ((match = mentionRegex.exec(content)) !== null) {
      const username = match[1]
      
      // In a real implementation, you'd resolve username to userId from database
      const toUserId = await this.resolveUsernameToUserId(username)
      
      if (toUserId && toUserId !== fromUserId) {
        const mention: MentionNotification = {
          id: `mention_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          fromUserId,
          fromUserName,
          toUserId,
          resourceId,
          resourceType,
          content: match[0],
          position: match.index,
          createdAt: new Date(),
          isRead: false,
        }
        
        mentions.push(mention)
        
        // Store mention in database
        await this.storeMentionNotification(mention)
      }
    }

    return mentions
  }

  /**
   * Get unread mentions for a user
   */
  async getUserMentions(userId: string, limit = 50): Promise<MentionNotification[]> {
    // In a real implementation, this would query the database
    // For now, return empty array as we don't have a mentions table
    return []
  }

  /**
   * Mark mentions as read
   */
  async markMentionsAsRead(mentionIds: string[]): Promise<void> {
    // In a real implementation, this would update the database
    // For now, this is a no-op
  }

  /**
   * Clean up old presence entries
   */
  private cleanupPresence(): void {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    
    for (const [key, presence] of this.presenceMap.entries()) {
      if (presence.lastSeen < fiveMinutesAgo) {
        this.presenceMap.delete(key)
      }
    }
  }

  /**
   * Add edit to history
   */
  private addToEditHistory(edit: EditHistory): void {
    const key = `${edit.resourceId}_${edit.resourceType}`
    const history = this.editHistory.get(key) || []
    
    history.push(edit)
    
    // Keep only last 1000 edits per resource
    if (history.length > 1000) {
      history.splice(0, history.length - 1000)
    }
    
    this.editHistory.set(key, history)
  }

  /**
   * Resolve username to userId (mock implementation)
   */
  private async resolveUsernameToUserId(username: string): Promise<string | null> {
    // In a real implementation, this would query the database
    // For now, return a mock userId based on username
    const mockUsers: Record<string, string> = {
      'john': 'user_john_123',
      'jane': 'user_jane_456',
      'bob': 'user_bob_789',
    }
    
    return mockUsers[username.toLowerCase()] || null
  }

  /**
   * Store mention notification (mock implementation)
   */
  private async storeMentionNotification(mention: MentionNotification): Promise<void> {
    // In a real implementation, this would store in database
    // For now, this is a no-op
    console.log('Mention notification created:', mention)
  }
}

export const collaborationService = new CollaborationService()