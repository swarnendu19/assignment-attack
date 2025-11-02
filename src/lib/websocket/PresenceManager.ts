/**
 * Presence Manager with throttling and optimization
 * Handles user presence tracking with efficient updates
 */

interface PresenceState {
  userId: string
  userName: string
  status: 'online' | 'offline' | 'away' | 'busy'
  lastSeen: Date
  currentResource?: string // conversation, document, etc.
  metadata?: Record<string, any>
}

interface PresenceUpdate {
  userId: string
  status?: 'online' | 'offline' | 'away' | 'busy'
  resource?: string
  metadata?: Record<string, any>
}

interface ThrottleConfig {
  presenceUpdateInterval: number
  batchSize: number
  maxPendingUpdates: number
}

export class PresenceManager {
  private presenceMap = new Map<string, PresenceState>()
  private pendingUpdates = new Map<string, PresenceUpdate>()
  private updateTimer: NodeJS.Timeout | null = null
  private lastUpdateTime = 0
  private subscribers = new Set<(presenceMap: Map<string, PresenceState>) => void>()

  private config: ThrottleConfig = {
    presenceUpdateInterval: 2000, // 2 seconds
    batchSize: 10,
    maxPendingUpdates: 100
  }

  constructor(
    private connectionManager: any, // WebSocketConnectionManager
    config?: Partial<ThrottleConfig>
  ) {
    if (config) {
      this.config = { ...this.config, ...config }
    }

    // Subscribe to presence messages
    this.connectionManager.subscribe('presence_update', this.handlePresenceUpdate.bind(this))
    this.connectionManager.subscribe('presence_batch', this.handlePresenceBatch.bind(this))
  }

  /**
   * Update current user's presence with throttling
   */
  updatePresence(update: Omit<PresenceUpdate, 'userId'>): void {
    const userId = this.getCurrentUserId()
    if (!userId) return

    const fullUpdate: PresenceUpdate = { userId, ...update }
    
    // Store pending update (overwrites previous pending update for same user)
    this.pendingUpdates.set(userId, fullUpdate)
    
    // Limit pending updates
    if (this.pendingUpdates.size > this.config.maxPendingUpdates) {
      const oldestKey = this.pendingUpdates.keys().next().value
      this.pendingUpdates.delete(oldestKey)
    }

    // Schedule batch update if not already scheduled
    this.scheduleUpdate()
  }

  /**
   * Set user status (online, away, busy, offline)
   */
  setStatus(status: PresenceState['status']): void {
    this.updatePresence({ status })
  }

  /**
   * Set current resource (conversation, document, etc.)
   */
  setCurrentResource(resource: string, metadata?: Record<string, any>): void {
    this.updatePresence({ resource, metadata })
  }

  /**
   * Clear current resource
   */
  clearCurrentResource(): void {
    this.updatePresence({ resource: undefined, metadata: undefined })
  }

  /**
   * Get presence state for a user
   */
  getPresence(userId: string): PresenceState | undefined {
    return this.presenceMap.get(userId)
  }

  /**
   * Get all presence states
   */
  getAllPresence(): Map<string, PresenceState> {
    return new Map(this.presenceMap)
  }

  /**
   * Get users present in a specific resource
   */
  getUsersInResource(resource: string): PresenceState[] {
    return Array.from(this.presenceMap.values())
      .filter(presence => presence.currentResource === resource && presence.status !== 'offline')
  }

  /**
   * Subscribe to presence changes
   */
  subscribe(callback: (presenceMap: Map<string, PresenceState>) => void): () => void {
    this.subscribers.add(callback)
    
    // Send initial state
    callback(this.getAllPresence())
    
    return () => {
      this.subscribers.delete(callback)
    }
  }

  /**
   * Start presence tracking for current user
   */
  startTracking(): void {
    this.setStatus('online')
    
    // Set up automatic away detection
    this.setupAwayDetection()
    
    // Set up beforeunload handler
    window.addEventListener('beforeunload', () => {
      this.setStatus('offline')
    })
    
    // Set up visibility change handler
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.setStatus('away')
      } else {
        this.setStatus('online')
      }
    })
  }

  /**
   * Stop presence tracking
   */
  stopTracking(): void {
    this.setStatus('offline')
    this.clearScheduledUpdate()
  }

  private handlePresenceUpdate(data: PresenceState): void {
    const previousState = this.presenceMap.get(data.userId)
    
    // Update presence state
    this.presenceMap.set(data.userId, {
      ...data,
      lastSeen: new Date(data.lastSeen)
    })
    
    // Notify subscribers if state changed
    if (!previousState || this.hasPresenceChanged(previousState, data)) {
      this.notifySubscribers()
    }
  }

  private handlePresenceBatch(data: { updates: PresenceState[] }): void {
    let hasChanges = false
    
    data.updates.forEach(update => {
      const previousState = this.presenceMap.get(update.userId)
      
      this.presenceMap.set(update.userId, {
        ...update,
        lastSeen: new Date(update.lastSeen)
      })
      
      if (!previousState || this.hasPresenceChanged(previousState, update)) {
        hasChanges = true
      }
    })
    
    if (hasChanges) {
      this.notifySubscribers()
    }
  }

  private scheduleUpdate(): void {
    if (this.updateTimer) return
    
    const now = Date.now()
    const timeSinceLastUpdate = now - this.lastUpdateTime
    const delay = Math.max(0, this.config.presenceUpdateInterval - timeSinceLastUpdate)
    
    this.updateTimer = setTimeout(() => {
      this.sendPendingUpdates()
    }, delay)
  }

  private sendPendingUpdates(): void {
    if (this.pendingUpdates.size === 0) {
      this.updateTimer = null
      return
    }
    
    const updates = Array.from(this.pendingUpdates.values())
      .slice(0, this.config.batchSize)
    
    // Clear sent updates
    updates.forEach(update => {
      this.pendingUpdates.delete(update.userId)
    })
    
    // Send batch update
    if (updates.length === 1) {
      this.connectionManager.send('presence_update', updates[0], 'normal')
    } else {
      this.connectionManager.send('presence_batch', { updates }, 'normal')
    }
    
    this.lastUpdateTime = Date.now()
    this.updateTimer = null
    
    // Schedule next batch if more updates pending
    if (this.pendingUpdates.size > 0) {
      this.scheduleUpdate()
    }
  }

  private clearScheduledUpdate(): void {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer)
      this.updateTimer = null
    }
  }

  private setupAwayDetection(): void {
    let lastActivity = Date.now()
    const awayThreshold = 5 * 60 * 1000 // 5 minutes
    
    const updateActivity = () => {
      lastActivity = Date.now()
      if (this.getPresence(this.getCurrentUserId()!)?.status === 'away') {
        this.setStatus('online')
      }
    }
    
    // Track user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart']
    events.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true })
    })
    
    // Check for inactivity
    const checkInactivity = () => {
      const now = Date.now()
      const currentStatus = this.getPresence(this.getCurrentUserId()!)?.status
      
      if (now - lastActivity > awayThreshold && currentStatus === 'online') {
        this.setStatus('away')
      }
    }
    
    setInterval(checkInactivity, 60000) // Check every minute
  }

  private hasPresenceChanged(previous: PresenceState, current: PresenceState): boolean {
    return (
      previous.status !== current.status ||
      previous.currentResource !== current.currentResource ||
      JSON.stringify(previous.metadata) !== JSON.stringify(current.metadata)
    )
  }

  private notifySubscribers(): void {
    this.subscribers.forEach(callback => {
      try {
        callback(this.getAllPresence())
      } catch (error) {
        console.error('Error in presence subscriber:', error)
      }
    })
  }

  private getCurrentUserId(): string | null {
    // This should be implemented to get current user ID
    // For now, return a placeholder
    return 'current-user-id'
  }
}