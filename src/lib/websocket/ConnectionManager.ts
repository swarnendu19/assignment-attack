/**
 * WebSocket Connection Manager with pooling and optimization
 * Handles connection lifecycle, pooling, and message batching
 */

interface ConnectionConfig {
  maxReconnectAttempts: number
  reconnectDelay: number
  heartbeatInterval: number
  messageBufferSize: number
  batchTimeout: number
}

interface QueuedMessage {
  id: string
  type: string
  data: any
  timestamp: number
  priority: 'high' | 'normal' | 'low'
}

interface ConnectionMetrics {
  messagesPerSecond: number
  averageLatency: number
  connectionUptime: number
  reconnectCount: number
}

export class WebSocketConnectionManager {
  private ws: WebSocket | null = null
  private isConnecting = false
  private reconnectAttempts = 0
  private messageQueue: QueuedMessage[] = []
  private batchTimer: NodeJS.Timeout | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private subscriptions = new Set<string>()
  private messageCallbacks = new Map<string, Set<(data: any) => void>>()
  private metrics: ConnectionMetrics = {
    messagesPerSecond: 0,
    averageLatency: 0,
    connectionUptime: 0,
    reconnectCount: 0
  }
  private messageTimestamps: number[] = []
  private connectionStartTime = 0

  private config: ConnectionConfig = {
    maxReconnectAttempts: 5,
    reconnectDelay: 1000,
    heartbeatInterval: 30000,
    messageBufferSize: 100,
    batchTimeout: 50 // 50ms batching window
  }

  constructor(private url: string, config?: Partial<ConnectionConfig>) {
    if (config) {
      this.config = { ...this.config, ...config }
    }
  }

  /**
   * Connect to WebSocket with automatic retry logic
   */
  async connect(token?: string): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return
    }

    this.isConnecting = true

    try {
      this.ws = new WebSocket(this.url)
      this.connectionStartTime = Date.now()

      this.ws.onopen = () => {
        console.log('WebSocket connected')
        this.isConnecting = false
        this.reconnectAttempts = 0
        
        // Send authentication if token provided
        if (token) {
          this.send('auth', { token }, 'high')
        }

        // Resubscribe to previous subscriptions
        this.resubscribe()
        
        // Start heartbeat
        this.startHeartbeat()
        
        // Process queued messages
        this.processMessageQueue()
      }

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data)
      }

      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason)
        this.cleanup()
        
        if (!event.wasClean && this.reconnectAttempts < this.config.maxReconnectAttempts) {
          this.scheduleReconnect()
        }
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        this.isConnecting = false
      }

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      this.isConnecting = false
      throw error
    }
  }

  /**
   * Disconnect WebSocket connection
   */
  disconnect(): void {
    this.cleanup()
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }
  }

  /**
   * Send message with batching and priority handling
   */
  send(type: string, data: any, priority: 'high' | 'normal' | 'low' = 'normal'): void {
    const message: QueuedMessage = {
      id: this.generateMessageId(),
      type,
      data,
      timestamp: Date.now(),
      priority
    }

    if (this.ws?.readyState === WebSocket.OPEN && priority === 'high') {
      // Send high priority messages immediately
      this.sendMessage(message)
    } else {
      // Queue message for batching
      this.queueMessage(message)
    }
  }

  /**
   * Subscribe to specific message types with selective updates
   */
  subscribe(messageType: string, callback: (data: any) => void): () => void {
    if (!this.messageCallbacks.has(messageType)) {
      this.messageCallbacks.set(messageType, new Set())
    }
    
    this.messageCallbacks.get(messageType)!.add(callback)
    this.subscriptions.add(messageType)

    // Send subscription message to server
    this.send('subscribe', { messageType }, 'high')

    // Return unsubscribe function
    return () => {
      const callbacks = this.messageCallbacks.get(messageType)
      if (callbacks) {
        callbacks.delete(callback)
        if (callbacks.size === 0) {
          this.messageCallbacks.delete(messageType)
          this.subscriptions.delete(messageType)
          this.send('unsubscribe', { messageType }, 'high')
        }
      }
    }
  }

  /**
   * Get connection metrics
   */
  getMetrics(): ConnectionMetrics {
    return {
      ...this.metrics,
      connectionUptime: this.connectionStartTime ? Date.now() - this.connectionStartTime : 0
    }
  }

  /**
   * Check if connection is healthy
   */
  isHealthy(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && 
           this.reconnectAttempts < this.config.maxReconnectAttempts
  }

  private handleMessage(rawData: string): void {
    try {
      const message = JSON.parse(rawData)
      
      // Update metrics
      this.updateMetrics()
      
      // Handle system messages
      if (message.type === 'pong') {
        return // Heartbeat response
      }

      // Dispatch to subscribers
      const callbacks = this.messageCallbacks.get(message.type)
      if (callbacks) {
        callbacks.forEach(callback => {
          try {
            callback(message.data)
          } catch (error) {
            console.error('Error in message callback:', error)
          }
        })
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error)
    }
  }

  private queueMessage(message: QueuedMessage): void {
    // Add to queue with priority sorting
    this.messageQueue.push(message)
    this.messageQueue.sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })

    // Limit queue size
    if (this.messageQueue.length > this.config.messageBufferSize) {
      this.messageQueue = this.messageQueue.slice(0, this.config.messageBufferSize)
    }

    // Start batch timer if not already running
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.processBatch()
      }, this.config.batchTimeout)
    }
  }

  private processBatch(): void {
    if (this.messageQueue.length === 0) {
      this.batchTimer = null
      return
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      // Send batch of messages
      const batch = this.messageQueue.splice(0, Math.min(10, this.messageQueue.length))
      
      if (batch.length === 1) {
        this.sendMessage(batch[0])
      } else {
        // Send as batch
        this.ws.send(JSON.stringify({
          type: 'batch',
          messages: batch.map(msg => ({
            type: msg.type,
            data: msg.data,
            id: msg.id
          }))
        }))
      }
    }

    // Schedule next batch if queue not empty
    if (this.messageQueue.length > 0) {
      this.batchTimer = setTimeout(() => {
        this.processBatch()
      }, this.config.batchTimeout)
    } else {
      this.batchTimer = null
    }
  }

  private sendMessage(message: QueuedMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: message.type,
        data: message.data,
        id: message.id
      }))
    }
  }

  private processMessageQueue(): void {
    if (this.messageQueue.length > 0) {
      this.processBatch()
    }
  }

  private resubscribe(): void {
    this.subscriptions.forEach(messageType => {
      this.send('subscribe', { messageType }, 'high')
    })
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send('ping', {}, 'high')
      }
    }, this.config.heartbeatInterval)
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++
    const delay = this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
    
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`)
    
    setTimeout(() => {
      this.connect()
    }, delay)
  }

  private cleanup(): void {
    this.isConnecting = false
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }
  }

  private updateMetrics(): void {
    const now = Date.now()
    this.messageTimestamps.push(now)
    
    // Keep only last 60 seconds of timestamps
    const cutoff = now - 60000
    this.messageTimestamps = this.messageTimestamps.filter(ts => ts > cutoff)
    
    // Calculate messages per second
    this.metrics.messagesPerSecond = this.messageTimestamps.length / 60
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}