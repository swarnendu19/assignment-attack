import { PrismaClient } from '@prisma/client'
import { 
  BusinessToolConfig, 
  BusinessToolType, 
  BusinessToolConfig_Input,
  HubSpotConfig,
  SlackConfig,
  ZapierConfig,
  HubSpotSyncResult,
  ContactSyncStatus,
  SyncConflictResolution,
  BusinessToolConfigSchema,
  HubSpotConfigSchema,
  SlackConfigSchema,
  ZapierConfigSchema
} from '@/types/business'
import { Contact } from '@/types/contacts'
import { HubSpotService, createHubSpotService } from './hubspotService'
import { SlackService, createSlackService } from './slackService'
import { ZapierService, createZapierService } from './zapierService'

const prisma = new PrismaClient()

export class BusinessToolsService {
  private hubspotServices: Map<string, HubSpotService> = new Map()
  private slackServices: Map<string, SlackService> = new Map()
  private zapierServices: Map<string, ZapierService> = new Map()

  /**
   * Get all business tool configurations for a team
   */
  async getBusinessToolConfigs(teamId: string): Promise<BusinessToolConfig[]> {
    // For now, we'll store configurations in the team settings
    // In a production app, you might want a separate business_tools table
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { settings: true }
    })

    if (!team?.settings) {
      return []
    }

    const settings = team.settings as any
    const businessTools = settings.businessTools || {}

    return Object.entries(businessTools).map(([id, config]: [string, any]) => ({
      id,
      name: config.name,
      type: config.type,
      isEnabled: config.isEnabled,
      credentials: config.credentials || {},
      settings: config.settings || {},
      lastSyncAt: config.lastSyncAt ? new Date(config.lastSyncAt) : undefined,
      createdAt: new Date(config.createdAt),
      updatedAt: new Date(config.updatedAt),
    }))
  }

  /**
   * Create or update a business tool configuration
   */
  async saveBusinessToolConfig(
    teamId: string,
    configId: string,
    input: BusinessToolConfig_Input
  ): Promise<BusinessToolConfig> {
    // Validate input based on tool type
    const validatedInput = BusinessToolConfigSchema.parse(input)
    
    // Validate type-specific configuration
    this.validateTypeSpecificConfig(validatedInput.type, validatedInput.settings)

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { settings: true }
    })

    const settings = (team?.settings as any) || {}
    const businessTools = settings.businessTools || {}

    const config: BusinessToolConfig = {
      id: configId,
      name: validatedInput.name,
      type: validatedInput.type,
      isEnabled: validatedInput.isEnabled,
      credentials: validatedInput.credentials,
      settings: validatedInput.settings,
      lastSyncAt: businessTools[configId]?.lastSyncAt ? new Date(businessTools[configId].lastSyncAt) : undefined,
      createdAt: businessTools[configId]?.createdAt ? new Date(businessTools[configId].createdAt) : new Date(),
      updatedAt: new Date(),
    }

    businessTools[configId] = {
      ...config,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString(),
      lastSyncAt: config.lastSyncAt?.toISOString(),
    }

    settings.businessTools = businessTools

    await prisma.team.update({
      where: { id: teamId },
      data: { settings: settings as any }
    })

    // Initialize service instance
    await this.initializeService(teamId, config)

    return config
  }

  /**
   * Delete a business tool configuration
   */
  async deleteBusinessToolConfig(teamId: string, configId: string): Promise<void> {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { settings: true }
    })

    if (!team?.settings) {
      return
    }

    const settings = team.settings as any
    const businessTools = settings.businessTools || {}

    delete businessTools[configId]
    settings.businessTools = businessTools

    await prisma.team.update({
      where: { id: teamId },
      data: { settings: settings as any }
    })

    // Clean up service instances
    this.hubspotServices.delete(`${teamId}_${configId}`)
    this.slackServices.delete(`${teamId}_${configId}`)
    this.zapierServices.delete(`${teamId}_${configId}`)
  }

  /**
   * Test connection for a business tool
   */
  async testConnection(teamId: string, configId: string): Promise<boolean> {
    const configs = await this.getBusinessToolConfigs(teamId)
    const config = configs.find(c => c.id === configId)

    if (!config || !config.isEnabled) {
      return false
    }

    const serviceKey = `${teamId}_${configId}`

    switch (config.type) {
      case 'hubspot':
        const hubspotService = this.hubspotServices.get(serviceKey)
        return hubspotService ? await hubspotService.testConnection() : false

      case 'slack':
        const slackService = this.slackServices.get(serviceKey)
        return slackService ? await slackService.testConnection() : false

      case 'zapier':
        const zapierService = this.zapierServices.get(serviceKey)
        return zapierService ? await zapierService.testConnection() : false

      default:
        return false
    }
  }

  /**
   * Initialize all services for a team
   */
  async initializeTeamServices(teamId: string): Promise<void> {
    const configs = await this.getBusinessToolConfigs(teamId)
    
    for (const config of configs) {
      if (config.isEnabled) {
        await this.initializeService(teamId, config)
      }
    }
  }

  /**
   * HubSpot-specific methods
   */
  async syncContactToHubSpot(
    teamId: string,
    configId: string,
    contact: Contact,
    userId: string
  ): Promise<HubSpotSyncResult> {
    const hubspotService = this.hubspotServices.get(`${teamId}_${configId}`)
    
    if (!hubspotService) {
      throw new Error('HubSpot service not initialized')
    }

    const result = await hubspotService.syncContactToHubSpot(contact, userId)
    
    // Update last sync time
    await this.updateLastSyncTime(teamId, configId)
    
    return result
  }

  async bulkSyncToHubSpot(
    teamId: string,
    configId: string,
    contactIds: string[],
    userId: string
  ): Promise<HubSpotSyncResult[]> {
    const hubspotService = this.hubspotServices.get(`${teamId}_${configId}`)
    
    if (!hubspotService) {
      throw new Error('HubSpot service not initialized')
    }

    const results = await hubspotService.bulkSyncToHubSpot(contactIds, userId)
    
    // Update last sync time
    await this.updateLastSyncTime(teamId, configId)
    
    return results
  }

  async getHubSpotSyncStatuses(teamId: string, configId: string): Promise<ContactSyncStatus[]> {
    const hubspotService = this.hubspotServices.get(`${teamId}_${configId}`)
    
    if (!hubspotService) {
      throw new Error('HubSpot service not initialized')
    }

    return hubspotService.getAllSyncStatuses(teamId)
  }

  async resolveHubSpotConflicts(
    teamId: string,
    configId: string,
    resolution: SyncConflictResolution,
    userId: string
  ): Promise<Contact> {
    const hubspotService = this.hubspotServices.get(`${teamId}_${configId}`)
    
    if (!hubspotService) {
      throw new Error('HubSpot service not initialized')
    }

    return hubspotService.resolveConflicts(resolution, userId)
  }

  /**
   * Slack-specific methods
   */
  async sendSlackNotification(
    teamId: string,
    configId: string,
    type: 'new_message' | 'new_contact' | 'mention' | 'system_alert',
    data: any
  ): Promise<boolean> {
    const slackService = this.slackServices.get(`${teamId}_${configId}`)
    
    if (!slackService) {
      return false // Fail silently for notifications
    }

    switch (type) {
      case 'new_message':
        return slackService.notifyNewMessage(
          data.contactName,
          data.channel,
          data.messagePreview,
          data.isUrgent
        )
      case 'new_contact':
        return slackService.notifyNewContact(data.contact)
      case 'mention':
        return slackService.notifyMention(
          data.mentionedUser,
          data.mentionerName,
          data.contactName,
          data.notePreview
        )
      case 'system_alert':
        return slackService.notifySystemAlert(
          data.alertType,
          data.title,
          data.message,
          data.details
        )
      default:
        return false
    }
  }

  /**
   * Zapier-specific methods
   */
  async triggerZapierEvent(
    teamId: string,
    configId: string,
    eventType: string,
    data: any
  ): Promise<boolean> {
    const zapierService = this.zapierServices.get(`${teamId}_${configId}`)
    
    if (!zapierService) {
      return false // Fail silently for triggers
    }

    switch (eventType) {
      case 'contact_created':
        return zapierService.triggerContactCreated(data.contact, data.userId)
      case 'contact_updated':
        return zapierService.triggerContactUpdated(data.contact, data.changes, data.userId)
      case 'message_received':
        return zapierService.triggerMessageReceived(
          data.messageId,
          data.contactId,
          data.channel,
          data.content,
          data.metadata
        )
      case 'message_sent':
        return zapierService.triggerMessageSent(
          data.messageId,
          data.contactId,
          data.channel,
          data.content,
          data.userId,
          data.metadata
        )
      case 'note_added':
        return zapierService.triggerNoteAdded(
          data.noteId,
          data.contactId,
          data.content,
          data.isPrivate,
          data.userId
        )
      default:
        return false
    }
  }

  /**
   * Broadcast events to all enabled integrations
   */
  async broadcastEvent(teamId: string, eventType: string, data: any): Promise<void> {
    const configs = await this.getBusinessToolConfigs(teamId)
    
    const promises = configs
      .filter(config => config.isEnabled)
      .map(async (config) => {
        try {
          switch (config.type) {
            case 'slack':
              if (['new_message', 'new_contact', 'mention', 'system_alert'].includes(eventType)) {
                await this.sendSlackNotification(teamId, config.id, eventType as any, data)
              }
              break
            case 'zapier':
              await this.triggerZapierEvent(teamId, config.id, eventType, data)
              break
          }
        } catch (error) {
          console.error(`Error broadcasting ${eventType} to ${config.type}:`, error)
        }
      })

    await Promise.allSettled(promises)
  }

  /**
   * Private helper methods
   */
  private validateTypeSpecificConfig(type: BusinessToolType, settings: Record<string, unknown>): void {
    switch (type) {
      case 'hubspot':
        HubSpotConfigSchema.parse(settings)
        break
      case 'slack':
        SlackConfigSchema.parse(settings)
        break
      case 'zapier':
        ZapierConfigSchema.parse(settings)
        break
    }
  }

  private async initializeService(teamId: string, config: BusinessToolConfig): Promise<void> {
    const serviceKey = `${teamId}_${config.id}`

    switch (config.type) {
      case 'hubspot':
        const hubspotConfig = config.settings as HubSpotConfig
        const hubspotService = createHubSpotService({
          ...hubspotConfig,
          apiKey: config.credentials.apiKey,
        })
        this.hubspotServices.set(serviceKey, hubspotService)
        break

      case 'slack':
        const slackConfig = config.settings as SlackConfig
        const slackService = createSlackService({
          ...slackConfig,
          webhookUrl: config.credentials.webhookUrl,
        })
        this.slackServices.set(serviceKey, slackService)
        break

      case 'zapier':
        const zapierConfig = config.settings as ZapierConfig
        const zapierService = createZapierService({
          ...zapierConfig,
          webhookUrl: config.credentials.webhookUrl,
        })
        this.zapierServices.set(serviceKey, zapierService)
        break
    }
  }

  private async updateLastSyncTime(teamId: string, configId: string): Promise<void> {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { settings: true }
    })

    if (!team?.settings) {
      return
    }

    const settings = team.settings as any
    const businessTools = settings.businessTools || {}

    if (businessTools[configId]) {
      businessTools[configId].lastSyncAt = new Date().toISOString()
      settings.businessTools = businessTools

      await prisma.team.update({
        where: { id: teamId },
        data: { settings: settings as any }
      })
    }
  }
}

export const businessToolsService = new BusinessToolsService()