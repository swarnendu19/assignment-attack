import { Server as SocketIOServer } from 'socket.io'
import { Server as HTTPServer } from 'http'
import { analyticsService } from './analyticsService'
import { RealTimeMetrics, AnalyticsFilter } from '@/types/analytics'

export class AnalyticsWebSocketService {
  private io: SocketIOServer | null = null
  private updateInterval: NodeJS.Timeout | null = null
  private connectedClients = new Map<string, { teamId: string; filters?: AnalyticsFilter }>()

  /**
   * Initialize WebSocket server
   */
  initialize(server: HTTPServer): void {
    this.io = new SocketIOServer(server, {
      path: '/api/analytics/socket',
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        methods: ['GET', 'POST']
      }
    })

    this.setupEventHandlers()
    this.startRealTimeUpdates()

    console.log('Analytics WebSocket service initialized')
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.io) return

    this.io.on('connection', (socket) => {
      console.log(`Analytics client connected: ${socket.id}`)

      // Handle client authentication and subscription
      socket.on('subscribe', async (data: { teamId: string; filters?: AnalyticsFilter }) => {
        try {
          // Store client info
          this.connectedClients.set(socket.id, {
            teamId: data.teamId,
            filters: data.filters
          })

          // Join team room
          socket.join(`team:${data.teamId}`)

          // Send initial metrics
          const realTimeMetrics = await analyticsService.getRealTimeMetrics(data.teamId)
          socket.emit('realtime-metrics', realTimeMetrics)

          console.log(`Client ${socket.id} subscribed to team ${data.teamId}`)
        } catch (error) {
          console.error('Error handling analytics subscription:', error)
          socket.emit('error', { message: 'Failed to subscribe to analytics updates' })
        }
      })

      // Handle filter updates
      socket.on('update-filters', (filters: AnalyticsFilter) => {
        const clientInfo = this.connectedClients.get(socket.id)
        if (clientInfo) {
          this.connectedClients.set(socket.id, {
            ...clientInfo,
            filters
          })
          console.log(`Updated filters for client ${socket.id}`)
        }
      })

      // Handle disconnection
      socket.on('disconnect', () => {
        this.connectedClients.delete(socket.id)
        console.log(`Analytics client disconnected: ${socket.id}`)
      })

      // Handle custom metric requests
      socket.on('request-metrics', async (query: any) => {
        try {
          const clientInfo = this.connectedClients.get(socket.id)
          if (!clientInfo) {
            socket.emit('error', { message: 'Client not subscribed' })
            return
          }

          const metrics = await analyticsService.getAnalyticsMetrics({
            ...query,
            teamId: clientInfo.teamId
          })

          socket.emit('custom-metrics', metrics)
        } catch (error) {
          console.error('Error handling custom metrics request:', error)
          socket.emit('error', { message: 'Failed to fetch custom metrics' })
        }
      })
    })
  }

  /**
   * Start real-time updates
   */
  private startRealTimeUpdates(): void {
    // Update every 30 seconds
    this.updateInterval = setInterval(async () => {
      await this.broadcastRealTimeUpdates()
    }, 30000)

    console.log('Started real-time analytics updates (30s interval)')
  }

  /**
   * Stop real-time updates
   */
  stopRealTimeUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }
    console.log('Stopped real-time analytics updates')
  }

  /**
   * Broadcast real-time updates to all connected clients
   */
  private async broadcastRealTimeUpdates(): Promise<void> {
    if (!this.io) return

    // Get unique team IDs from connected clients
    const teamIds = new Set<string>()
    this.connectedClients.forEach(client => teamIds.add(client.teamId))

    // Update metrics for each team
    for (const teamId of teamIds) {
      try {
        const realTimeMetrics = await analyticsService.getRealTimeMetrics(teamId)
        
        // Broadcast to all clients in the team room
        this.io.to(`team:${teamId}`).emit('realtime-metrics', realTimeMetrics)
        
        // Also broadcast performance metrics if there are significant changes
        await this.checkAndBroadcastPerformanceAlerts(teamId, realTimeMetrics)
        
      } catch (error) {
        console.error(`Error updating real-time metrics for team ${teamId}:`, error)
      }
    }
  }

  /**
   * Check for performance alerts and broadcast if needed
   */
  private async checkAndBroadcastPerformanceAlerts(
    teamId: string, 
    metrics: RealTimeMetrics
  ): Promise<void> {
    const alerts = []

    // Check for high response time
    if (metrics.averageResponseTime > 60) { // More than 1 hour
      alerts.push({
        type: 'high-response-time',
        severity: 'warning',
        message: `Average response time is ${Math.round(metrics.averageResponseTime)} minutes`,
        value: metrics.averageResponseTime
      })
    }

    // Check for high pending messages
    if (metrics.pendingMessages > 50) {
      alerts.push({
        type: 'high-pending-messages',
        severity: 'warning',
        message: `${metrics.pendingMessages} messages pending response`,
        value: metrics.pendingMessages
      })
    }

    // Check for low active users during business hours
    const now = new Date()
    const hour = now.getHours()
    if (hour >= 9 && hour <= 17 && metrics.activeUsers < 2) { // Business hours
      alerts.push({
        type: 'low-active-users',
        severity: 'info',
        message: `Only ${metrics.activeUsers} users active during business hours`,
        value: metrics.activeUsers
      })
    }

    // Broadcast alerts if any
    if (alerts.length > 0 && this.io) {
      this.io.to(`team:${teamId}`).emit('performance-alerts', alerts)
    }
  }

  /**
   * Broadcast metric update to specific team
   */
  async broadcastMetricUpdate(
    teamId: string, 
    metricType: string, 
    data: any
  ): Promise<void> {
    if (!this.io) return

    this.io.to(`team:${teamId}`).emit('metric-update', {
      type: metricType,
      data,
      timestamp: new Date()
    })
  }

  /**
   * Broadcast dashboard refresh to specific team
   */
  async broadcastDashboardRefresh(teamId: string): Promise<void> {
    if (!this.io) return

    this.io.to(`team:${teamId}`).emit('dashboard-refresh', {
      timestamp: new Date()
    })
  }

  /**
   * Get connected clients count
   */
  getConnectedClientsCount(): number {
    return this.connectedClients.size
  }

  /**
   * Get connected clients by team
   */
  getConnectedClientsByTeam(teamId: string): number {
    let count = 0
    this.connectedClients.forEach(client => {
      if (client.teamId === teamId) count++
    })
    return count
  }

  /**
   * Shutdown the service
   */
  shutdown(): void {
    this.stopRealTimeUpdates()
    
    if (this.io) {
      this.io.close()
      this.io = null
    }

    this.connectedClients.clear()
    console.log('Analytics WebSocket service shutdown')
  }
}

export const analyticsWebSocketService = new AnalyticsWebSocketService()