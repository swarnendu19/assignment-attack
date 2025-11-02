import { PrismaClient } from '@prisma/client'
import { scheduledMessageService } from './scheduledMessageService'
import { messageService } from './messageService'
import { twilioService } from './twilioService'

const prisma = new PrismaClient()

export interface JobResult {
  success: boolean
  error?: string
  messageId?: string
}

export interface JobSchedule {
  name: string
  cronExpression: string
  handler: () => Promise<void>
  isActive: boolean
}

export class BackgroundJobService {
  private jobs: Map<string, JobSchedule> = new Map()
  private intervals: Map<string, NodeJS.Timeout> = new Map()
  private isRunning = false

  constructor() {
    this.registerDefaultJobs()
  }

  /**
   * Register default background jobs
   */
  private registerDefaultJobs(): void {
    // Process scheduled messages every minute
    this.registerJob({
      name: 'process-scheduled-messages',
      cronExpression: '* * * * *', // Every minute
      handler: this.processScheduledMessages.bind(this),
      isActive: true,
    })

    // Clean up old completed messages every hour
    this.registerJob({
      name: 'cleanup-old-messages',
      cronExpression: '0 * * * *', // Every hour
      handler: this.cleanupOldMessages.bind(this),
      isActive: true,
    })

    // Generate recurring message instances every 5 minutes
    this.registerJob({
      name: 'generate-recurring-messages',
      cronExpression: '*/5 * * * *', // Every 5 minutes
      handler: this.generateRecurringMessages.bind(this),
      isActive: true,
    })
  }

  /**
   * Register a new background job
   */
  registerJob(job: JobSchedule): void {
    this.jobs.set(job.name, job)
    
    if (this.isRunning && job.isActive) {
      this.scheduleJob(job)
    }
  }

  /**
   * Start all background jobs
   */
  start(): void {
    if (this.isRunning) {
      console.log('Background jobs are already running')
      return
    }

    console.log('Starting background job service...')
    this.isRunning = true

    for (const job of this.jobs.values()) {
      if (job.isActive) {
        this.scheduleJob(job)
      }
    }

    console.log(`Started ${this.intervals.size} background jobs`)
  }

  /**
   * Stop all background jobs
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('Background jobs are not running')
      return
    }

    console.log('Stopping background job service...')
    this.isRunning = false

    for (const [name, interval] of this.intervals.entries()) {
      clearInterval(interval)
      this.intervals.delete(name)
    }

    console.log('All background jobs stopped')
  }

  /**
   * Schedule a single job
   */
  private scheduleJob(job: JobSchedule): void {
    const intervalMs = this.cronToInterval(job.cronExpression)
    
    const interval = setInterval(async () => {
      try {
        console.log(`Running job: ${job.name}`)
        await job.handler()
        console.log(`Job completed: ${job.name}`)
      } catch (error) {
        console.error(`Job failed: ${job.name}`, error)
      }
    }, intervalMs)

    this.intervals.set(job.name, interval)
    console.log(`Scheduled job: ${job.name} (every ${intervalMs}ms)`)
  }

  /**
   * Process scheduled messages that are ready for delivery
   */
  private async processScheduledMessages(): Promise<void> {
    try {
      const readyMessages = await scheduledMessageService.getMessagesReadyForDelivery(50)
      
      if (readyMessages.length === 0) {
        return
      }

      console.log(`Processing ${readyMessages.length} scheduled messages`)

      const results = await Promise.allSettled(
        readyMessages.map(message => this.deliverScheduledMessage(message))
      )

      let successCount = 0
      let failureCount = 0

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success) {
          successCount++
        } else {
          failureCount++
          const message = readyMessages[index]
          console.error(`Failed to deliver message ${message.id}:`, 
            result.status === 'rejected' ? result.reason : result.value.error)
        }
      })

      console.log(`Scheduled message processing complete: ${successCount} sent, ${failureCount} failed`)
    } catch (error) {
      console.error('Error processing scheduled messages:', error)
    }
  }

  /**
   * Deliver a single scheduled message
   */
  private async deliverScheduledMessage(scheduledMessage: any): Promise<JobResult> {
    try {
      // Create the message content based on channel
      const messageContent = {
        text: scheduledMessage.content.text || '',
        attachments: scheduledMessage.content.attachments || [],
      }

      // Get contact information
      const contact = scheduledMessage.contact
      if (!contact) {
        throw new Error('Contact not found for scheduled message')
      }

      // Send message based on channel type
      let deliveryResult
      switch (scheduledMessage.channel) {
        case 'SMS':
          if (!contact.phone) {
            throw new Error('Contact phone number required for SMS')
          }
          deliveryResult = await twilioService.sendSMS({
            to: contact.phone,
            body: messageContent.text,
            mediaUrls: messageContent.attachments?.map(att => att.url) || [],
          })
          break

        case 'WHATSAPP':
          if (!contact.phone) {
            throw new Error('Contact phone number required for WhatsApp')
          }
          deliveryResult = await twilioService.sendWhatsApp({
            to: contact.phone,
            body: messageContent.text,
            mediaUrls: messageContent.attachments?.map(att => att.url) || [],
          })
          break

        default:
          throw new Error(`Unsupported channel type: ${scheduledMessage.channel}`)
      }

      // Mark message as sent
      await scheduledMessageService.markMessageAsSent(scheduledMessage.id)

      // Generate next occurrence if recurring
      if (scheduledMessage.recurrence) {
        await scheduledMessageService.generateNextOccurrence(scheduledMessage.id)
      }

      return {
        success: true,
        messageId: deliveryResult.sid || deliveryResult.id,
      }
    } catch (error) {
      // Mark message as failed
      await scheduledMessageService.markMessageAsFailed(
        scheduledMessage.id, 
        error instanceof Error ? error.message : 'Unknown error'
      )

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Clean up old completed scheduled messages
   */
  private async cleanupOldMessages(): Promise<void> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - 30) // Keep messages for 30 days

      const result = await prisma.scheduledMessage.deleteMany({
        where: {
          status: { in: ['SENT', 'FAILED'] },
          updatedAt: { lt: cutoffDate },
        },
      })

      if (result.count > 0) {
        console.log(`Cleaned up ${result.count} old scheduled messages`)
      }
    } catch (error) {
      console.error('Error cleaning up old messages:', error)
    }
  }

  /**
   * Generate recurring message instances
   */
  private async generateRecurringMessages(): Promise<void> {
    try {
      // Find sent messages with recurrence that need next instances
      const sentRecurringMessages = await prisma.scheduledMessage.findMany({
        where: {
          status: 'SENT',
          recurrence: { not: null },
        },
        include: {
          contact: true,
          user: true,
        },
      })

      for (const message of sentRecurringMessages) {
        try {
          // Check if next occurrence already exists
          const nextScheduledFor = this.calculateNextOccurrence(
            message.scheduledFor, 
            message.recurrence as any
          )

          if (!nextScheduledFor) continue

          const existingNext = await prisma.scheduledMessage.findFirst({
            where: {
              contactId: message.contactId,
              userId: message.userId,
              channel: message.channel,
              scheduledFor: nextScheduledFor,
              status: 'PENDING',
            },
          })

          if (!existingNext) {
            await scheduledMessageService.generateNextOccurrence(message.id)
          }
        } catch (error) {
          console.error(`Error generating next occurrence for message ${message.id}:`, error)
        }
      }
    } catch (error) {
      console.error('Error generating recurring messages:', error)
    }
  }

  /**
   * Calculate next occurrence for recurring messages
   */
  private calculateNextOccurrence(currentDate: Date, recurrence: any): Date | null {
    if (!recurrence || !recurrence.type) return null

    const nextDate = new Date(currentDate)

    switch (recurrence.type) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + (recurrence.interval || 1))
        break

      case 'weekly':
        nextDate.setDate(nextDate.getDate() + (7 * (recurrence.interval || 1)))
        break

      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + (recurrence.interval || 1))
        break

      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + (recurrence.interval || 1))
        break

      default:
        return null
    }

    // Check end date
    if (recurrence.endDate && nextDate > new Date(recurrence.endDate)) {
      return null
    }

    return nextDate
  }

  /**
   * Convert simple cron expression to interval milliseconds
   * This is a simplified implementation for basic patterns
   */
  private cronToInterval(cronExpression: string): number {
    const parts = cronExpression.split(' ')
    
    // Handle simple patterns
    if (cronExpression === '* * * * *') return 60 * 1000 // Every minute
    if (cronExpression === '0 * * * *') return 60 * 60 * 1000 // Every hour
    if (cronExpression === '*/5 * * * *') return 5 * 60 * 1000 // Every 5 minutes
    if (cronExpression === '0 0 * * *') return 24 * 60 * 60 * 1000 // Daily
    
    // Default to every minute for unsupported patterns
    console.warn(`Unsupported cron pattern: ${cronExpression}, defaulting to every minute`)
    return 60 * 1000
  }

  /**
   * Get job status
   */
  getJobStatus(): { name: string; isActive: boolean; isRunning: boolean }[] {
    return Array.from(this.jobs.values()).map(job => ({
      name: job.name,
      isActive: job.isActive,
      isRunning: this.intervals.has(job.name),
    }))
  }

  /**
   * Enable or disable a specific job
   */
  setJobActive(jobName: string, isActive: boolean): void {
    const job = this.jobs.get(jobName)
    if (!job) {
      throw new Error(`Job not found: ${jobName}`)
    }

    job.isActive = isActive

    if (this.isRunning) {
      if (isActive && !this.intervals.has(jobName)) {
        this.scheduleJob(job)
      } else if (!isActive && this.intervals.has(jobName)) {
        const interval = this.intervals.get(jobName)
        if (interval) {
          clearInterval(interval)
          this.intervals.delete(jobName)
        }
      }
    }
  }
}

export const backgroundJobService = new BackgroundJobService()