import axios, { AxiosInstance } from 'axios'
import { PrismaClient, ContactEventType } from '@prisma/client'
import { 
  HubSpotContact, 
  HubSpotSyncResult, 
  ContactSyncStatus, 
  SyncConflictResolution,
  HubSpotConfig 
} from '@/types/business'
import { Contact } from '@/types/contacts'
import { contactService } from './contactService'

const prisma = new PrismaClient()

export class HubSpotService {
  private client: AxiosInstance
  private config: HubSpotConfig

  constructor(config: HubSpotConfig) {
    this.config = config
    this.client = axios.create({
      baseURL: 'https://api.hubapi.com',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    })
  }

  /**
   * Test HubSpot API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/crm/v3/objects/contacts', {
        params: { limit: 1 }
      })
      return response.status === 200
    } catch (error) {
      console.error('HubSpot connection test failed:', error)
      return false
    }
  }

  /**
   * Sync a single contact to HubSpot
   */
  async syncContactToHubSpot(contact: Contact, userId: string): Promise<HubSpotSyncResult> {
    try {
      // Check if contact already exists in HubSpot
      const existingHubSpotContact = await this.findHubSpotContactByEmail(contact.email)
      
      const hubspotData = this.mapContactToHubSpot(contact)
      
      let result: HubSpotSyncResult

      if (existingHubSpotContact) {
        // Update existing contact
        const response = await this.client.patch(
          `/crm/v3/objects/contacts/${existingHubSpotContact.id}`,
          { properties: hubspotData }
        )
        
        result = {
          contactId: contact.id,
          hubspotId: existingHubSpotContact.id,
          action: 'updated',
          timestamp: new Date(),
        }
      } else {
        // Create new contact
        const response = await this.client.post('/crm/v3/objects/contacts', {
          properties: hubspotData
        })
        
        result = {
          contactId: contact.id,
          hubspotId: response.data.id,
          action: 'created',
          timestamp: new Date(),
        }
      }

      // Update sync status in database
      await this.updateContactSyncStatus(contact.id, {
        hubspotId: result.hubspotId,
        syncStatus: 'synced',
        lastSyncAt: new Date(),
      })

      // Create contact event
      await this.createContactEvent(
        contact.id,
        ContactEventType.UPDATED,
        { 
          hubspotSync: true, 
          hubspotId: result.hubspotId,
          action: result.action 
        },
        userId
      )

      return result

    } catch (error: any) {
      console.error('Error syncing contact to HubSpot:', error)
      
      const result: HubSpotSyncResult = {
        contactId: contact.id,
        action: 'error',
        error: error.response?.data?.message || error.message,
        timestamp: new Date(),
      }

      // Update sync status with error
      await this.updateContactSyncStatus(contact.id, {
        syncStatus: 'error',
        errorMessage: result.error,
      })

      return result
    }
  }

  /**
   * Sync contact from HubSpot to local database
   */
  async syncContactFromHubSpot(hubspotId: string, teamId: string, userId: string): Promise<HubSpotSyncResult> {
    try {
      // Get contact from HubSpot
      const response = await this.client.get(`/crm/v3/objects/contacts/${hubspotId}`)
      const hubspotContact: HubSpotContact = response.data

      // Check if contact already exists locally
      const existingContact = await this.findLocalContactByHubSpotId(hubspotId)
      
      const localContactData = this.mapHubSpotToContact(hubspotContact, teamId)
      
      let result: HubSpotSyncResult

      if (existingContact) {
        // Check for conflicts
        const conflicts = this.detectConflicts(existingContact, localContactData)
        
        if (conflicts.length > 0) {
          // Store conflict data for manual resolution
          await this.updateContactSyncStatus(existingContact.id, {
            syncStatus: 'conflict',
            conflictData: {
              localData: existingContact,
              remoteData: localContactData,
              conflictFields: conflicts,
            },
          })

          result = {
            contactId: existingContact.id,
            hubspotId,
            action: 'skipped',
            error: `Conflicts detected in fields: ${conflicts.join(', ')}`,
            timestamp: new Date(),
          }
        } else {
          // Update existing contact
          const updatedContact = await contactService.updateContact(
            existingContact.id,
            localContactData,
            userId
          )

          result = {
            contactId: updatedContact.id,
            hubspotId,
            action: 'updated',
            timestamp: new Date(),
          }
        }
      } else {
        // Create new contact
        const newContact = await contactService.createContact(localContactData, userId)

        result = {
          contactId: newContact.id,
          hubspotId,
          action: 'created',
          timestamp: new Date(),
        }
      }

      // Update sync status if successful
      if (result.action !== 'skipped') {
        await this.updateContactSyncStatus(result.contactId, {
          hubspotId,
          syncStatus: 'synced',
          lastSyncAt: new Date(),
        })
      }

      return result

    } catch (error: any) {
      console.error('Error syncing contact from HubSpot:', error)
      
      return {
        contactId: '',
        hubspotId,
        action: 'error',
        error: error.response?.data?.message || error.message,
        timestamp: new Date(),
      }
    }
  }

  /**
   * Bulk sync contacts to HubSpot
   */
  async bulkSyncToHubSpot(contactIds: string[], userId: string): Promise<HubSpotSyncResult[]> {
    const results: HubSpotSyncResult[] = []
    
    // Process contacts in batches to avoid rate limits
    const batchSize = 10
    for (let i = 0; i < contactIds.length; i += batchSize) {
      const batch = contactIds.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (contactId) => {
        const contact = await contactService.getContactById(contactId)
        if (contact) {
          return this.syncContactToHubSpot(contact, userId)
        }
        return {
          contactId,
          action: 'error' as const,
          error: 'Contact not found',
          timestamp: new Date(),
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      // Add delay between batches to respect rate limits
      if (i + batchSize < contactIds.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    return results
  }

  /**
   * Resolve sync conflicts
   */
  async resolveConflicts(resolution: SyncConflictResolution, userId: string): Promise<Contact> {
    const syncStatus = await this.getContactSyncStatus(resolution.contactId)
    
    if (!syncStatus || !syncStatus.conflictData) {
      throw new Error('No conflicts found for this contact')
    }

    const { localData, remoteData, conflictFields } = syncStatus.conflictData
    const resolvedData: any = { ...localData }

    // Apply field resolutions
    for (const field of conflictFields) {
      const resolution_type = resolution.fieldResolutions[field]
      
      switch (resolution_type) {
        case 'remote':
          resolvedData[field] = (remoteData as any)[field]
          break
        case 'merge':
          // Handle merge logic for specific fields
          if (field === 'tags' && Array.isArray((localData as any)[field]) && Array.isArray((remoteData as any)[field])) {
            resolvedData[field] = [...new Set([...(localData as any)[field], ...(remoteData as any)[field]])]
          } else if (field === 'customFields') {
            resolvedData[field] = { ...(localData as any)[field], ...(remoteData as any)[field] }
          }
          break
        case 'local':
        default:
          // Keep local data (no change needed)
          break
      }
    }

    // Update the contact with resolved data
    const updatedContact = await contactService.updateContact(
      resolution.contactId,
      resolvedData,
      userId
    )

    // Update sync status
    await this.updateContactSyncStatus(resolution.contactId, {
      syncStatus: 'synced',
      lastSyncAt: new Date(),
      conflictData: undefined,
      errorMessage: undefined,
    })

    // Sync resolved data back to HubSpot if bidirectional sync is enabled
    if (this.config.syncDirection === 'bidirectional' || this.config.syncDirection === 'to_hubspot') {
      await this.syncContactToHubSpot(updatedContact, userId)
    }

    return updatedContact
  }

  /**
   * Get sync status for all contacts
   */
  async getAllSyncStatuses(teamId: string): Promise<ContactSyncStatus[]> {
    // This would typically be stored in a separate sync_status table
    // For now, we'll use the customFields to store sync information
    const contacts = await prisma.contact.findMany({
      where: { teamId },
      select: {
        id: true,
        customFields: true,
      },
    })

    return contacts.map(contact => {
      const syncData = (contact.customFields as any)?.hubspotSync || {}
      return {
        contactId: contact.id,
        hubspotId: syncData.hubspotId,
        lastSyncAt: syncData.lastSyncAt ? new Date(syncData.lastSyncAt) : undefined,
        syncStatus: syncData.syncStatus || 'pending',
        errorMessage: syncData.errorMessage,
        conflictData: syncData.conflictData,
      }
    })
  }

  /**
   * Manual sync trigger
   */
  async triggerManualSync(teamId: string, userId: string): Promise<HubSpotSyncResult[]> {
    const contacts = await prisma.contact.findMany({
      where: { teamId },
    })

    const contactData = contacts.map(contact => ({
      id: contact.id,
      name: contact.name || undefined,
      phone: contact.phone || undefined,
      email: contact.email || undefined,
      socialHandles: contact.socialHandles as any || [],
      tags: contact.tags || [],
      customFields: contact.customFields as any || {},
      lastContactAt: contact.lastContactAt || undefined,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
      teamId: contact.teamId,
    }))

    return this.bulkSyncToHubSpot(contactData.map(c => c.id), userId)
  }

  /**
   * Private helper methods
   */
  private async findHubSpotContactByEmail(email?: string): Promise<HubSpotContact | null> {
    if (!email) return null

    try {
      const response = await this.client.get('/crm/v3/objects/contacts/search', {
        data: {
          filterGroups: [{
            filters: [{
              propertyName: 'email',
              operator: 'EQ',
              value: email
            }]
          }],
          limit: 1
        }
      })

      return response.data.results?.[0] || null
    } catch (error) {
      console.error('Error finding HubSpot contact by email:', error)
      return null
    }
  }

  private async findLocalContactByHubSpotId(hubspotId: string): Promise<Contact | null> {
    const contact = await prisma.contact.findFirst({
      where: {
        customFields: {
          path: ['hubspotSync', 'hubspotId'],
          equals: hubspotId
        }
      }
    })

    if (!contact) return null

    return {
      id: contact.id,
      name: contact.name || undefined,
      phone: contact.phone || undefined,
      email: contact.email || undefined,
      socialHandles: contact.socialHandles as any || [],
      tags: contact.tags || [],
      customFields: contact.customFields as any || {},
      lastContactAt: contact.lastContactAt || undefined,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
      teamId: contact.teamId,
    }
  }

  private mapContactToHubSpot(contact: Contact): Record<string, string> {
    const hubspotData: Record<string, string> = {}

    if (contact.email) hubspotData.email = contact.email
    if (contact.name) {
      const nameParts = contact.name.split(' ')
      hubspotData.firstname = nameParts[0]
      if (nameParts.length > 1) {
        hubspotData.lastname = nameParts.slice(1).join(' ')
      }
    }
    if (contact.phone) hubspotData.phone = contact.phone

    // Map custom fields based on configuration
    if (this.config.fieldMappings) {
      for (const [localField, hubspotField] of Object.entries(this.config.fieldMappings)) {
        const value = (contact.customFields as any)?.[localField]
        if (value !== undefined) {
          hubspotData[hubspotField] = String(value)
        }
      }
    }

    return hubspotData
  }

  private mapHubSpotToContact(hubspotContact: HubSpotContact, teamId: string): any {
    const contactData: any = { teamId }

    const props = hubspotContact.properties

    if (props.email) contactData.email = props.email
    if (props.phone) contactData.phone = props.phone
    
    // Combine first and last name
    const firstName = props.firstname || ''
    const lastName = props.lastname || ''
    if (firstName || lastName) {
      contactData.name = `${firstName} ${lastName}`.trim()
    }

    // Map custom fields based on configuration
    if (this.config.fieldMappings) {
      contactData.customFields = contactData.customFields || {}
      for (const [localField, hubspotField] of Object.entries(this.config.fieldMappings)) {
        const value = props[hubspotField]
        if (value !== undefined) {
          contactData.customFields[localField] = value
        }
      }
    }

    return contactData
  }

  private detectConflicts(localContact: Contact, remoteData: any): string[] {
    const conflicts: string[] = []

    // Check for conflicts in key fields
    if (localContact.name && remoteData.name && localContact.name !== remoteData.name) {
      conflicts.push('name')
    }
    if (localContact.email && remoteData.email && localContact.email !== remoteData.email) {
      conflicts.push('email')
    }
    if (localContact.phone && remoteData.phone && localContact.phone !== remoteData.phone) {
      conflicts.push('phone')
    }

    return conflicts
  }

  private async updateContactSyncStatus(contactId: string, status: Partial<ContactSyncStatus>): Promise<void> {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { customFields: true }
    })

    if (!contact) return

    const customFields = (contact.customFields as any) || {}
    const hubspotSync = customFields.hubspotSync || {}

    // Update sync status
    Object.assign(hubspotSync, status)
    customFields.hubspotSync = hubspotSync

    await prisma.contact.update({
      where: { id: contactId },
      data: { customFields: customFields as any }
    })
  }

  private async getContactSyncStatus(contactId: string): Promise<ContactSyncStatus | null> {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { customFields: true }
    })

    if (!contact) return null

    const syncData = (contact.customFields as any)?.hubspotSync || {}
    return {
      contactId,
      hubspotId: syncData.hubspotId,
      lastSyncAt: syncData.lastSyncAt ? new Date(syncData.lastSyncAt) : undefined,
      syncStatus: syncData.syncStatus || 'pending',
      errorMessage: syncData.errorMessage,
      conflictData: syncData.conflictData,
    }
  }

  private async createContactEvent(
    contactId: string,
    eventType: ContactEventType,
    eventData: Record<string, unknown>,
    userId: string
  ): Promise<void> {
    await prisma.contactEvent.create({
      data: {
        contactId,
        eventType,
        eventData: eventData as any,
        userId,
      },
    })
  }
}

export const createHubSpotService = (config: HubSpotConfig) => new HubSpotService(config)