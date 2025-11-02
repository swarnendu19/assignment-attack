'use client'

import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { useWebSocket } from './WebSocketContext'
import { 
  CollaborativeEdit, 
  PresenceInfo, 
  EditOperation, 
  CursorPosition,
  collaborationService 
} from '@/services/collaborationService'

interface CollaborationContextType {
  // Presence management
  trackPresence: (resourceId: string, resourceType: 'note' | 'contact', status: 'viewing' | 'editing', cursor?: CursorPosition) => void
  removePresence: (resourceId: string) => void
  getPresence: (resourceId: string, resourceType: 'note' | 'contact') => PresenceInfo[]
  
  // Collaborative editing
  broadcastEdit: (resourceId: string, resourceType: 'note' | 'contact', operation: EditOperation, cursor?: CursorPosition) => void
  onEdit: (callback: (edit: CollaborativeEdit) => void) => () => void
  
  // Cursor sharing
  broadcastCursor: (resourceId: string, resourceType: 'note' | 'contact', cursor: CursorPosition) => void
  onCursorUpdate: (callback: (userId: string, userName: string, resourceId: string, cursor: CursorPosition) => void) => () => void
  
  // Edit history
  getEditHistory: (resourceId: string, resourceType: 'note' | 'contact') => any[]
}

const CollaborationContext = createContext<CollaborationContextType | null>(null)

export function useCollaboration() {
  const context = useContext(CollaborationContext)
  if (!context) {
    throw new Error('useCollaboration must be used within a CollaborationProvider')
  }
  return context
}

interface CollaborationProviderProps {
  children: React.ReactNode
}

export function CollaborationProvider({ children }: CollaborationProviderProps) {
  const { user } = useAuth()
  const { sendMessage, onMessage } = useWebSocket()
  
  const [presenceMap, setPresenceMap] = useState<Map<string, PresenceInfo[]>>(new Map())
  const editCallbacksRef = useRef<Set<(edit: CollaborativeEdit) => void>>(new Set())
  const cursorCallbacksRef = useRef<Set<(userId: string, userName: string, resourceId: string, cursor: CursorPosition) => void>>(new Set())
  const presenceTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Handle incoming WebSocket messages
  useEffect(() => {
    const unsubscribe = onMessage((message) => {
      switch (message.type) {
        case 'collaboration_edit':
          handleIncomingEdit(message.data)
          break
        case 'collaboration_presence':
          handleIncomingPresence(message.data)
          break
        case 'collaboration_cursor':
          handleIncomingCursor(message.data)
          break
      }
    })

    return unsubscribe
  }, [onMessage])

  const handleIncomingEdit = (data: CollaborativeEdit) => {
    // Don't process our own edits
    if (data.userId === user?.id) return

    // Apply operational transformation
    collaborationService.applyEdit(data).then((transformedEdit) => {
      // Notify all edit callbacks
      editCallbacksRef.current.forEach(callback => callback(transformedEdit))
    })
  }

  const handleIncomingPresence = (data: PresenceInfo) => {
    const key = `${data.resourceId}_${data.resourceType}`
    
    setPresenceMap(prev => {
      const newMap = new Map(prev)
      const currentPresence = newMap.get(key) || []
      
      // Remove existing presence for this user
      const filteredPresence = currentPresence.filter(p => p.userId !== data.userId)
      
      // Add new presence
      filteredPresence.push(data)
      
      newMap.set(key, filteredPresence)
      return newMap
    })

    // Set timeout to remove presence after 30 seconds of inactivity
    const timeoutKey = `${data.userId}_${data.resourceId}`
    const existingTimeout = presenceTimeoutRef.current.get(timeoutKey)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    const timeout = setTimeout(() => {
      setPresenceMap(prev => {
        const newMap = new Map(prev)
        const currentPresence = newMap.get(key) || []
        const filteredPresence = currentPresence.filter(p => p.userId !== data.userId)
        newMap.set(key, filteredPresence)
        return newMap
      })
      presenceTimeoutRef.current.delete(timeoutKey)
    }, 30000)

    presenceTimeoutRef.current.set(timeoutKey, timeout)
  }

  const handleIncomingCursor = (data: { userId: string; userName: string; resourceId: string; cursor: CursorPosition }) => {
    // Don't process our own cursor updates
    if (data.userId === user?.id) return

    // Notify all cursor callbacks
    cursorCallbacksRef.current.forEach(callback => 
      callback(data.userId, data.userName, data.resourceId, data.cursor)
    )
  }

  const trackPresence = (
    resourceId: string, 
    resourceType: 'note' | 'contact', 
    status: 'viewing' | 'editing',
    cursor?: CursorPosition
  ) => {
    if (!user) return

    const presence: PresenceInfo = {
      userId: user.id,
      userName: user.name || user.email,
      resourceId,
      resourceType,
      status,
      cursor,
      lastSeen: new Date(),
    }

    // Track locally
    collaborationService.trackPresence(presence)

    // Broadcast to other users
    sendMessage({
      type: 'collaboration_presence',
      data: presence,
    })
  }

  const removePresence = (resourceId: string) => {
    if (!user) return

    collaborationService.removePresence(user.id, resourceId)

    // Broadcast removal to other users
    sendMessage({
      type: 'collaboration_presence_remove',
      data: {
        userId: user.id,
        resourceId,
      },
    })
  }

  const getPresence = (resourceId: string, resourceType: 'note' | 'contact'): PresenceInfo[] => {
    const key = `${resourceId}_${resourceType}`
    return presenceMap.get(key) || []
  }

  const broadcastEdit = (
    resourceId: string,
    resourceType: 'note' | 'contact',
    operation: EditOperation,
    cursor?: CursorPosition
  ) => {
    if (!user) return

    const edit: Omit<CollaborativeEdit, 'id' | 'timestamp'> = {
      userId: user.id,
      userName: user.name || user.email,
      resourceId,
      resourceType,
      operation,
      cursor,
    }

    // Apply edit locally first
    collaborationService.applyEdit(edit).then((appliedEdit) => {
      // Broadcast to other users
      sendMessage({
        type: 'collaboration_edit',
        data: appliedEdit,
      })
    })
  }

  const onEdit = (callback: (edit: CollaborativeEdit) => void) => {
    editCallbacksRef.current.add(callback)
    return () => {
      editCallbacksRef.current.delete(callback)
    }
  }

  const broadcastCursor = (
    resourceId: string,
    resourceType: 'note' | 'contact',
    cursor: CursorPosition
  ) => {
    if (!user) return

    sendMessage({
      type: 'collaboration_cursor',
      data: {
        userId: user.id,
        userName: user.name || user.email,
        resourceId,
        cursor,
      },
    })
  }

  const onCursorUpdate = (callback: (userId: string, userName: string, resourceId: string, cursor: CursorPosition) => void) => {
    cursorCallbacksRef.current.add(callback)
    return () => {
      cursorCallbacksRef.current.delete(callback)
    }
  }

  const getEditHistory = (resourceId: string, resourceType: 'note' | 'contact') => {
    return collaborationService.getEditHistory(resourceId, resourceType)
  }

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      presenceTimeoutRef.current.forEach(timeout => clearTimeout(timeout))
      presenceTimeoutRef.current.clear()
    }
  }, [])

  const contextValue: CollaborationContextType = {
    trackPresence,
    removePresence,
    getPresence,
    broadcastEdit,
    onEdit,
    broadcastCursor,
    onCursorUpdate,
    getEditHistory,
  }

  return (
    <CollaborationContext.Provider value={contextValue}>
      {children}
    </CollaborationContext.Provider>
  )
}