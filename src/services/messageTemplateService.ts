import { PrismaClient, ChannelType } from '@prisma/client'
import { 
  CreateMessageTemplateInput,
  UpdateMessageTemplateInput,
  CreateMessageTemplateSchema,
  UpdateMessageTemplateSchema,
  MessageTemplate
} from '@/types/database'

const prisma = new PrismaClient()

export interface MessageTemplateWithDetails extends MessageTemplate {
  user?: {
    id: string
    name?: string
    email: string
  }
  team?: {
    id: string
    name: string
  }
}

export interface TemplateSearchQuery {
  query?: string
  channel?: ChannelType
  category?: string
  isActive?: boolean
  userId?: string
  teamId?: string
  limit?: number
  offset?: number
}

export interface TemplateUsageAnalytics {
  templateId: string
  templateName: string
  usageCount: number
  lastUsed?: Date
  averageUsagePerMonth: number
}

export interface VariableSubstitution {
  [key: string]: string
}

export class MessageTemplateService {
  /**
   * Create a new message template
   */
  async createTemplate(
    input: CreateMessageTemplateInput,
    userId: string,
    teamId: string
  ): Promise<MessageTemplateWithDetails> {
    // Validate input
    const validatedInput = CreateMessageTemplateSchema.parse(input)

    // Extract variables from template content
    const variables = this.extractVariables(validatedInput.content)

    const template = await prisma.messageTemplate.create({
      data: {
        name: validatedInput.name,
        content: validatedInput.content,
        variables: variables,
        channel: validatedInput.channel,
        category: validatedInput.category,
        userId,
        teamId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return this.mapToTemplateWithDetails(template)
  }

  /**
   * Update an existing message template
   */
  async updateTemplate(
    id: string,
    input: UpdateMessageTemplateInput,
    userId: string
  ): Promise<MessageTemplateWithDetails> {
    // Validate input
    const validatedInput = UpdateMessageTemplateSchema.parse(input)

    // Check if template exists and user has permission
    const existingTemplate = await prisma.messageTemplate.findUnique({
      where: { id },
    })

    if (!existingTemplate) {
      throw new Error('Template not found')
    }

    if (existingTemplate.userId !== userId) {
      throw new Error('Permission denied')
    }

    // Extract variables if content is being updated
    let variables = existingTemplate.variables
    if (validatedInput.content) {
      variables = this.extractVariables(validatedInput.content)
    }

    const updatedTemplate = await prisma.messageTemplate.update({
      where: { id },
      data: {
        ...validatedInput,
        variables: variables,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return this.mapToTemplateWithDetails(updatedTemplate)
  }

  /**
   * Get template by ID
   */
  async getTemplateById(id: string): Promise<MessageTemplateWithDetails | null> {
    const template = await prisma.messageTemplate.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return template ? this.mapToTemplateWithDetails(template) : null
  }

  /**
   * Delete a template
   */
  async deleteTemplate(id: string, userId: string): Promise<void> {
    const existingTemplate = await prisma.messageTemplate.findUnique({
      where: { id },
    })

    if (!existingTemplate) {
      throw new Error('Template not found')
    }

    if (existingTemplate.userId !== userId) {
      throw new Error('Permission denied')
    }

    await prisma.messageTemplate.delete({
      where: { id },
    })
  }

  /**
   * Search templates with filtering
   */
  async searchTemplates(
    query: TemplateSearchQuery,
    teamId: string
  ): Promise<{
    templates: MessageTemplateWithDetails[]
    total: number
    hasMore: boolean
  }> {
    const where: any = { teamId }

    if (query.query) {
      where.OR = [
        { name: { contains: query.query, mode: 'insensitive' } },
        { content: { contains: query.query, mode: 'insensitive' } },
        { category: { contains: query.query, mode: 'insensitive' } },
      ]
    }

    if (query.channel) {
      where.channel = query.channel
    }

    if (query.category) {
      where.category = query.category
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive
    }

    if (query.userId) {
      where.userId = query.userId
    }

    const limit = query.limit || 20
    const offset = query.offset || 0

    const [templates, total] = await Promise.all([
      prisma.messageTemplate.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          team: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [
          { usageCount: 'desc' },
          { updatedAt: 'desc' },
        ],
        take: limit,
        skip: offset,
      }),
      prisma.messageTemplate.count({ where }),
    ])

    return {
      templates: templates.map(template => this.mapToTemplateWithDetails(template)),
      total,
      hasMore: offset + limit < total,
    }
  }

  /**
   * Get templates by category
   */
  async getTemplatesByCategory(
    teamId: string,
    channel?: ChannelType
  ): Promise<{ [category: string]: MessageTemplateWithDetails[] }> {
    const where: any = { teamId, isActive: true }
    if (channel) {
      where.channel = channel
    }

    const templates = await prisma.messageTemplate.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { category: 'asc' },
        { usageCount: 'desc' },
        { name: 'asc' },
      ],
    })

    const categorized: { [category: string]: MessageTemplateWithDetails[] } = {}

    templates.forEach(template => {
      const category = template.category || 'Uncategorized'
      if (!categorized[category]) {
        categorized[category] = []
      }
      categorized[category].push(this.mapToTemplateWithDetails(template))
    })

    return categorized
  }

  /**
   * Process template with variable substitution
   */
  processTemplate(
    templateContent: string,
    variables: VariableSubstitution,
    contactData?: {
      name?: string
      phone?: string
      email?: string
      customFields?: Record<string, unknown>
    }
  ): string {
    let processedContent = templateContent

    // Substitute custom variables
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
      processedContent = processedContent.replace(regex, value)
    })

    // Substitute contact data variables
    if (contactData) {
      if (contactData.name) {
        processedContent = processedContent.replace(/{{\\s*contact\\.name\\s*}}/g, contactData.name)
        processedContent = processedContent.replace(/{{\\s*name\\s*}}/g, contactData.name)
      }
      
      if (contactData.phone) {
        processedContent = processedContent.replace(/{{\\s*contact\\.phone\\s*}}/g, contactData.phone)
        processedContent = processedContent.replace(/{{\\s*phone\\s*}}/g, contactData.phone)
      }
      
      if (contactData.email) {
        processedContent = processedContent.replace(/{{\\s*contact\\.email\\s*}}/g, contactData.email)
        processedContent = processedContent.replace(/{{\\s*email\\s*}}/g, contactData.email)
      }

      // Process custom fields
      if (contactData.customFields) {
        Object.entries(contactData.customFields).forEach(([key, value]) => {
          const regex = new RegExp(`{{\\s*contact\\.${key}\\s*}}`, 'g')
          processedContent = processedContent.replace(regex, String(value))
        })
      }
    }

    // Add current date/time variables
    const now = new Date()
    processedContent = processedContent.replace(/{{\\s*date\\s*}}/g, now.toLocaleDateString())
    processedContent = processedContent.replace(/{{\\s*time\\s*}}/g, now.toLocaleTimeString())
    processedContent = processedContent.replace(/{{\\s*datetime\\s*}}/g, now.toLocaleString())

    return processedContent
  }

  /**
   * Increment template usage count
   */
  async incrementUsageCount(templateId: string): Promise<void> {
    await prisma.messageTemplate.update({
      where: { id: templateId },
      data: {
        usageCount: { increment: 1 },
        updatedAt: new Date(),
      },
    })
  }

  /**
   * Get template usage analytics
   */
  async getTemplateAnalytics(
    teamId: string,
    days = 30
  ): Promise<TemplateUsageAnalytics[]> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    // Get templates with usage data
    const templates = await prisma.messageTemplate.findMany({
      where: { teamId },
      select: {
        id: true,
        name: true,
        usageCount: true,
        updatedAt: true,
        scheduledMessages: {
          where: {
            createdAt: { gte: cutoffDate },
          },
          select: {
            createdAt: true,
          },
        },
      },
    })

    return templates.map(template => {
      const recentUsage = template.scheduledMessages.length
      const averageUsagePerMonth = (recentUsage / days) * 30

      return {
        templateId: template.id,
        templateName: template.name,
        usageCount: template.usageCount,
        lastUsed: template.scheduledMessages.length > 0 
          ? new Date(Math.max(...template.scheduledMessages.map(sm => sm.createdAt.getTime())))
          : undefined,
        averageUsagePerMonth,
      }
    }).sort((a, b) => b.usageCount - a.usageCount)
  }

  /**
   * Get popular templates
   */
  async getPopularTemplates(
    teamId: string,
    channel?: ChannelType,
    limit = 10
  ): Promise<MessageTemplateWithDetails[]> {
    const where: any = { teamId, isActive: true }
    if (channel) {
      where.channel = channel
    }

    const templates = await prisma.messageTemplate.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { usageCount: 'desc' },
      take: limit,
    })

    return templates.map(template => this.mapToTemplateWithDetails(template))
  }

  /**
   * Duplicate a template
   */
  async duplicateTemplate(
    templateId: string,
    userId: string,
    newName?: string
  ): Promise<MessageTemplateWithDetails> {
    const originalTemplate = await prisma.messageTemplate.findUnique({
      where: { id: templateId },
    })

    if (!originalTemplate) {
      throw new Error('Template not found')
    }

    const duplicatedTemplate = await prisma.messageTemplate.create({
      data: {
        name: newName || `${originalTemplate.name} (Copy)`,
        content: originalTemplate.content,
        variables: originalTemplate.variables,
        channel: originalTemplate.channel,
        category: originalTemplate.category,
        userId,
        teamId: originalTemplate.teamId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return this.mapToTemplateWithDetails(duplicatedTemplate)
  }

  /**
   * Private helper methods
   */
  private extractVariables(content: string): string[] {
    const variableRegex = /{{\\s*([^}]+)\\s*}}/g
    const variables = new Set<string>()
    let match

    while ((match = variableRegex.exec(content)) !== null) {
      const variable = match[1].trim()
      // Skip built-in variables
      if (!['date', 'time', 'datetime', 'contact.name', 'contact.phone', 'contact.email', 'name', 'phone', 'email'].includes(variable)) {
        variables.add(variable)
      }
    }

    return Array.from(variables)
  }

  private mapToTemplateWithDetails(dbTemplate: any): MessageTemplateWithDetails {
    return {
      id: dbTemplate.id,
      name: dbTemplate.name,
      content: dbTemplate.content,
      variables: dbTemplate.variables as string[] || [],
      channel: dbTemplate.channel,
      category: dbTemplate.category,
      isActive: dbTemplate.isActive,
      usageCount: dbTemplate.usageCount,
      createdAt: dbTemplate.createdAt,
      updatedAt: dbTemplate.updatedAt,
      userId: dbTemplate.userId,
      teamId: dbTemplate.teamId,
      user: dbTemplate.user,
      team: dbTemplate.team,
    }
  }
}

export const messageTemplateService = new MessageTemplateService()