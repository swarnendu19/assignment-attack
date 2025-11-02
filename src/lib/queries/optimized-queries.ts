/**
 * Optimized database queries with caching and performance improvements
 */

import { PrismaClient } from '@prisma/client'

// Query optimization utilities
export class OptimizedQueries {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get conversations with optimized pagination and includes
   */
  async getConversations({
    teamId,
    userId,
    limit = 20,
    cursor,
    status,
    contactId,
    includeMessageCount = true,
    includeLastMessage = true,
  }: {
    teamId: string
    userId?: string
    limit?: number
    cursor?: string
    status?: string
    contactId?: string
    includeMessageCount?: boolean
    includeLastMessage?: boolean
  }) {
    const where: any = {
      teamId,
      ...(userId && { userId }),
      ...(status && { status }),
      ...(contactId && { contactId }),
    }

    // Use cursor-based pagination for better performance
    const conversations = await this.prisma.conversation.findMany({
      where,
      take: limit + 1, // Take one extra to check if there's a next page
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1, // Skip the cursor
      }),
      orderBy: [
        { priority: 'desc' },
        { lastMessageAt: 'desc' },
      ],
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        channel: {
          select: {
            id: true,
            type: true,
            name: true,
          },
        },
        ...(includeLastMessage && {
          messages: {
            take: 1,
            orderBy: { sentAt: 'desc' },
            select: {
              id: true,
              content: true,
              sentAt: true,
              direction: true,
              contentType: true,
            },
          },
        }),
        ...(includeMessageCount && {
          _count: {
            select: {
              messages: true,
            },
          },
        }),
      },
    })

    const hasNextPage = conversations.length > limit
    const items = hasNextPage ? conversations.slice(0, -1) : conversations

    return {
      conversations: items,
      hasNextPage,
      nextCursor: hasNextPage ? items[items.length - 1].id : null,
    }
  }

  /**
   * Get messages for a conversation with optimized loading
   */
  async getConversationMessages({
    conversationId,
    limit = 50,
    cursor,
    direction = 'desc',
  }: {
    conversationId: string
    limit?: number
    cursor?: string
    direction?: 'asc' | 'desc'
  }) {
    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
      },
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: { sentAt: direction },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    })

    const hasNextPage = messages.length > limit
    const items = hasNextPage ? messages.slice(0, -1) : messages

    return {
      messages: direction === 'desc' ? items.reverse() : items,
      hasNextPage,
      nextCursor: hasNextPage ? items[items.length - 1].id : null,
    }
  }

  /**
   * Get unread message count efficiently
   */
  async getUnreadCounts(teamId: string, userId?: string) {
    const where: any = {
      teamId,
      ...(userId && { userId }),
    }

    // Use aggregation for better performance
    const result = await this.prisma.conversation.findMany({
      where,
      select: {
        id: true,
        _count: {
          select: {
            messages: {
              where: {
                isRead: false,
                direction: 'INBOUND',
              },
            },
          },
        },
      },
    })

    const totalUnread = result.reduce((sum, conv) => sum + conv._count.messages, 0)
    const conversationCounts = result.reduce((acc, conv) => {
      acc[conv.id] = conv._count.messages
      return acc
    }, {} as Record<string, number>)

    return {
      totalUnread,
      conversationCounts,
    }
  }

  /**
   * Search conversations and messages efficiently
   */
  async searchConversations({
    teamId,
    query,
    limit = 20,
    cursor,
    filters = {},
  }: {
    teamId: string
    query: string
    limit?: number
    cursor?: string
    filters?: {
      channel?: string
      status?: string
      dateFrom?: Date
      dateTo?: Date
    }
  }) {
    const searchTerms = query.toLowerCase().split(' ').filter(Boolean)
    
    // Search in conversations and contacts
    const conversations = await this.prisma.conversation.findMany({
      where: {
        teamId,
        AND: [
          {
            OR: [
              // Search in conversation title
              ...(searchTerms.map(term => ({
                title: {
                  contains: term,
                  mode: 'insensitive' as const,
                },
              }))),
              // Search in contact name, phone, email
              {
                contact: {
                  OR: [
                    ...(searchTerms.map(term => ({
                      name: {
                        contains: term,
                        mode: 'insensitive' as const,
                      },
                    }))),
                    ...(searchTerms.map(term => ({
                      phone: {
                        contains: term,
                      },
                    }))),
                    ...(searchTerms.map(term => ({
                      email: {
                        contains: term,
                        mode: 'insensitive' as const,
                      },
                    }))),
                  ],
                },
              },
              // Search in recent messages
              {
                messages: {
                  some: {
                    OR: searchTerms.map(term => ({
                      content: {
                        contains: term,
                        mode: 'insensitive' as const,
                      },
                    })),
                  },
                },
              },
            ],
          },
          // Apply filters
          ...(filters.channel && [{ channel: { type: filters.channel } }]),
          ...(filters.status && [{ status: filters.status }]),
          ...(filters.dateFrom && [{ lastMessageAt: { gte: filters.dateFrom } }]),
          ...(filters.dateTo && [{ lastMessageAt: { lte: filters.dateTo } }]),
        ],
      },
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: [
        { lastMessageAt: 'desc' },
      ],
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        channel: {
          select: {
            id: true,
            type: true,
            name: true,
          },
        },
        messages: {
          take: 1,
          orderBy: { sentAt: 'desc' },
          select: {
            id: true,
            content: true,
            sentAt: true,
            direction: true,
          },
        },
      },
    })

    const hasNextPage = conversations.length > limit
    const items = hasNextPage ? conversations.slice(0, -1) : conversations

    return {
      conversations: items,
      hasNextPage,
      nextCursor: hasNextPage ? items[items.length - 1].id : null,
    }
  }

  /**
   * Bulk mark messages as read efficiently
   */
  async markMessagesAsRead(messageIds: string[], conversationId?: string) {
    const where: any = {
      id: { in: messageIds },
      isRead: false,
      ...(conversationId && { conversationId }),
    }

    const result = await this.prisma.message.updateMany({
      where,
      data: {
        isRead: true,
      },
    })

    // Update conversation read status if all messages are read
    if (conversationId) {
      const unreadCount = await this.prisma.message.count({
        where: {
          conversationId,
          isRead: false,
          direction: 'INBOUND',
        },
      })

      if (unreadCount === 0) {
        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: { isRead: true },
        })
      }
    }

    return result
  }

  /**
   * Get analytics data efficiently
   */
  async getAnalyticsData({
    teamId,
    dateFrom,
    dateTo,
    groupBy = 'day',
  }: {
    teamId: string
    dateFrom: Date
    dateTo: Date
    groupBy?: 'hour' | 'day' | 'week' | 'month'
  }) {
    // Use raw SQL for better performance on analytics queries
    const dateFormat = {
      hour: 'YYYY-MM-DD HH24:00:00',
      day: 'YYYY-MM-DD',
      week: 'YYYY-"W"WW',
      month: 'YYYY-MM',
    }[groupBy]

    const messageStats = await this.prisma.$queryRaw`
      SELECT 
        TO_CHAR(sent_at, ${dateFormat}) as period,
        COUNT(*) as total_messages,
        COUNT(CASE WHEN direction = 'INBOUND' THEN 1 END) as inbound_messages,
        COUNT(CASE WHEN direction = 'OUTBOUND' THEN 1 END) as outbound_messages,
        COUNT(DISTINCT conversation_id) as active_conversations
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.team_id = ${teamId}
        AND m.sent_at >= ${dateFrom}
        AND m.sent_at <= ${dateTo}
      GROUP BY TO_CHAR(sent_at, ${dateFormat})
      ORDER BY period
    `

    const responseTimeStats = await this.prisma.$queryRaw`
      SELECT 
        AVG(
          EXTRACT(EPOCH FROM (
            SELECT MIN(sent_at) 
            FROM messages m2 
            WHERE m2.conversation_id = m1.conversation_id 
              AND m2.direction = 'OUTBOUND' 
              AND m2.sent_at > m1.sent_at
          ) - m1.sent_at)
        ) / 60 as avg_response_time_minutes
      FROM messages m1
      JOIN conversations c ON m1.conversation_id = c.id
      WHERE c.team_id = ${teamId}
        AND m1.direction = 'INBOUND'
        AND m1.sent_at >= ${dateFrom}
        AND m1.sent_at <= ${dateTo}
    `

    return {
      messageStats,
      responseTimeStats,
    }
  }
}