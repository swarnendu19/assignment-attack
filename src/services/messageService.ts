import { PrismaClient, ChannelType, Direction, ContentType } from '@prisma/client'
import { 
  UnifiedMessage, 
  RawChannelMessage, 
  TwilioMessage, 
  EmailMessage, 
  SocialMessage,
  MessageSearchQuery,
  MessageSearchResult,
  ConversationThread,
  ThreadingOptions,
  MessageContent,
  ChannelMetadata,
  MessageStatus,
  UnifiedMessageSchema,
  MessageSearchQuerySchema
} from '@/types/messages'

const prisma = new PrismaClient()

export class MessageService {
  /**
   * Normalize a raw channel message to unified format
   */
  async normalizeMessage(rawMessage: RawChannelMessage): Promise<UnifiedMessage> {
    let normalizedContent: MessageContent
    let metadata: ChannelMetadata = {}
    let contactPhone: string | undefined
    let contactEmail: string | undefined

    switch (rawMessage.channel) {
      case ChannelType.SMS:
      case ChannelType.WHATSAPP:
        const twilioMsg = rawMessage as TwilioMessage
        normalizedContent = {
          text: twilioMsg.rawData.Body,
          attachments: twilioMsg.rawData.MediaUrl0 ? [{
            id: `${twilioMsg.rawData.MessageSid}_media_0`,
            filename: 'media',
            contentType: twilioMsg.rawData.MediaContentType0 || 'application/octet-stream',
            size: 0, // Will be updated when downloaded
            url: twilioMsg.rawData.MediaUrl0,
          }] : undefined,
        }
        metadata = {
          twilioSid: twilioMsg.rawData.MessageSid,
          whatsappStatus: twilioMsg.rawData.MessageStatus,
        }
        contactPhone = rawMessage.direction === Direction.INBOUND 
          ? twilioMsg.rawData.From 
          : twilioMsg.rawData.To
        break

      case ChannelType.EMAIL:
        const emailMsg = rawMessage as EmailMessage
        normalizedContent = {
          text: emailMsg.rawData.text,
          html: emailMsg.rawData.html,
          attachments: emailMsg.rawData.attachments?.map((att, index) => ({
            id: `${emailMsg.rawData.messageId}_att_${index}`,
            filename: att.filename,
            contentType: att.contentType,
            size: att.content.length,
            url: `data:${att.contentType};base64,${att.content.toString('base64')}`,
          })),
          metadata: {
            subject: emailMsg.rawData.subject,
          },
        }
        metadata = {
          emailMessageId: emailMsg.rawData.messageId,
        }
        contactEmail = rawMessage.direction === Direction.INBOUND 
          ? emailMsg.rawData.from 
          : emailMsg.rawData.to
        break

      case ChannelType.TWITTER:
      case ChannelType.FACEBOOK:
        const socialMsg = rawMessage as SocialMessage
        normalizedContent = {
          text: socialMsg.rawData.text,
          attachments: socialMsg.rawData.mediaUrls?.map((url, index) => ({
            id: `${socialMsg.rawData.id}_media_${index}`,
            filename: `media_${index}`,
            contentType: 'image/jpeg', // Default, should be detected
            size: 0,
            url,
          })),
          metadata: {
            threadId: socialMsg.rawData.id,
          },
        }
        metadata = {
          socialPostId: socialMsg.rawData.id,
          platform: rawMessage.channel === ChannelType.TWITTER ? 'twitter' : 'facebook',
          senderId: socialMsg.rawData.senderId,
          recipientId: socialMsg.rawData.recipientId,
        }
        // For social media, we'll use the sender/recipient ID as contact identifier
        contactPhone = rawMessage.direction === Direction.INBOUND 
          ? socialMsg.rawData.senderId 
          : socialMsg.rawData.recipientId
        break

      default:
        throw new Error(`Unsupported channel type: ${rawMessage.channel}`)
    }

    // Find or create contact
    const contact = await this.findOrCreateContact(contactPhone, contactEmail)
    
    // Find or create conversation
    const conversation = await this.findOrCreateConversation(
      rawMessage.channel,
      contact?.id,
      rawMessage.externalId
    )

    const unifiedMessage: UnifiedMessage = {
      id: '', // Will be set after database insert
      contactId: contact?.id || null,
      conversationId: conversation.id,
      channel: rawMessage.channel,
      direction: rawMessage.direction,
      content: normalizedContent,
      status: this.mapToMessageStatus(rawMessage),
      timestamp: rawMessage.timestamp,
      metadata,
      externalId: rawMessage.externalId,
      isRead: rawMessage.direction === Direction.OUTBOUND,
      userId: conversation.userId, // Use conversation owner
    }

    // Validate the normalized message
    const validatedMessage = UnifiedMessageSchema.parse(unifiedMessage)
    
    return validatedMessage
  }

  /**
   * Store a unified message in the database
   */
  async storeMessage(message: UnifiedMessage): Promise<UnifiedMessage> {
    const storedMessage = await prisma.message.create({
      data: {
        externalId: message.externalId,
        content: message.content.text || '',
        contentType: this.determineContentType(message.content),
        direction: message.direction,
        isRead: message.isRead,
        metadata: message.metadata as any,
        sentAt: message.timestamp,
        conversationId: message.conversationId,
        userId: message.userId,
      },
    })

    // Update conversation last message timestamp
    await prisma.conversation.update({
      where: { id: message.conversationId },
      data: {
        lastMessageAt: message.timestamp,
        isRead: message.direction === Direction.OUTBOUND,
      },
    })

    return {
      ...message,
      id: storedMessage.id,
    }
  }

  /**
   * Get conversation thread with messages
   */
  async getConversationThread(conversationId: string): Promise<ConversationThread | null> {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { sentAt: 'asc' },
        },
        contact: true,
        channel: true,
      },
    })

    if (!conversation) return null

    const messages = conversation.messages.map(msg => this.mapToUnifiedMessage(msg))
    const unreadCount = messages.filter(msg => !msg.isRead && msg.direction === Direction.INBOUND).length

    return {
      id: conversation.id,
      contactId: conversation.contactId,
      channel: conversation.channel.type,
      title: conversation.title || conversation.contact?.name || 'Unknown Contact',
      lastMessageAt: conversation.lastMessageAt || conversation.createdAt,
      messageCount: messages.length,
      unreadCount,
      messages,
      participants: [conversation.userId], // Add more participants logic if needed
    }
  }

  /**
   * Search messages with filtering
   */
  async searchMessages(query: MessageSearchQuery): Promise<MessageSearchResult> {
    // Validate search query
    const validatedQuery = MessageSearchQuerySchema.parse(query)

    const where: any = {}

    if (validatedQuery.query) {
      where.content = {
        contains: validatedQuery.query,
        mode: 'insensitive',
      }
    }

    if (validatedQuery.contactId) {
      where.conversation = {
        contactId: validatedQuery.contactId,
      }
    }

    if (validatedQuery.direction) {
      where.direction = validatedQuery.direction
    }

    if (validatedQuery.dateFrom || validatedQuery.dateTo) {
      where.sentAt = {}
      if (validatedQuery.dateFrom) {
        where.sentAt.gte = validatedQuery.dateFrom
      }
      if (validatedQuery.dateTo) {
        where.sentAt.lte = validatedQuery.dateTo
      }
    }

    if (validatedQuery.isRead !== undefined) {
      where.isRead = validatedQuery.isRead
    }

    if (validatedQuery.hasAttachments) {
      where.metadata = {
        path: ['attachments'],
        not: null,
      }
    }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        include: {
          conversation: {
            include: {
              contact: true,
              channel: true,
            },
          },
        },
        orderBy: { sentAt: 'desc' },
        take: validatedQuery.limit,
        skip: validatedQuery.offset,
      }),
      prisma.message.count({ where }),
    ])

    const unifiedMessages = messages.map(msg => this.mapToUnifiedMessage(msg))

    return {
      messages: unifiedMessages,
      total,
      hasMore: validatedQuery.offset + validatedQuery.limit < total,
    }
  }

  /**
   * Group messages into conversation threads
   */
  async groupMessagesByConversation(
    messages: UnifiedMessage[],
    options: ThreadingOptions = {
      groupByContact: true,
      groupBySubject: false,
      timeWindowMinutes: 30,
    }
  ): Promise<ConversationThread[]> {
    const threads = new Map<string, ConversationThread>()

    for (const message of messages) {
      let threadKey = message.conversationId

      // Group by contact if enabled
      if (options.groupByContact && message.contactId) {
        threadKey = `${message.contactId}_${message.channel}`
      }

      // Group by subject for emails if enabled
      if (options.groupBySubject && message.channel === ChannelType.EMAIL) {
        const subject = message.content.metadata?.subject
        if (subject) {
          threadKey = `${threadKey}_${subject.replace(/^(Re:|Fwd:)\s*/i, '')}`
        }
      }

      if (!threads.has(threadKey)) {
        threads.set(threadKey, {
          id: threadKey,
          contactId: message.contactId,
          channel: message.channel,
          title: this.generateThreadTitle(message),
          lastMessageAt: message.timestamp,
          messageCount: 0,
          unreadCount: 0,
          messages: [],
          participants: [message.userId],
        })
      }

      const thread = threads.get(threadKey)!
      thread.messages.push(message)
      thread.messageCount++
      
      if (!message.isRead && message.direction === Direction.INBOUND) {
        thread.unreadCount++
      }

      if (message.timestamp > thread.lastMessageAt) {
        thread.lastMessageAt = message.timestamp
      }

      if (!thread.participants.includes(message.userId)) {
        thread.participants.push(message.userId)
      }
    }

    // Sort messages within each thread
    threads.forEach(thread => {
      thread.messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    })

    return Array.from(threads.values()).sort(
      (a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime()
    )
  }

  /**
   * Update message status by external ID
   */
  async updateMessageStatus(
    externalId: string, 
    status: MessageStatus, 
    errorInfo?: { errorCode?: string; errorMessage?: string }
  ): Promise<void> {
    try {
      const updateData: any = {
        // Map MessageStatus to database status if needed
        // For now, we'll store it in metadata
        metadata: {
          status,
          ...(errorInfo && {
            error: {
              code: errorInfo.errorCode,
              message: errorInfo.errorMessage,
            }
          }),
        },
      }

      await prisma.message.updateMany({
        where: { externalId },
        data: updateData,
      })

      console.log(`Updated message ${externalId} status to ${status}`)
    } catch (error) {
      console.error(`Failed to update message ${externalId} status:`, error)
      throw error
    }
  }

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(messageIds: string[], userId: string): Promise<void> {
    await prisma.message.updateMany({
      where: {
        id: { in: messageIds },
        userId,
      },
      data: {
        isRead: true,
      },
    })

    // Update conversation read status
    const conversations = await prisma.message.findMany({
      where: { id: { in: messageIds } },
      select: { conversationId: true },
      distinct: ['conversationId'],
    })

    for (const { conversationId } of conversations) {
      const unreadCount = await prisma.message.count({
        where: {
          conversationId,
          isRead: false,
          direction: Direction.INBOUND,
        },
      })

      if (unreadCount === 0) {
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { isRead: true },
        })
      }
    }
  }

  /**
   * Private helper methods
   */
  private async findOrCreateContact(phone?: string, email?: string) {
    if (!phone && !email) return null

    const where: any = {}
    if (phone) where.phone = phone
    if (email) where.email = email

    let contact = await prisma.contact.findFirst({ where })

    if (!contact && (phone || email)) {
      // Create new contact
      contact = await prisma.contact.create({
        data: {
          phone,
          email,
          teamId: 'default-team-id', // Should be passed from context
        },
      })
    }

    return contact
  }

  private async findOrCreateConversation(
    channel: ChannelType,
    contactId: string | null,
    externalId: string
  ) {
    // Find existing conversation
    let conversation = await prisma.conversation.findFirst({
      where: {
        contactId,
        channel: {
          type: channel,
        },
        externalId,
      },
    })

    if (!conversation) {
      // Find or create channel
      let channelRecord = await prisma.channel.findFirst({
        where: { type: channel },
      })

      if (!channelRecord) {
        channelRecord = await prisma.channel.create({
          data: {
            name: channel,
            type: channel,
            userId: 'default-user-id', // Should be passed from context
          },
        })
      }

      // Create new conversation
      conversation = await prisma.conversation.create({
        data: {
          externalId,
          contactId,
          channelId: channelRecord.id,
          userId: channelRecord.userId,
          teamId: 'default-team-id', // Should be passed from context
        },
      })
    }

    return conversation
  }

  private mapToMessageStatus(rawMessage: RawChannelMessage): MessageStatus {
    // Default mapping - should be enhanced per channel
    if (rawMessage.direction === Direction.OUTBOUND) {
      return 'sent'
    }
    return 'delivered'
  }

  private determineContentType(content: MessageContent): ContentType {
    if (content.html) return ContentType.HTML
    if (content.attachments?.length) return ContentType.FILE
    return ContentType.TEXT
  }

  private mapToUnifiedMessage(dbMessage: any): UnifiedMessage {
    return {
      id: dbMessage.id,
      contactId: dbMessage.conversation?.contactId || null,
      conversationId: dbMessage.conversationId,
      channel: dbMessage.conversation?.channel?.type || ChannelType.SMS,
      direction: dbMessage.direction,
      content: {
        text: dbMessage.content,
        // Parse metadata for attachments and other content
        ...(dbMessage.metadata as any),
      },
      status: 'delivered', // Default status
      timestamp: dbMessage.sentAt,
      metadata: dbMessage.metadata as ChannelMetadata,
      externalId: dbMessage.externalId || undefined,
      isRead: dbMessage.isRead,
      userId: dbMessage.userId,
    }
  }

  private generateThreadTitle(message: UnifiedMessage): string {
    if (message.content.metadata?.subject) {
      return message.content.metadata.subject
    }
    
    const preview = message.content.text?.substring(0, 50) || 'New conversation'
    return preview + (message.content.text && message.content.text.length > 50 ? '...' : '')
  }
}

export const messageService = new MessageService()