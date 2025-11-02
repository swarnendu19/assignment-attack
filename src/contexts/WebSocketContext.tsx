'use client'

import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { WebSocketConnectionManager } from '@/lib/websocket/ConnectionManager'
import { PresenceManager } from '@/lib/websocket/PresenceManager'

interface WebSocketMessage {
  type: 'message' | 'typing' | 'presence' | 'status_update' | 'collaboration_edit' | 'collaboration_presence' | 'collaboration_cursor' | 'collaboration_presence_remove'
  data: any
  timestamp: Date
}

interface TypingIndicator {
  userId: string
  userName: string
  conversationId: string
  timestamp: Date
}

interface PresenceInfo {
  userId: string
  userName: string
  status: 'online' | 'offline' | 'away'
  lastSeen: Date
}

interface WebSocketContextType {
  isConnected: boolean
  sendMessage: (message: any) => void
  sendTyping: (conversationId: string, isTyping: boolean) => void
  updatePresence: (status: 'online' | 'offline' | 'away') => void
  typingUsers: TypingIndicator[]
  presenceMap: Map<string, PresenceInfo>
  onMessage: (callback: (message: WebSocketMessage) => void) => () => void
  connectionManager: WebSocketConnectionManager | null
  presenceManager: PresenceManager | null
}

const WebSocketContext = createContext<WebSocketContextType | null>(null)

export function useWebSocket() {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return context
}

interface WebSocketProviderProps {
  children: React.ReactNode
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const { user } = useAuth()
  const [isConnected, setIsConnected] = useState(false)
  const [typingUsers, setTypingUsers] = useState<TypingIndicator[]>([])
  const [presenceMap, setPresenceMap] = useState<Map<string, PresenceInfo>>(new Map())
  
  const connectionManagerRef = useRef<WebSocketConnectionManager | null>(null)
  const presenceManagerRef = useRef<PresenceManager | null>(null)
  const messageCallbacksRef = useRef<Set<(message: WebSocketMessage) => void>>(new Set())
  const typingTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  const connect = async () => {
    if (!user || connectionManagerRef.current?.isHealthy()) return

    try {
      // In a real implementation, you'd use wss:// for production
      const wsUrl = process.env.NODE_ENV === 'production' 
        ? `wss://${window.location.host}/api/ws`
        : `ws://${window.location.host}/api/ws`
      
      // Create connection manager if not exists
      if (!connectionManagerRef.current) {
        connectionManagerRef.current = new WebSocketConnectionManager(wsUrl, {
          maxReconnectAttempts: 5,
          reconnectDelay: 1000,
          heartbeatInterval: 30000,
          messageBufferSize: 100,
          batchTimeout: 50
        })

        // Set up connection status monitoring
        const checkConnection = () => {
          const isHealthy = connectionManagerRef.current?.isHealthy() || false
          setIsConnected(isHealthy)
        }

        // Check connection status periodically
        const statusInterval = setInterval(checkConnection, 1000)
        
        // Clean up interval on unmount
        return () => clearInterval(statusInterval)
      }

      // Create presence manager if not exists
      if (!presenceManagerRef.current && connectionManagerRef.current) {
        presenceManagerRef.current = new PresenceManager(connectionManagerRef.current, {
          presenceUpdateInterval: 2000,
          batchSize: 10,
          maxPendingUpdates: 100
        })

        // Subscribe to presence updates
        presenceManagerRef.current.subscribe((newPresenceMap) => {
          setPresenceMap(new Map(newPresenceMap))
        })
      }

      // Set up message subscriptions
      setupMessageSubscriptions()

      // Connect with authentication token
      await connectionManagerRef.current.connect(user.id) // In real implementation, use proper JWT token
      
      // Start presence tracking
      presenceManagerRef.current?.startTracking()
      
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
    }
  }

  const setupMessageSubscriptions = () => {
    if (!connectionManagerRef.current) return

    // Subscribe to typing indicators
    connectionManagerRef.current.subscribe('typing', (data) => {
      handleTypingMessage(data)
      // Notify message callbacks
      const message: WebSocketMessage = {
        type: 'typing',
        data,
        timestamp: new Date()
      }
      messageCallbacksRef.current.forEach(callback => callback(message))
    })

    // Subscribe to other message types
    const messageTypes = ['message', 'status_update', 'collaboration_edit', 'collaboration_presence', 'collaboration_cursor']
    messageTypes.forEach(type => {
      connectionManagerRef.current!.subscribe(type, (data) => {
        const message: WebSocketMessage = {
          type: type as any,
          data,
          timestamp: new Date()
        }
        messageCallbacksRef.current.forEach(callback => callback(message))
      })
    })
  }

  const handleTypingMessage = (data: { userId: string; userName: string; conversationId: string; isTyping: boolean }) => {
    if (data.isTyping) {
      setTypingUsers(prev => {
        const filtered = prev.filter(t => t.userId !== data.userId || t.conversationId !== data.conversationId)
        return [...filtered, {
          userId: data.userId,
          userName: data.userName,
          conversationId: data.conversationId,
          timestamp: new Date(),
        }]
      })

      // Clear typing indicator after 3 seconds
      const timeoutKey = `${data.userId}_${data.conversationId}`
      const existingTimeout = typingTimeoutRef.current.get(timeoutKey)
      if (existingTimeout) {
        clearTimeout(existingTimeout)
      }

      const timeout = setTimeout(() => {
        setTypingUsers(prev => 
          prev.filter(t => t.userId !== data.userId || t.conversationId !== data.conversationId)
        )
        typingTimeoutRef.current.delete(timeoutKey)
      }, 3000)

      typingTimeoutRef.current.set(timeoutKey, timeout)
    } else {
      setTypingUsers(prev => 
        prev.filter(t => t.userId !== data.userId || t.conversationId !== data.conversationId)
      )
    }
  }

  const sendMessage = (message: any) => {
    connectionManagerRef.current?.send(message.type, message.data, 'normal')
  }

  const sendTyping = (conversationId: string, isTyping: boolean) => {
    connectionManagerRef.current?.send('typing', {
      conversationId,
      isTyping,
      userId: user?.id,
      userName: user?.name,
    }, 'low') // Typing indicators are low priority
  }

  const updatePresence = (status: 'online' | 'offline' | 'away') => {
    presenceManagerRef.current?.setStatus(status)
  }

  const onMessage = (callback: (message: WebSocketMessage) => void) => {
    messageCallbacksRef.current.add(callback)
    return () => {
      messageCallbacksRef.current.delete(callback)
    }
  }

  // Connect when user is available
  useEffect(() => {
    if (user) {
      connect()
    }

    return () => {
      connectionManagerRef.current?.disconnect()
      presenceManagerRef.current?.stopTracking()
      
      // Clear all typing timeouts
      typingTimeoutRef.current.forEach(timeout => clearTimeout(timeout))
      typingTimeoutRef.current.clear()
    }
  }, [user])

  const contextValue: WebSocketContextType = {
    isConnected,
    sendMessage,
    sendTyping,
    updatePresence,
    typingUsers,
    presenceMap,
    onMessage,
    connectionManager: connectionManagerRef.current,
    presenceManager: presenceManagerRef.current,
  }

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  )
}