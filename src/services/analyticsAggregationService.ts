import { PrismaClient } from '@prisma/client'
import { AggregationJob, AggregatedData } from '@/types/analytics'
import { analyticsService } from './analyticsService'

const prisma = new PrismaClient()

export class AnalyticsAggregationService {
  private isProcessing = false
  private processingInterval: NodeJS.Timeout | null = null

  /**
   * Start the aggregation job processor
   */
  startProcessor(intervalMinutes = 5): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
    }

    this.processingInterval = setInterval(
      () => this.processPendingJobs(),
      intervalMinutes * 60 * 1000
    )

    console.log(`Analytics aggregation processor started (interval: ${intervalMinutes} minutes)`)
  }

  /**
   * Stop the aggregation job processor
   */
  stopProcessor(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
    }
    console.log('Analytics aggregation processor stopped')
  }

  /**
   * Schedule hourly aggregation jobs
   */
  async scheduleHourlyAggregation(): Promise<void> {
    const now = new Date()
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000)
    lastHour.setMinutes(0, 0, 0) // Round to hour

    const endTime = new Date(lastHour.getTime() + 60 * 60 * 1000)

    // Check if job already exists
    const existingJob = await this.findExistingJob('hourly', lastHour, endTime)
    if (existingJob) {
      return
    }

    await this.createAggregationJob('hourly', lastHour, endTime)
    console.log(`Scheduled hourly aggregation job for ${lastHour.toISOString()}`)
  }

  /**
   * Schedule daily aggregation jobs
   */
  async scheduleDailyAggregation(): Promise<void> {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    yesterday.setHours(0, 0, 0, 0) // Start of day

    const endTime = new Date(yesterday.getTime() + 24 * 60 * 60 * 1000)

    const existingJob = await this.findExistingJob('daily', yesterday, endTime)
    if (existingJob) {
      return
    }

    await this.createAggregationJob('daily', yesterday, endTime)
    console.log(`Scheduled daily aggregation job for ${yesterday.toISOString()}`)
  }

  /**
   * Schedule weekly aggregation jobs
   */
  async scheduleWeeklyAggregation(): Promise<void> {
    const now = new Date()
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    
    // Get start of week (Monday)
    const dayOfWeek = lastWeek.getDay()
    const startOfWeek = new Date(lastWeek)
    startOfWeek.setDate(lastWeek.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
    startOfWeek.setHours(0, 0, 0, 0)

    const endTime = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000)

    const existingJob = await this.findExistingJob('weekly', startOfWeek, endTime)
    if (existingJob) {
      return
    }

    await this.createAggregationJob('weekly', startOfWeek, endTime)
    console.log(`Scheduled weekly aggregation job for ${startOfWeek.toISOString()}`)
  }

  /**
   * Schedule monthly aggregation jobs
   */
  async scheduleMonthlyAggregation(): Promise<void> {
    const now = new Date()
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endTime = new Date(now.getFullYear(), now.getMonth(), 1)

    const existingJob = await this.findExistingJob('monthly', lastMonth, endTime)
    if (existingJob) {
      return
    }

    await this.createAggregationJob('monthly', lastMonth, endTime)
    console.log(`Scheduled monthly aggregation job for ${lastMonth.toISOString()}`)
  }

  /**
   * Process pending aggregation jobs
   */
  async processPendingJobs(): Promise<void> {
    if (this.isProcessing) {
      console.log('Aggregation job processing already in progress, skipping...')
      return
    }

    this.isProcessing = true

    try {
      // Get pending jobs (this would be from a proper job queue in production)
      const pendingJobs = await this.getPendingJobs()

      for (const job of pendingJobs) {
        try {
          await this.processJob(job)
        } catch (error) {
          console.error(`Failed to process aggregation job ${job.id}:`, error)
          await this.markJobFailed(job.id, error instanceof Error ? error.message : 'Unknown error')
        }
      }
    } catch (error) {
      console.error('Error processing aggregation jobs:', error)
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Process a single aggregation job
   */
  async processJob(job: AggregationJob): Promise<void> {
    console.log(`Processing ${job.type} aggregation job ${job.id} for ${job.startDate.toISOString()}`)

    await this.markJobRunning(job.id)

    // Get all teams to aggregate data for
    const teams = await prisma.team.findMany({
      select: { id: true }
    })

    for (const team of teams) {
      const aggregatedData = await this.aggregateDataForPeriod(
        team.id,
        job.type,
        job.startDate,
        job.endDate
      )

      await this.storeAggregatedData(aggregatedData)
    }

    await this.markJobCompleted(job.id)
    console.log(`Completed ${job.type} aggregation job ${job.id}`)
  }

  /**
   * Aggregate data for a specific period and team
   */
  async aggregateDataForPeriod(
    teamId: string,
    type: 'hourly' | 'daily' | 'weekly' | 'monthly',
    startDate: Date,
    endDate: Date
  ): Promise<AggregatedData> {
    // Get analytics metrics for the period
    const metrics = await analyticsService.getAnalyticsMetrics({
      dateRange: { startDate, endDate },
      teamId,
      granularity: type === 'hourly' ? 'hour' : 'day'
    })

    // Convert metrics to flat structure for storage
    const flatMetrics: Record<string, number> = {
      // Response time metrics
      'responseTime.average': metrics.responseTime.averageResponseTime,
      'responseTime.median': metrics.responseTime.medianResponseTime,
      'responseTime.firstResponse': metrics.responseTime.firstResponseTime,
      'responseTime.resolution': metrics.responseTime.resolutionTime,

      // Message volume metrics
      'volume.total': metrics.messageVolume.totalMessages,
      'volume.inbound': metrics.messageVolume.inboundMessages,
      'volume.outbound': metrics.messageVolume.outboundMessages,

      // Engagement metrics
      'engagement.totalConversations': metrics.engagement.totalConversations,
      'engagement.activeConversations': metrics.engagement.activeConversations,
      'engagement.averageMessagesPerConversation': metrics.engagement.averageMessagesPerConversation,
      'engagement.resolutionRate': metrics.engagement.conversationResolutionRate,

      // Conversion metrics
      'conversion.totalLeads': metrics.conversionFunnel.totalLeads,
      'conversion.qualifiedLeads': metrics.conversionFunnel.qualifiedLeads,
      'conversion.opportunities': metrics.conversionFunnel.opportunitiesCreated,
      'conversion.won': metrics.conversionFunnel.dealsWon,
      'conversion.overallRate': metrics.conversionFunnel.conversionRates.overallConversion,
    }

    // Add channel-specific metrics
    Object.entries(metrics.channelPerformance.channelStats).forEach(([channel, stats]) => {
      flatMetrics[`channel.${channel}.messages`] = stats.messageCount
      flatMetrics[`channel.${channel}.conversations`] = stats.conversationCount
      flatMetrics[`channel.${channel}.responseTime`] = stats.averageResponseTime
      flatMetrics[`channel.${channel}.resolutionRate`] = stats.resolutionRate
      flatMetrics[`channel.${channel}.activeUsers`] = stats.activeUsers
    })

    // Add user-specific metrics
    Object.entries(metrics.teamPerformance.userStats).forEach(([userId, stats]) => {
      flatMetrics[`user.${userId}.messages`] = stats.messageCount
      flatMetrics[`user.${userId}.conversations`] = stats.conversationCount
      flatMetrics[`user.${userId}.responseTime`] = stats.averageResponseTime
      flatMetrics[`user.${userId}.resolutionRate`] = stats.resolutionRate
      flatMetrics[`user.${userId}.workloadScore`] = stats.workloadScore
    })

    return {
      id: `${teamId}_${type}_${startDate.getTime()}`,
      type,
      date: startDate,
      teamId,
      metrics: flatMetrics,
      metadata: {
        endDate: endDate.toISOString(),
        channelCount: Object.keys(metrics.channelPerformance.channelStats).length,
        userCount: Object.keys(metrics.teamPerformance.userStats).length,
      },
      createdAt: new Date()
    }
  }

  /**
   * Store aggregated data
   */
  async storeAggregatedData(data: AggregatedData): Promise<void> {
    // In a real implementation, this would store to a dedicated aggregated_data table
    // For now, we'll use a simple JSON storage approach
    
    try {
      // Check if data already exists
      const existing = await this.getAggregatedData(data.teamId, data.type, data.date)
      
      if (existing) {
        // Update existing data
        console.log(`Updating existing aggregated data for ${data.teamId} ${data.type} ${data.date.toISOString()}`)
        // Update logic would go here
      } else {
        // Create new aggregated data record
        console.log(`Creating new aggregated data for ${data.teamId} ${data.type} ${data.date.toISOString()}`)
        // Insert logic would go here
      }
    } catch (error) {
      console.error('Error storing aggregated data:', error)
      throw error
    }
  }

  /**
   * Get aggregated data
   */
  async getAggregatedData(
    teamId: string,
    type: 'hourly' | 'daily' | 'weekly' | 'monthly',
    date: Date
  ): Promise<AggregatedData | null> {
    // This would query the aggregated_data table
    // For now, return null to indicate no existing data
    return null
  }

  /**
   * Clean up old aggregated data based on retention policies
   */
  async cleanupOldData(): Promise<void> {
    const now = new Date()
    
    // Retention policies
    const retentionPolicies = {
      hourly: 30, // Keep hourly data for 30 days
      daily: 365, // Keep daily data for 1 year
      weekly: 365 * 2, // Keep weekly data for 2 years
      monthly: 365 * 5, // Keep monthly data for 5 years
    }

    for (const [type, retentionDays] of Object.entries(retentionPolicies)) {
      const cutoffDate = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000)
      
      try {
        // Delete old aggregated data
        console.log(`Cleaning up ${type} data older than ${cutoffDate.toISOString()}`)
        // Delete logic would go here
      } catch (error) {
        console.error(`Error cleaning up ${type} data:`, error)
      }
    }
  }

  /**
   * Private helper methods
   */
  private async createAggregationJob(
    type: 'hourly' | 'daily' | 'weekly' | 'monthly',
    startDate: Date,
    endDate: Date
  ): Promise<AggregationJob> {
    // In a real implementation, this would create a job in a job queue
    const job: AggregationJob = {
      id: `${type}_${startDate.getTime()}_${Date.now()}`,
      type,
      status: 'pending',
      startDate,
      endDate,
      createdAt: new Date()
    }

    // Store job in queue/database
    console.log(`Created ${type} aggregation job: ${job.id}`)
    
    return job
  }

  private async findExistingJob(
    type: 'hourly' | 'daily' | 'weekly' | 'monthly',
    startDate: Date,
    endDate: Date
  ): Promise<AggregationJob | null> {
    // This would query the job queue/database
    // For now, return null to indicate no existing job
    return null
  }

  private async getPendingJobs(): Promise<AggregationJob[]> {
    // This would query pending jobs from the job queue
    // For now, return empty array
    return []
  }

  private async markJobRunning(jobId: string): Promise<void> {
    console.log(`Marking job ${jobId} as running`)
    // Update job status to 'running'
  }

  private async markJobCompleted(jobId: string): Promise<void> {
    console.log(`Marking job ${jobId} as completed`)
    // Update job status to 'completed' and set completedAt timestamp
  }

  private async markJobFailed(jobId: string, error: string): Promise<void> {
    console.log(`Marking job ${jobId} as failed: ${error}`)
    // Update job status to 'failed' and set error message
  }
}

export const analyticsAggregationService = new AnalyticsAggregationService()