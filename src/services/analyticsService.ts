import { PrismaClient, ChannelType, Direction } from '@prisma/client'
import {
  AnalyticsMetrics,
  AnalyticsQuery,
  ResponseTimeMetrics,
  MessageVolumeMetrics,
  EngagementMetrics,
  ConversionFunnelMetrics,
  ChannelPerformanceMetrics,
  TeamPerformanceMetrics,
  RealTimeMetrics,
  TimeSeriesData,
  ChannelStats,
  UserStats,
  AggregationJob,
  AggregatedData,
  AnalyticsQuerySchema
} from '@/types/analytics'

const prisma = new PrismaClient()

export class AnalyticsService {
  /**
   * Get comprehensive analytics metrics
   */
  async getAnalyticsMetrics(query: AnalyticsQuery): Promise<AnalyticsMetrics> {
    // Validate query
    const validatedQuery = AnalyticsQuerySchema.parse(query)

    const [
      responseTime,
      messageVolume,
      engagement,
      conversionFunnel,
      channelPerformance,
      teamPerformance
    ] = await Promise.all([
      this.calculateResponseTimeMetrics(validatedQuery),
      this.calculateMessageVolumeMetrics(validatedQuery),
      this.calculateEngagementMetrics(validatedQuery),
      this.calculateConversionFunnelMetrics(validatedQuery),
      this.calculateChannelPerformanceMetrics(validatedQuery),
      this.calculateTeamPerformanceMetrics(validatedQuery)
    ])

    return {
      responseTime,
      messageVolume,
      engagement,
      conversionFunnel,
      channelPerformance,
      teamPerformance
    }
  }

  /**
   * Calculate response time metrics
   */
  async calculateResponseTimeMetrics(query: AnalyticsQuery): Promise<ResponseTimeMetrics> {
    const { dateRange, channels, userIds, teamId } = query

    // Build where clause for conversations
    const conversationWhere: any = {
      teamId,
      createdAt: {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      },
    }

    if (channels?.length) {
      conversationWhere.channel = {
        type: { in: channels }
      }
    }

    if (userIds?.length) {
      conversationWhere.userId = { in: userIds }
    }

    // Get conversations with messages for response time calculation
    const conversations = await prisma.conversation.findMany({
      where: conversationWhere,
      include: {
        messages: {
          orderBy: { sentAt: 'asc' },
          include: { user: true }
        },
        channel: true,
        user: true
      }
    })

    const responseTimes: number[] = []
    const firstResponseTimes: number[] = []
    const resolutionTimes: number[] = []
    const responseTimeByChannel: Record<ChannelType, number[]> = {} as any
    const responseTimeByUser: Record<string, number[]> = {}

    for (const conversation of conversations) {
      const messages = conversation.messages
      if (messages.length < 2) continue

      // Find first inbound and first outbound response
      const firstInbound = messages.find(m => m.direction === Direction.INBOUND)
      const firstOutbound = messages.find(m => 
        m.direction === Direction.OUTBOUND && 
        firstInbound && 
        m.sentAt > firstInbound.sentAt
      )

      if (firstInbound && firstOutbound) {
        const responseTime = (firstOutbound.sentAt.getTime() - firstInbound.sentAt.getTime()) / (1000 * 60) // minutes
        responseTimes.push(responseTime)
        firstResponseTimes.push(responseTime)

        // Group by channel
        const channelType = conversation.channel.type
        if (!responseTimeByChannel[channelType]) {
          responseTimeByChannel[channelType] = []
        }
        responseTimeByChannel[channelType].push(responseTime)

        // Group by user
        const userId = firstOutbound.userId
        if (!responseTimeByUser[userId]) {
          responseTimeByUser[userId] = []
        }
        responseTimeByUser[userId].push(responseTime)
      }

      // Calculate resolution time (last message to conversation close/archive)
      const lastMessage = messages[messages.length - 1]
      if (conversation.status === 'CLOSED' || conversation.status === 'ARCHIVED') {
        const resolutionTime = (conversation.updatedAt.getTime() - lastMessage.sentAt.getTime()) / (1000 * 60)
        resolutionTimes.push(resolutionTime)
      }
    }

    // Calculate averages and medians
    const averageResponseTime = this.calculateAverage(responseTimes)
    const medianResponseTime = this.calculateMedian(responseTimes)
    const firstResponseTime = this.calculateAverage(firstResponseTimes)
    const resolutionTime = this.calculateAverage(resolutionTimes)

    // Calculate by channel averages
    const responseTimeByChannelAvg: Record<ChannelType, number> = {} as any
    for (const [channel, times] of Object.entries(responseTimeByChannel)) {
      responseTimeByChannelAvg[channel as ChannelType] = this.calculateAverage(times)
    }

    // Calculate by user averages
    const responseTimeByUserAvg: Record<string, number> = {}
    for (const [userId, times] of Object.entries(responseTimeByUser)) {
      responseTimeByUserAvg[userId] = this.calculateAverage(times)
    }

    // Generate trend data
    const responseTimeTrend = await this.generateResponseTimeTrend(query)

    return {
      averageResponseTime,
      medianResponseTime,
      firstResponseTime,
      resolutionTime,
      responseTimeByChannel: responseTimeByChannelAvg,
      responseTimeByUser: responseTimeByUserAvg,
      responseTimeTrend
    }
  }

  /**
   * Calculate message volume metrics
   */
  async calculateMessageVolumeMetrics(query: AnalyticsQuery): Promise<MessageVolumeMetrics> {
    const { dateRange, channels, userIds, teamId } = query

    // Build where clause for messages
    const messageWhere: any = {
      conversation: { teamId },
      sentAt: {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      },
    }

    if (channels?.length) {
      messageWhere.conversation = {
        ...messageWhere.conversation,
        channel: { type: { in: channels } }
      }
    }

    if (userIds?.length) {
      messageWhere.userId = { in: userIds }
    }

    // Get message counts
    const [totalMessages, inboundMessages, outboundMessages] = await Promise.all([
      prisma.message.count({ where: messageWhere }),
      prisma.message.count({ 
        where: { ...messageWhere, direction: Direction.INBOUND } 
      }),
      prisma.message.count({ 
        where: { ...messageWhere, direction: Direction.OUTBOUND } 
      })
    ])

    // Get messages by channel
    const messagesByChannelData = await prisma.message.groupBy({
      by: ['conversationId'],
      where: messageWhere,
      _count: { id: true },
      include: {
        conversation: {
          include: { channel: true }
        }
      }
    })

    // Process channel data (this is a simplified approach)
    const messagesByChannel: Record<ChannelType, number> = {} as any
    // Note: This would need a more complex query in practice

    // Get messages by user
    const messagesByUserData = await prisma.message.groupBy({
      by: ['userId'],
      where: messageWhere,
      _count: { id: true }
    })

    const messagesByUser: Record<string, number> = {}
    messagesByUserData.forEach(item => {
      messagesByUser[item.userId] = item._count.id
    })

    // Get messages by hour and day
    const messages = await prisma.message.findMany({
      where: messageWhere,
      select: { sentAt: true }
    })

    const messagesByHour: Record<number, number> = {}
    const messagesByDay: Record<string, number> = {}

    messages.forEach(message => {
      const hour = message.sentAt.getHours()
      const day = message.sentAt.toISOString().split('T')[0]

      messagesByHour[hour] = (messagesByHour[hour] || 0) + 1
      messagesByDay[day] = (messagesByDay[day] || 0) + 1
    })

    // Generate volume trend
    const volumeTrend = await this.generateVolumeTrend(query)

    return {
      totalMessages,
      inboundMessages,
      outboundMessages,
      messagesByChannel,
      messagesByUser,
      messagesByHour,
      messagesByDay,
      volumeTrend
    }
  }

  /**
   * Calculate engagement metrics
   */
  async calculateEngagementMetrics(query: AnalyticsQuery): Promise<EngagementMetrics> {
    const { dateRange, channels, userIds, teamId } = query

    const conversationWhere: any = {
      teamId,
      createdAt: {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      },
    }

    if (channels?.length) {
      conversationWhere.channel = {
        type: { in: channels }
      }
    }

    if (userIds?.length) {
      conversationWhere.userId = { in: userIds }
    }

    // Get conversation counts
    const [totalConversations, activeConversations] = await Promise.all([
      prisma.conversation.count({ where: conversationWhere }),
      prisma.conversation.count({ 
        where: { ...conversationWhere, status: 'ACTIVE' } 
      })
    ])

    // Calculate average messages per conversation
    const conversationsWithMessageCount = await prisma.conversation.findMany({
      where: conversationWhere,
      include: {
        _count: { select: { messages: true } },
        channel: true
      }
    })

    const totalMessageCount = conversationsWithMessageCount.reduce(
      (sum, conv) => sum + conv._count.messages, 0
    )
    const averageMessagesPerConversation = totalConversations > 0 
      ? totalMessageCount / totalConversations 
      : 0

    // Calculate resolution rate
    const resolvedConversations = await prisma.conversation.count({
      where: { 
        ...conversationWhere, 
        status: { in: ['CLOSED', 'ARCHIVED'] } 
      }
    })
    const conversationResolutionRate = totalConversations > 0 
      ? resolvedConversations / totalConversations 
      : 0

    // Calculate engagement by channel
    const engagementByChannel: Record<ChannelType, any> = {} as any
    const channelGroups = this.groupBy(conversationsWithMessageCount, conv => conv.channel.type)

    for (const [channelType, conversations] of channelGroups) {
      const channelMessageCount = conversations.reduce(
        (sum, conv) => sum + conv._count.messages, 0
      )
      const channelResolved = conversations.filter(
        conv => conv.status === 'CLOSED' || conv.status === 'ARCHIVED'
      ).length

      engagementByChannel[channelType as ChannelType] = {
        conversationCount: conversations.length,
        averageResponseTime: 0, // Would need additional calculation
        resolutionRate: conversations.length > 0 ? channelResolved / conversations.length : 0,
        customerSatisfaction: undefined // Would come from external data
      }
    }

    // Generate engagement trend
    const engagementTrend = await this.generateEngagementTrend(query)

    return {
      totalConversations,
      activeConversations,
      averageMessagesPerConversation,
      conversationResolutionRate,
      customerSatisfactionScore: undefined, // Would come from external surveys
      engagementByChannel,
      engagementTrend
    }
  }

  /**
   * Calculate conversion funnel metrics
   */
  async calculateConversionFunnelMetrics(query: AnalyticsQuery): Promise<ConversionFunnelMetrics> {
    // This would typically integrate with CRM data
    // For now, we'll use contact events and tags as proxies

    const { dateRange, teamId } = query

    // Get contacts created in date range
    const totalLeads = await prisma.contact.count({
      where: {
        teamId,
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        }
      }
    })

    // Use tags to identify qualified leads, opportunities, and won deals
    const qualifiedLeads = await prisma.contact.count({
      where: {
        teamId,
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
        tags: { has: 'qualified' }
      }
    })

    const opportunitiesCreated = await prisma.contact.count({
      where: {
        teamId,
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
        tags: { has: 'opportunity' }
      }
    })

    const dealsWon = await prisma.contact.count({
      where: {
        teamId,
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
        tags: { has: 'won' }
      }
    })

    // Calculate conversion rates
    const leadToQualified = totalLeads > 0 ? qualifiedLeads / totalLeads : 0
    const qualifiedToOpportunity = qualifiedLeads > 0 ? opportunitiesCreated / qualifiedLeads : 0
    const opportunityToWon = opportunitiesCreated > 0 ? dealsWon / opportunitiesCreated : 0
    const overallConversion = totalLeads > 0 ? dealsWon / totalLeads : 0

    // Calculate funnel by channel (simplified)
    const funnelByChannel: Record<ChannelType, any> = {} as any

    // Generate conversion trend
    const conversionTrend = await this.generateConversionTrend(query)

    return {
      totalLeads,
      qualifiedLeads,
      opportunitiesCreated,
      dealsWon,
      conversionRates: {
        leadToQualified,
        qualifiedToOpportunity,
        opportunityToWon,
        overallConversion
      },
      funnelByChannel,
      conversionTrend
    }
  }

  /**
   * Calculate channel performance metrics
   */
  async calculateChannelPerformanceMetrics(query: AnalyticsQuery): Promise<ChannelPerformanceMetrics> {
    const { dateRange, teamId } = query

    // Get all channels for the team
    const channels = await prisma.channel.findMany({
      where: { user: { teamId } },
      include: {
        conversations: {
          where: {
            createdAt: {
              gte: dateRange.startDate,
              lte: dateRange.endDate,
            }
          },
          include: {
            messages: true,
            _count: { select: { messages: true } }
          }
        }
      }
    })

    const channelStats: Record<ChannelType, ChannelStats> = {} as any
    const channelComparison: any[] = []
    const channelTrends: Record<ChannelType, TimeSeriesData[]> = {} as any

    for (const channel of channels) {
      const conversations = channel.conversations
      const messageCount = conversations.reduce(
        (sum, conv) => sum + conv._count.messages, 0
      )
      const conversationCount = conversations.length
      const resolvedCount = conversations.filter(
        conv => conv.status === 'CLOSED' || conv.status === 'ARCHIVED'
      ).length

      const stats: ChannelStats = {
        messageCount,
        conversationCount,
        averageResponseTime: 0, // Would need additional calculation
        resolutionRate: conversationCount > 0 ? resolvedCount / conversationCount : 0,
        customerSatisfaction: undefined,
        activeUsers: new Set(conversations.map(conv => conv.userId)).size
      }

      channelStats[channel.type] = stats

      channelComparison.push({
        channel: channel.type,
        messageCount,
        responseTime: stats.averageResponseTime,
        resolutionRate: stats.resolutionRate,
        growth: 0 // Would need historical comparison
      })

      // Generate trend data for this channel
      channelTrends[channel.type] = await this.generateChannelTrend(channel.type, query)
    }

    return {
      channelStats,
      channelComparison,
      channelTrends
    }
  }

  /**
   * Calculate team performance metrics
   */
  async calculateTeamPerformanceMetrics(query: AnalyticsQuery): Promise<TeamPerformanceMetrics> {
    const { dateRange, teamId, userIds } = query

    const userWhere: any = { teamId }
    if (userIds?.length) {
      userWhere.id = { in: userIds }
    }

    // Get team users with their conversations and messages
    const users = await prisma.user.findMany({
      where: userWhere,
      include: {
        conversations: {
          where: {
            createdAt: {
              gte: dateRange.startDate,
              lte: dateRange.endDate,
            }
          },
          include: {
            messages: true,
            channel: true,
            _count: { select: { messages: true } }
          }
        },
        messages: {
          where: {
            sentAt: {
              gte: dateRange.startDate,
              lte: dateRange.endDate,
            }
          }
        }
      }
    })

    const userStats: Record<string, UserStats> = {}
    const teamComparison: any[] = []
    const teamTrends: Record<string, TimeSeriesData[]> = {}

    for (const user of users) {
      const conversations = user.conversations
      const messages = user.messages
      const messageCount = messages.length
      const conversationCount = conversations.length
      const resolvedCount = conversations.filter(
        conv => conv.status === 'CLOSED' || conv.status === 'ARCHIVED'
      ).length

      const activeChannels = [...new Set(conversations.map(conv => conv.channel.type))]
      const workloadScore = this.calculateWorkloadScore(messageCount, conversationCount)

      const stats: UserStats = {
        messageCount,
        conversationCount,
        averageResponseTime: 0, // Would need additional calculation
        resolutionRate: conversationCount > 0 ? resolvedCount / conversationCount : 0,
        workloadScore,
        activeChannels
      }

      userStats[user.id] = stats

      teamComparison.push({
        userId: user.id,
        userName: user.name || user.email,
        messageCount,
        responseTime: stats.averageResponseTime,
        resolutionRate: stats.resolutionRate,
        workloadScore
      })

      // Generate trend data for this user
      teamTrends[user.id] = await this.generateUserTrend(user.id, query)
    }

    return {
      userStats,
      teamComparison,
      teamTrends
    }
  }

  /**
   * Get real-time metrics
   */
  async getRealTimeMetrics(teamId: string): Promise<RealTimeMetrics> {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    const [
      activeUsers,
      activeConversations,
      pendingMessages,
      recentMessages
    ] = await Promise.all([
      prisma.user.count({
        where: {
          teamId,
          lastActiveAt: { gte: oneHourAgo }
        }
      }),
      prisma.conversation.count({
        where: {
          teamId,
          status: 'ACTIVE',
          lastMessageAt: { gte: oneHourAgo }
        }
      }),
      prisma.message.count({
        where: {
          conversation: { teamId },
          direction: Direction.INBOUND,
          isRead: false
        }
      }),
      prisma.message.findMany({
        where: {
          conversation: { teamId },
          sentAt: { gte: oneHourAgo }
        },
        orderBy: { sentAt: 'asc' }
      })
    ])

    // Calculate messages per minute
    const messagesPerMinute = recentMessages.length / 60

    // Calculate average response time from recent data
    const averageResponseTime = 0 // Would need more complex calculation

    return {
      activeUsers,
      activeConversations,
      pendingMessages,
      averageResponseTime,
      messagesPerMinute,
      lastUpdated: now
    }
  }

  /**
   * Create aggregation job
   */
  async createAggregationJob(
    type: 'hourly' | 'daily' | 'weekly' | 'monthly',
    startDate: Date,
    endDate: Date
  ): Promise<AggregationJob> {
    const job = await prisma.$executeRaw`
      INSERT INTO aggregation_jobs (type, start_date, end_date, status, created_at)
      VALUES (${type}, ${startDate}, ${endDate}, 'pending', ${new Date()})
      RETURNING *
    `

    // In a real implementation, this would trigger a background job
    // For now, we'll return a mock job
    return {
      id: 'job_' + Date.now(),
      type,
      status: 'pending',
      startDate,
      endDate,
      createdAt: new Date()
    }
  }

  /**
   * Process aggregation job
   */
  async processAggregationJob(jobId: string): Promise<void> {
    // This would be implemented as a background job processor
    // It would calculate and store aggregated metrics for faster retrieval
    console.log(`Processing aggregation job: ${jobId}`)
  }

  /**
   * Private helper methods
   */
  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length
  }

  private calculateMedian(numbers: number[]): number {
    if (numbers.length === 0) return 0
    const sorted = [...numbers].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid]
  }

  private calculateWorkloadScore(messageCount: number, conversationCount: number): number {
    // Simple workload scoring algorithm
    return (messageCount * 0.1) + (conversationCount * 0.5)
  }

  private groupBy<T, K>(array: T[], keyFn: (item: T) => K): Map<K, T[]> {
    const groups = new Map<K, T[]>()
    for (const item of array) {
      const key = keyFn(item)
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(item)
    }
    return groups
  }

  private async generateResponseTimeTrend(query: AnalyticsQuery): Promise<TimeSeriesData[]> {
    // Generate time series data for response time trends
    // This would involve complex queries to calculate response times over time
    return []
  }

  private async generateVolumeTrend(query: AnalyticsQuery): Promise<TimeSeriesData[]> {
    // Generate time series data for message volume trends
    return []
  }

  private async generateEngagementTrend(query: AnalyticsQuery): Promise<TimeSeriesData[]> {
    // Generate time series data for engagement trends
    return []
  }

  private async generateConversionTrend(query: AnalyticsQuery): Promise<TimeSeriesData[]> {
    // Generate time series data for conversion trends
    return []
  }

  private async generateChannelTrend(channel: ChannelType, query: AnalyticsQuery): Promise<TimeSeriesData[]> {
    // Generate time series data for specific channel trends
    return []
  }

  private async generateUserTrend(userId: string, query: AnalyticsQuery): Promise<TimeSeriesData[]> {
    // Generate time series data for specific user trends
    return []
  }
}

export const analyticsService = new AnalyticsService()