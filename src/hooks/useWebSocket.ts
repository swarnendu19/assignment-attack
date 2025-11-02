import { useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

interface UseWebSocketReturn {
  socket: Socket | null
  isConnected: boolean
  error: string | null
  reconnect: () => void
}

export function useWebSocket(path: string): UseWebSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()

  const connect = () => {
    try {
      const newSocket = io({
        path,
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true
      })

      newSocket.on('connect', () => {
        console.log(`WebSocket connected: ${path}`)
        setIsConnected(true)
        setError(null)
      })

      newSocket.on('disconnect', (reason) => {
        console.log(`WebSocket disconnected: ${path}, reason: ${reason}`)
        setIsConnected(false)
        
        // Auto-reconnect on unexpected disconnection
        if (reason === 'io server disconnect') {
          // Server initiated disconnect, don't reconnect automatically
          setError('Server disconnected')
        } else {
          // Client or network issue, attempt to reconnect
          scheduleReconnect()
        }
      })

      newSocket.on('connect_error', (err) => {
        console.error(`WebSocket connection error: ${path}`, err)
        setError(err.message)
        setIsConnected(false)
        scheduleReconnect()
      })

      newSocket.on('error', (err) => {
        console.error(`WebSocket error: ${path}`, err)
        setError(err.message || 'WebSocket error')
      })

      setSocket(newSocket)
    } catch (err) {
      console.error(`Failed to create WebSocket connection: ${path}`, err)
      setError(err instanceof Error ? err.message : 'Connection failed')
    }
  }

  const scheduleReconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      console.log(`Attempting to reconnect WebSocket: ${path}`)
      connect()
    }, 5000) // Reconnect after 5 seconds
  }

  const reconnect = () => {
    if (socket) {
      socket.disconnect()
    }
    connect()
  }

  useEffect(() => {
    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      
      if (socket) {
        socket.disconnect()
      }
    }
  }, [path])

  return {
    socket,
    isConnected,
    error,
    reconnect
  }
}