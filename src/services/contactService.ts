import { PrismaClient, ContactEventType } from '@prisma/client'
import { 
  Contact,
  ContactEvent,
  ContactHistory,
  CreateContactInput,
  UpdateContactInput,
  ContactSearchQuery,
  ContactSearchResult,
  DuplicateMatch,
  DuplicateMatchReason,
  ContactMergeRequest,
  ContactMergeResult,
  ContactTimeline,
  TimelineItem,
  CreateContactSchema,
  UpdateContactSchema,
  ContactSearchQuerySchema,
  ContactMergeRequestSchema
} from '@/types/contacts'

const prisma = new PrismaClient()

export class ContactService {
  /**
   * Create a new contact
   */
  async createContact(input: CreateContactInput, userId: string): Promise<Contact> {
    // Validate input
    const validatedInput = CreateContactSchema.parse(input)

    // Check for existing duplicates
    const duplicates = await this.findDuplicates({
      ...validatedInput,
      id: 'temp',
      createdAt: new Date(),
      updatedAt: new Date(),
      socialHandles: validatedInput.socialHandles || [],
      tags: validatedInput.tags || [],
      customFields: validatedInput.customFields || {},
    })

    if (duplicates.length > 0) {
      throw new Error(`Potential duplicate contacts found: ${duplicates.map(d => d.contact.id).join(', ')}`)
    }

    const contact = await prisma.contact.create({
      data: {
        name: validatedInput.name,
        phone: validatedInput.phone,
        email: validatedInput.email,
        socialHandles: validatedInput.socialHandles as any,
        tags: validatedInput.tags || [],
        customFields: validatedInput.customFields as any,
        teamId: validatedInput.teamId,
      },
    })

    // Create contact event
    await this.createContactEvent(contact.id, ContactEventType.CREATED, {}, userId)

    return this.mapToContact(contact)
  }

  /**
   * Update an existing contact
   */
  async updateContact(id: string, input: UpdateContactInput, userId: string): Promise<Contact> {
    // Validate input
    const validatedInput = UpdateContactSchema.parse(input)

    const existingContact = await prisma.contact.findUnique({
      where: { id },
    })

    if (!existingContact) {
      throw new Error('Contact not found')
    }

    const updatedContact = await prisma.contact.update({
      where: { id },
      data: {
        ...validatedInput,
        socialHandles: validatedInput.socialHandles as any,
        customFields: validatedInput.customFields as any,
        updatedAt: new Date(),
      },
    })

    // Create update event
    await this.createContactEvent(id, ContactEventType.UPDATED, {
      changes: this.getChanges(existingContact, validatedInput),
    }, userId)

    return this.mapToContact(updatedContact)
  }

  /**
   * Get contact by ID
   */
  async getContactById(id: string): Promise<Contact | null> {
    const contact = await prisma.contact.findUnique({
      where: { id },
    })

    return contact ? this.mapToContact(contact) : null
  }

  /**
   * Delete a contact
   */
  async deleteContact(id: string, userId: string): Promise<void> {
    await this.createContactEvent(id, ContactEventType.DELETED, {}, userId)
    
    await prisma.contact.delete({
      where: { id },
    })
  }

  /**
   * Search contacts with filtering
   */
  async searchContacts(query: ContactSearchQuery, teamId: string): Promise<ContactSearchResult> {
    // Validate search query
    const validatedQuery = ContactSearchQuerySchema.parse(query)

    const where: any = { teamId }

    // Text search across name, email, phone
    if (validatedQuery.query) {
      where.OR = [
        { name: { contains: validatedQuery.query, mode: 'insensitive' } },
        { email: { contains: validatedQuery.query, mode: 'insensitive' } },
        { phone: { contains: validatedQuery.query, mode: 'insensitive' } },
      ]
    }

    // Filter by tags
    if (validatedQuery.tags && validatedQuery.tags.length > 0) {
      where.tags = {
        hasEvery: validatedQuery.tags,
      }
    }

    // Filter by contact info presence
    if (validatedQuery.hasPhone !== undefined) {
      where.phone = validatedQuery.hasPhone ? { not: null } : null
    }

    if (validatedQuery.hasEmail !== undefined) {
      where.email = validatedQuery.hasEmail ? { not: null } : null
    }

    // Date filters
    if (validatedQuery.createdAfter || validatedQuery.createdBefore) {
      where.createdAt = {}
      if (validatedQuery.createdAfter) {
        where.createdAt.gte = validatedQuery.createdAfter
      }
      if (validatedQuery.createdBefore) {
        where.createdAt.lte = validatedQuery.createdBefore
      }
    }

    if (validatedQuery.lastContactAfter || validatedQuery.lastContactBefore) {
      where.lastContactAt = {}
      if (validatedQuery.lastContactAfter) {
        where.lastContactAt.gte = validatedQuery.lastContactAfter
      }
      if (validatedQuery.lastContactBefore) {
        where.lastContactAt.lte = validatedQuery.lastContactBefore
      }
    }

    // Sorting
    const orderBy: any = {}
    if (validatedQuery.sortBy === 'messageCount') {
      // This would require a more complex query with message count
      orderBy.lastContactAt = validatedQuery.sortOrder
    } else {
      orderBy[validatedQuery.sortBy] = validatedQuery.sortOrder
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy,
        take: validatedQuery.limit,
        skip: validatedQuery.offset,
      }),
      prisma.contact.count({ where }),
    ])

    return {
      contacts: contacts.map(contact => this.mapToContact(contact)),
      total,
      hasMore: validatedQuery.offset + validatedQuery.limit < total,
    }
  }

  /**
   * Find potential duplicate contacts
   */
  async findDuplicates(contact: Contact): Promise<DuplicateMatch[]> {
    const duplicates: DuplicateMatch[] = []

    // Find exact email matches
    if (contact.email) {
      const emailMatches = await prisma.contact.findMany({
        where: {
          email: contact.email,
          id: { not: contact.id },
          teamId: contact.teamId,
        },
      })

      for (const match of emailMatches) {
        duplicates.push({
          contact: this.mapToContact(match),
          matchScore: 1.0,
          matchReasons: [{
            field: 'email',
            similarity: 1.0,
            value1: contact.email,
            value2: match.email!,
          }],
        })
      }
    }

    // Find exact phone matches
    if (contact.phone) {
      const phoneMatches = await prisma.contact.findMany({
        where: {
          phone: contact.phone,
          id: { not: contact.id },
          teamId: contact.teamId,
        },
      })

      for (const match of phoneMatches) {
        const existingDuplicate = duplicates.find(d => d.contact.id === match.id)
        if (existingDuplicate) {
          existingDuplicate.matchReasons.push({
            field: 'phone',
            similarity: 1.0,
            value1: contact.phone,
            value2: match.phone!,
          })
        } else {
          duplicates.push({
            contact: this.mapToContact(match),
            matchScore: 1.0,
            matchReasons: [{
              field: 'phone',
              similarity: 1.0,
              value1: contact.phone,
              value2: match.phone!,
            }],
          })
        }
      }
    }

    // Find fuzzy name matches
    if (contact.name) {
      const nameMatches = await prisma.contact.findMany({
        where: {
          name: { not: null },
          id: { not: contact.id },
          teamId: contact.teamId,
        },
      })

      for (const match of nameMatches) {
        if (!match.name) continue

        const similarity = this.calculateStringSimilarity(contact.name, match.name)
        if (similarity > 0.8) {
          const existingDuplicate = duplicates.find(d => d.contact.id === match.id)
          if (existingDuplicate) {
            existingDuplicate.matchReasons.push({
              field: 'name',
              similarity,
              value1: contact.name,
              value2: match.name,
            })
            existingDuplicate.matchScore = Math.max(existingDuplicate.matchScore, similarity)
          } else {
            duplicates.push({
              contact: this.mapToContact(match),
              matchScore: similarity,
              matchReasons: [{
                field: 'name',
                similarity,
                value1: contact.name,
                value2: match.name,
              }],
            })
          }
        }
      }
    }

    // Sort by match score (highest first)
    return duplicates.sort((a, b) => b.matchScore - a.matchScore)
  }

  /**
   * Merge duplicate contacts
   */
  async mergeContacts(request: ContactMergeRequest, userId: string): Promise<ContactMergeResult> {
    // Validate merge request
    const validatedRequest = ContactMergeRequestSchema.parse(request)

    const primaryContact = await prisma.contact.findUnique({
      where: { id: validatedRequest.primaryContactId },
    })

    if (!primaryContact) {
      throw new Error('Primary contact not found')
    }

    const duplicateContacts = await prisma.contact.findMany({
      where: { id: { in: validatedRequest.duplicateContactIds } },
    })

    if (duplicateContacts.length !== validatedRequest.duplicateContactIds.length) {
      throw new Error('Some duplicate contacts not found')
    }

    // Merge contact data based on field resolutions
    const mergedData: any = { ...primaryContact }
    let conflictsResolved = 0

    for (const duplicate of duplicateContacts) {
      for (const [field, resolution] of Object.entries(validatedRequest.fieldResolutions)) {
        if (resolution === 'duplicate' && duplicate[field as keyof typeof duplicate]) {
          mergedData[field] = duplicate[field as keyof typeof duplicate]
          conflictsResolved++
        } else if (resolution === 'merge') {
          // Handle merge logic for specific fields
          if (field === 'tags') {
            const primaryTags = primaryContact.tags || []
            const duplicateTags = duplicate.tags || []
            mergedData.tags = [...new Set([...primaryTags, ...duplicateTags])]
            conflictsResolved++
          } else if (field === 'customFields') {
            mergedData.customFields = {
              ...(primaryContact.customFields as any),
              ...(duplicate.customFields as any),
            }
            conflictsResolved++
          }
        }
      }
    }

    // Update primary contact with merged data
    const updatedContact = await prisma.contact.update({
      where: { id: validatedRequest.primaryContactId },
      data: mergedData,
    })

    // Transfer relationships from duplicate contacts to primary
    await Promise.all([
      // Transfer conversations
      prisma.conversation.updateMany({
        where: { contactId: { in: validatedRequest.duplicateContactIds } },
        data: { contactId: validatedRequest.primaryContactId },
      }),
      // Transfer notes
      prisma.note.updateMany({
        where: { contactId: { in: validatedRequest.duplicateContactIds } },
        data: { contactId: validatedRequest.primaryContactId },
      }),
      // Transfer scheduled messages
      prisma.scheduledMessage.updateMany({
        where: { contactId: { in: validatedRequest.duplicateContactIds } },
        data: { contactId: validatedRequest.primaryContactId },
      }),
      // Transfer contact events
      prisma.contactEvent.updateMany({
        where: { contactId: { in: validatedRequest.duplicateContactIds } },
        data: { contactId: validatedRequest.primaryContactId },
      }),
    ])

    // Create merge event
    await this.createContactEvent(
      validatedRequest.primaryContactId,
      ContactEventType.MERGED,
      {
        mergedContactIds: validatedRequest.duplicateContactIds,
        conflictsResolved,
      },
      userId
    )

    // Delete duplicate contacts
    await prisma.contact.deleteMany({
      where: { id: { in: validatedRequest.duplicateContactIds } },
    })

    return {
      mergedContact: this.mapToContact(updatedContact),
      mergedContactIds: validatedRequest.duplicateContactIds,
      conflictsResolved,
    }
  }

  /**
   * Get contact history and timeline
   */
  async getContactHistory(contactId: string): Promise<ContactHistory> {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    })

    if (!contact) {
      throw new Error('Contact not found')
    }

    const [events, messageCount, lastMessage] = await Promise.all([
      prisma.contactEvent.findMany({
        where: { contactId },
        include: { user: true },
        orderBy: { timestamp: 'desc' },
      }),
      prisma.message.count({
        where: {
          conversation: { contactId },
        },
      }),
      prisma.message.findFirst({
        where: {
          conversation: { contactId },
        },
        orderBy: { sentAt: 'desc' },
      }),
    ])

    return {
      contact: this.mapToContact(contact),
      events: events.map(event => ({
        id: event.id,
        contactId: event.contactId,
        eventType: event.eventType,
        eventData: event.eventData as Record<string, unknown>,
        timestamp: event.timestamp,
        userId: event.userId || undefined,
      })),
      messageCount,
      lastMessageAt: lastMessage?.sentAt,
      totalInteractions: events.length + messageCount,
    }
  }

  /**
   * Get contact timeline with all activities
   */
  async getContactTimeline(contactId: string, limit = 50): Promise<ContactTimeline> {
    const [events, messages, notes] = await Promise.all([
      prisma.contactEvent.findMany({
        where: { contactId },
        include: { user: true },
        orderBy: { timestamp: 'desc' },
        take: limit,
      }),
      prisma.message.findMany({
        where: {
          conversation: { contactId },
        },
        include: {
          user: true,
          conversation: { include: { channel: true } },
        },
        orderBy: { sentAt: 'desc' },
        take: limit,
      }),
      prisma.note.findMany({
        where: { contactId },
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ])

    const timelineItems: TimelineItem[] = []

    // Add events
    events.forEach(event => {
      timelineItems.push({
        id: `event_${event.id}`,
        type: 'event',
        timestamp: event.timestamp,
        title: this.getEventTitle(event.eventType),
        description: this.getEventDescription(event.eventType, event.eventData as any),
        metadata: event.eventData as Record<string, unknown>,
        userId: event.userId || undefined,
        userName: event.user?.name || undefined,
      })
    })

    // Add messages
    messages.forEach(message => {
      timelineItems.push({
        id: `message_${message.id}`,
        type: 'message',
        timestamp: message.sentAt,
        title: `${message.direction === 'INBOUND' ? 'Received' : 'Sent'} message via ${message.conversation.channel.name}`,
        description: message.content.substring(0, 100) + (message.content.length > 100 ? '...' : ''),
        metadata: message.metadata as Record<string, unknown>,
        userId: message.userId,
        userName: message.user?.name || undefined,
      })
    })

    // Add notes
    notes.forEach(note => {
      timelineItems.push({
        id: `note_${note.id}`,
        type: 'note',
        timestamp: note.createdAt,
        title: 'Added note',
        description: note.content.substring(0, 100) + (note.content.length > 100 ? '...' : ''),
        userId: note.userId,
        userName: note.user?.name || undefined,
      })
    })

    // Sort by timestamp (most recent first)
    timelineItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    return {
      contactId,
      items: timelineItems.slice(0, limit),
      totalItems: timelineItems.length,
    }
  }

  /**
   * Add tags to a contact
   */
  async addTags(contactId: string, tags: string[], userId: string): Promise<Contact> {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    })

    if (!contact) {
      throw new Error('Contact not found')
    }

    const existingTags = contact.tags || []
    const newTags = [...new Set([...existingTags, ...tags])]

    const updatedContact = await prisma.contact.update({
      where: { id: contactId },
      data: { tags: newTags },
    })

    // Create tag events
    for (const tag of tags) {
      if (!existingTags.includes(tag)) {
        await this.createContactEvent(contactId, ContactEventType.TAG_ADDED, { tag }, userId)
      }
    }

    return this.mapToContact(updatedContact)
  }

  /**
   * Remove tags from a contact
   */
  async removeTags(contactId: string, tags: string[], userId: string): Promise<Contact> {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    })

    if (!contact) {
      throw new Error('Contact not found')
    }

    const existingTags = contact.tags || []
    const newTags = existingTags.filter(tag => !tags.includes(tag))

    const updatedContact = await prisma.contact.update({
      where: { id: contactId },
      data: { tags: newTags },
    })

    // Create tag removal events
    for (const tag of tags) {
      if (existingTags.includes(tag)) {
        await this.createContactEvent(contactId, ContactEventType.TAG_REMOVED, { tag }, userId)
      }
    }

    return this.mapToContact(updatedContact)
  }

  /**
   * Private helper methods
   */
  private async createContactEvent(
    contactId: string,
    eventType: ContactEventType,
    eventData: Record<string, unknown>,
    userId?: string
  ): Promise<ContactEvent> {
    const event = await prisma.contactEvent.create({
      data: {
        contactId,
        eventType,
        eventData: eventData as any,
        userId,
      },
    })

    return {
      id: event.id,
      contactId: event.contactId,
      eventType: event.eventType,
      eventData: event.eventData as Record<string, unknown>,
      timestamp: event.timestamp,
      userId: event.userId || undefined,
    }
  }

  private mapToContact(dbContact: any): Contact {
    return {
      id: dbContact.id,
      name: dbContact.name || undefined,
      phone: dbContact.phone || undefined,
      email: dbContact.email || undefined,
      socialHandles: dbContact.socialHandles || [],
      tags: dbContact.tags || [],
      customFields: dbContact.customFields || {},
      lastContactAt: dbContact.lastContactAt || undefined,
      createdAt: dbContact.createdAt,
      updatedAt: dbContact.updatedAt,
      teamId: dbContact.teamId,
    }
  }

  private getChanges(existing: any, updates: UpdateContactInput): Record<string, any> {
    const changes: Record<string, any> = {}
    
    for (const [key, value] of Object.entries(updates)) {
      if (existing[key] !== value) {
        changes[key] = { from: existing[key], to: value }
      }
    }

    return changes
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    // Simple Levenshtein distance-based similarity
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1

    if (longer.length === 0) return 1.0

    const distance = this.levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase())
    return (longer.length - distance) / longer.length
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }

  private getEventTitle(eventType: ContactEventType): string {
    const titles = {
      [ContactEventType.CREATED]: 'Contact Created',
      [ContactEventType.UPDATED]: 'Contact Updated',
      [ContactEventType.MESSAGE_SENT]: 'Message Sent',
      [ContactEventType.MESSAGE_RECEIVED]: 'Message Received',
      [ContactEventType.NOTE_ADDED]: 'Note Added',
      [ContactEventType.TAG_ADDED]: 'Tag Added',
      [ContactEventType.TAG_REMOVED]: 'Tag Removed',
      [ContactEventType.MERGED]: 'Contact Merged',
      [ContactEventType.DELETED]: 'Contact Deleted',
    }

    return titles[eventType] || 'Unknown Event'
  }

  private getEventDescription(eventType: ContactEventType, eventData: any): string {
    switch (eventType) {
      case ContactEventType.TAG_ADDED:
        return `Added tag: ${eventData?.tag || 'Unknown'}`
      case ContactEventType.TAG_REMOVED:
        return `Removed tag: ${eventData?.tag || 'Unknown'}`
      case ContactEventType.MERGED:
        return `Merged ${eventData?.mergedContactIds?.length || 0} duplicate contacts`
      default:
        return ''
    }
  }
}

export const contactService = new ContactService()