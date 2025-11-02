import { PrismaClient, ScheduledMessageStatus, ChannelType } from '@prisma/client'
import { 
  CreateScheduledMessageInput,
  UpdateScheduledMessageInput,
  CreateScheduledMessageSchema,
  UpdateScheduledMessageSchema,
  RecurrencePattern,
  RecurrencePatternSchema
} from '@/types/database'

const prisma = new PrismaClient()

export interface ScheduledMessageWithDetails {
  id: string
  channel: ChannelType
  content: Record<string, unknown>
  scheduledFor: Date
  recurrence?: RecurrencePattern
  status: ScheduledMessageStatus
  createdAt: Date
  updatedAt: Date
  contactId: string
  userId: string
  contact?: {
    id: string
    name?: string
    email?: string
    phone?: string
  }
  user?: {
    id: string
    name?: string
    email: string
  }
}

export interface ScheduledMessageSearchQuery {
  status?: ScheduledMessageStatus
  channel?: ChannelType
  contactId?: string
  userId?: string
  scheduledAfter?: Date
  scheduledBefore?: Date
  limit?: number
  offset?: number
}

export class ScheduledMessageService {
  /**
   * Create a new scheduled message
   */
  async createScheduledMessage(
    input: CreateScheduledMessageInput,
    userId: string
  ): Promise<ScheduledMessageWithDetails> {
    // Validate input
    const validatedInput = CreateScheduledMessageSchema.parse(input)

    // Validate recurrence pattern if provided
    if (validatedInput.recurrence) {
      RecurrencePatternSchema.parse(validatedInput.recurrence)
    }

    // Verify contact exists
    const contact = await prisma.contact.findUnique({
      where: { id: validatedInput.contactId },
    })

    if (!contact) {
      throw new Error('Contact not found')
    }

    const scheduledMessage = await prisma.scheduledMessage.create({
      data: {
        channel: validatedInput.channel,
        content: validatedInput.content as any,
        scheduledFor: validatedInput.scheduledFor,
        recurrence: validatedInput.recurrence as any,
        contactId: validatedInput.contactId,
        userId,
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return this.mapToScheduledMessageWithDetails(scheduledMessage)
  }

  /**
   * Update a scheduled message
   */
  async updateScheduledMessage(
    id: string,
    input: UpdateScheduledMessageInput,
    userId: string
  ): Promise<ScheduledMessageWithDetails> {
    // Validate input
    const validatedInput = UpdateScheduledMessageSchema.parse(input)

    // Validate recurrence pattern if provided
    if (validatedInput.recurrence) {
      RecurrencePatternSchema.parse(validatedInput.recurrence)
    }

    // Check if message exists and user has permission
    const existingMessage = await prisma.scheduledMessage.findUnique({
      where: { id },
    })

    if (!existingMessage) {
      throw new Error('Scheduled message not found')
    }

    if (existingMessage.userId !== userId) {
      throw new Error('Permission denied')
    }

    // Don't allow updating sent or failed messages
    if (existingMessage.status === ScheduledMessageStatus.SENT) {
      throw new Error('Cannot update sent messages')
    }

    const updatedMessage = await prisma.scheduledMessage.update({
      where: { id },
      data: {
        ...validatedInput,
        content: validatedInput.content as any,
        recurrence: validatedInput.recurrence as any,
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return this.mapToScheduledMessageWithDetails(updatedMessage)
  }

  /**
   * Get scheduled message by ID
   */
  async getScheduledMessageById(id: string): Promise<ScheduledMessageWithDetails | null> {
    const scheduledMessage = await prisma.scheduledMessage.findUnique({
      where: { id },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return scheduledMessage ? this.mapToScheduledMessageWithDetails(scheduledMessage) : null
  }

  /**
   * Delete/cancel a scheduled message
   */
  async cancelScheduledMessage(id: string, userId: string): Promise<void> {
    const existingMessage = await prisma.scheduledMessage.findUnique({
      where: { id },
    })

    if (!existingMessage) {
      throw new Error('Scheduled message not found')
    }

    if (existingMessage.userId !== userId) {
      throw new Error('Permission denied')
    }

    if (existingMessage.status === ScheduledMessageStatus.SENT) {
      throw new Error('Cannot cancel sent messages')
    }

    await prisma.scheduledMessage.update({
      where: { id },
      data: {
        status: ScheduledMessageStatus.CANCELLED,
      },
    })
  }

  /**
   * Search scheduled messages
   */
  async searchScheduledMessages(
    query: ScheduledMessageSearchQuery,
    teamId: string
  ): Promise<{
    messages: ScheduledMessageWithDetails[]
    total: number
    hasMore: boolean
  }> {
    const where: any = {
      contact: { teamId },
    }

    if (query.status) {
      where.status = query.status
    }

    if (query.channel) {
      where.channel = query.channel
    }

    if (query.contactId) {
      where.contactId = query.contactId
    }

    if (query.userId) {
      where.userId = query.userId
    }

    if (query.scheduledAfter || query.scheduledBefore) {
      where.scheduledFor = {}
      if (query.scheduledAfter) {
        where.scheduledFor.gte = query.scheduledAfter
      }
      if (query.scheduledBefore) {
        where.scheduledFor.lte = query.scheduledBefore
      }
    }

    const limit = query.limit || 20
    const offset = query.offset || 0

    const [messages, total] = await Promise.all([
      prisma.scheduledMessage.findMany({
        where,
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { scheduledFor: 'asc' },
        take: limit,
        skip: offset,
      }),
      prisma.scheduledMessage.count({ where }),
    ])

    return {
      messages: messages.map(msg => this.mapToScheduledMessageWithDetails(msg)),
      total,
      hasMore: offset + limit < total,
    }
  }

  /**
   * Get messages ready for delivery
   */
  async getMessagesReadyForDelivery(limit = 100): Promise<ScheduledMessageWithDetails[]> {
    const now = new Date()

    const messages = await prisma.scheduledMessage.findMany({
      where: {
        status: ScheduledMessageStatus.PENDING,
        scheduledFor: {
          lte: now,
        },
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { scheduledFor: 'asc' },
      take: limit,
    })

    return messages.map(msg => this.mapToScheduledMessageWithDetails(msg))
  }

  /**
   * Mark message as sent
   */
  async markMessageAsSent(id: string): Promise<void> {
    await prisma.scheduledMessage.update({
      where: { id },
      data: {
        status: ScheduledMessageStatus.SENT,
      },
    })
  }

  /**
   * Mark message as failed
   */
  async markMessageAsFailed(id: string, error?: string): Promise<void> {
    await prisma.scheduledMessage.update({
      where: { id },
      data: {
        status: ScheduledMessageStatus.FAILED,
        // Store error in content metadata if needed
        content: {
          ...(await this.getMessageContent(id)),
          error,
        } as any,
      },
    })
  }

  /**
   * Generate next occurrence for recurring messages
   */
  async generateNextOccurrence(id: string): Promise<ScheduledMessageWithDetails | null> {
    const message = await prisma.scheduledMessage.findUnique({
      where: { id },
      include: {
        contact: true,
        user: true,
      },
    })

    if (!message || !message.recurrence) {
      return null
    }

    const recurrence = message.recurrence as RecurrencePattern
    const nextScheduledFor = this.calculateNextOccurrence(message.scheduledFor, recurrence)

    if (!nextScheduledFor) {
      return null
    }

    // Check if we've reached the end date or max occurrences
    if (recurrence.endDate && nextScheduledFor > recurrence.endDate) {
      return null
    }

    // Create next occurrence
    const nextMessage = await prisma.scheduledMessage.create({
      data: {
        channel: message.channel,
        content: message.content,
        scheduledFor: nextScheduledFor,
        recurrence: message.recurrence,
        contactId: message.contactId,
        userId: message.userId,
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return this.mapToScheduledMessageWithDetails(nextMessage)
  }

  /**
   * Get upcoming messages for a user
   */
  async getUpcomingMessages(
    userId: string,
    days = 7,
    limit = 50
  ): Promise<ScheduledMessageWithDetails[]> {
    const now = new Date()
    const futureDate = new Date()
    futureDate.setDate(now.getDate() + days)

    const messages = await prisma.scheduledMessage.findMany({
      where: {
        userId,
        status: ScheduledMessageStatus.PENDING,
        scheduledFor: {
          gte: now,
          lte: futureDate,
        },
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { scheduledFor: 'asc' },
      take: limit,
    })

    return messages.map(msg => this.mapToScheduledMessageWithDetails(msg))
  }

  /**
   * Private helper methods
   */
  private async getMessageContent(id: string): Promise<Record<string, unknown>> {
    const message = await prisma.scheduledMessage.findUnique({
      where: { id },
      select: { content: true },
    })

    return (message?.content as Record<string, unknown>) || {}
  }

  private mapToScheduledMessageWithDetails(dbMessage: any): ScheduledMessageWithDetails {
    return {
      id: dbMessage.id,
      channel: dbMessage.channel,
      content: dbMessage.content as Record<string, unknown>,
      scheduledFor: dbMessage.scheduledFor,
      recurrence: dbMessage.recurrence as RecurrencePattern | undefined,
      status: dbMessage.status,
      createdAt: dbMessage.createdAt,
      updatedAt: dbMessage.updatedAt,
      contactId: dbMessage.contactId,
      userId: dbMessage.userId,
      contact: dbMessage.contact,
      user: dbMessage.user,
    }
  }

  private calculateNextOccurrence(
    currentDate: Date,
    recurrence: RecurrencePattern
  ): Date | null {
    const nextDate = new Date(currentDate)

    switch (recurrence.type) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + recurrence.interval)
        break

      case 'weekly':
        nextDate.setDate(nextDate.getDate() + (7 * recurrence.interval))
        
        // If specific days of week are specified, find the next occurrence
        if (recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
          const currentDayOfWeek = nextDate.getDay()
          const sortedDays = [...recurrence.daysOfWeek].sort((a, b) => a - b)
          
          let nextDayOfWeek = sortedDays.find(day => day > currentDayOfWeek)
          if (!nextDayOfWeek) {
            nextDayOfWeek = sortedDays[0]
            nextDate.setDate(nextDate.getDate() + 7)
          }
          
          const daysToAdd = nextDayOfWeek - currentDayOfWeek
          nextDate.setDate(nextDate.getDate() + daysToAdd)
        }
        break

      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + recurrence.interval)
        
        // If specific day of month is specified
        if (recurrence.dayOfMonth) {
          nextDate.setDate(recurrence.dayOfMonth)
        }
        break

      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + recurrence.interval)
        break

      default:
        return null
    }

    return nextDate
  }
}

export const scheduledMessageService = new ScheduledMessageService()