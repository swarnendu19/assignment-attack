import axios, { AxiosInstance } from 'axios'
import { 
  SlackNotification, 
  SlackAttachment, 
  SlackField, 
  SlackWebhookPayload,
  SlackConfig 
} from '@/types/business'
import { Contact } from '@/types/contacts'

export class SlackService {
  private client: AxiosInstance
  private config: SlackConfig

  constructor(config: SlackConfig) {
    this.config = config
    this.client = axios.create({
      timeout: 10000,
    })
  }

  /**
   * Test Slack webhook connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.post(this.config.webhookUrl, {
        text: 'Test connection from Unified Inbox',
        username: this.config.username,
        icon_emoji: this.config.iconEmoji,
      })
      return response.status === 200
    } catch (error) {
      console.error('Slack connection test failed:', error)
      return false
    }
  }

  /**
   * Send a notification to Slack
   */
  async sendNotification(notification: SlackNotification): Promise<boolean> {
    try {
      const payload = {
        channel: notification.channel || this.config.channel,
        text: notification.text,
        username: notification.username || this.config.username,
        icon_emoji: notification.iconEmoji || this.config.iconEmoji,
        attachments: notification.attachments,
      }

      const response = await this.client.post(this.config.webhookUrl, payload)
      return response.status === 200
    } catch (error) {
      console.error('Error sending Slack notification:', error)
      return false
    }
  }

  /**
   * Send new message notification
   */
  async notifyNewMessage(
    contactName: string,
    channel: string,
    messagePreview: string,
    isUrgent = false
  ): Promise<boolean> {
    if (!this.shouldSendNotification('new_message', isUrgent)) {
      return true // Skip notification but return success
    }

    const urgentPrefix = isUrgent ? '🚨 URGENT: ' : ''
    const attachment: SlackAttachment = {
      color: isUrgent ? 'danger' : 'good',
      title: `${urgentPrefix}New message from ${contactName}`,
      text: messagePreview,
      fields: [
        {
          title: 'Channel',
          value: channel,
          short: true,
        },
        {
          title: 'Time',
          value: new Date().toLocaleString(),
          short: true,
        },
      ],
      timestamp: Math.floor(Date.now() / 1000),
    }

    return this.sendNotification({
      channel: this.config.channel,
      text: `${urgentPrefix}New message received`,
      attachments: [attachment],
    })
  }

  /**
   * Send new contact notification
   */
  async notifyNewContact(contact: Contact): Promise<boolean> {
    if (!this.shouldSendNotification('new_contact')) {
      return true
    }

    const fields: SlackField[] = []
    
    if (contact.email) {
      fields.push({
        title: 'Email',
        value: contact.email,
        short: true,
      })
    }
    
    if (contact.phone) {
      fields.push({
        title: 'Phone',
        value: contact.phone,
        short: true,
      })
    }

    if (contact.tags.length > 0) {
      fields.push({
        title: 'Tags',
        value: contact.tags.join(', '),
        short: false,
      })
    }

    const attachment: SlackAttachment = {
      color: 'good',
      title: `New contact: ${contact.name || 'Unknown'}`,
      fields,
      timestamp: Math.floor(Date.now() / 1000),
    }

    return this.sendNotification({
      channel: this.config.channel,
      text: 'New contact added to the system',
      attachments: [attachment],
    })
  }

  /**
   * Send mention notification
   */
  async notifyMention(
    mentionedUser: string,
    mentionerName: string,
    contactName: string,
    notePreview: string
  ): Promise<boolean> {
    if (!this.shouldSendNotification('mention')) {
      return true
    }

    const attachment: SlackAttachment = {
      color: 'warning',
      title: `You were mentioned by ${mentionerName}`,
      text: notePreview,
      fields: [
        {
          title: 'Contact',
          value: contactName,
          short: true,
        },
        {
          title: 'Time',
          value: new Date().toLocaleString(),
          short: true,
        },
      ],
      timestamp: Math.floor(Date.now() / 1000),
    }

    return this.sendNotification({
      channel: `@${mentionedUser}`, // Send as DM
      text: `<@${mentionedUser}> You were mentioned in a note`,
      attachments: [attachment],
    })
  }

  /**
   * Send system alert notification
   */
  async notifySystemAlert(
    alertType: 'error' | 'warning' | 'info',
    title: string,
    message: string,
    details?: Record<string, unknown>
  ): Promise<boolean> {
    if (!this.shouldSendNotification('system_alert')) {
      return true
    }

    const colors = {
      error: 'danger',
      warning: 'warning',
      info: 'good',
    }

    const emojis = {
      error: '🚨',
      warning: '⚠️',
      info: 'ℹ️',
    }

    const fields: SlackField[] = []
    
    if (details) {
      for (const [key, value] of Object.entries(details)) {
        fields.push({
          title: key,
          value: String(value),
          short: true,
        })
      }
    }

    const attachment: SlackAttachment = {
      color: colors[alertType],
      title: `${emojis[alertType]} ${title}`,
      text: message,
      fields,
      timestamp: Math.floor(Date.now() / 1000),
    }

    return this.sendNotification({
      channel: this.config.channel,
      text: `System Alert: ${alertType.toUpperCase()}`,
      attachments: [attachment],
    })
  }

  /**
   * Send integration sync notification
   */
  async notifyIntegrationSync(
    integration: string,
    status: 'success' | 'error' | 'warning',
    details: {
      synced?: number
      errors?: number
      warnings?: number
      duration?: number
    }
  ): Promise<boolean> {
    const colors = {
      success: 'good',
      error: 'danger',
      warning: 'warning',
    }

    const emojis = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
    }

    const fields: SlackField[] = []
    
    if (details.synced !== undefined) {
      fields.push({
        title: 'Synced',
        value: String(details.synced),
        short: true,
      })
    }
    
    if (details.errors !== undefined && details.errors > 0) {
      fields.push({
        title: 'Errors',
        value: String(details.errors),
        short: true,
      })
    }
    
    if (details.warnings !== undefined && details.warnings > 0) {
      fields.push({
        title: 'Warnings',
        value: String(details.warnings),
        short: true,
      })
    }
    
    if (details.duration !== undefined) {
      fields.push({
        title: 'Duration',
        value: `${details.duration}s`,
        short: true,
      })
    }

    const attachment: SlackAttachment = {
      color: colors[status],
      title: `${emojis[status]} ${integration} Sync ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      fields,
      timestamp: Math.floor(Date.now() / 1000),
    }

    return this.sendNotification({
      channel: this.config.channel,
      text: `Integration sync completed: ${integration}`,
      attachments: [attachment],
    })
  }

  /**
   * Process incoming Slack webhook (for slash commands or interactive components)
   */
  async processWebhook(payload: SlackWebhookPayload): Promise<any> {
    // Handle different Slack webhook types
    switch (payload.command) {
      case '/inbox-stats':
        return this.handleStatsCommand(payload)
      case '/inbox-search':
        return this.handleSearchCommand(payload)
      default:
        return {
          response_type: 'ephemeral',
          text: 'Unknown command',
        }
    }
  }

  /**
   * Private helper methods
   */
  private shouldSendNotification(type: string, isUrgent = false): boolean {
    // Always send urgent messages regardless of configuration
    if (isUrgent && type === 'new_message') {
      return true
    }
    
    return this.config.notificationTypes.includes(type as any)
  }

  private async handleStatsCommand(payload: SlackWebhookPayload): Promise<any> {
    // This would integrate with your analytics service
    // For now, return a placeholder response
    return {
      response_type: 'ephemeral',
      text: 'Inbox Statistics',
      attachments: [
        {
          color: 'good',
          fields: [
            {
              title: 'Total Messages Today',
              value: '42',
              short: true,
            },
            {
              title: 'Response Time Avg',
              value: '2.5 min',
              short: true,
            },
            {
              title: 'Active Conversations',
              value: '15',
              short: true,
            },
            {
              title: 'New Contacts',
              value: '3',
              short: true,
            },
          ],
        },
      ],
    }
  }

  private async handleSearchCommand(payload: SlackWebhookPayload): Promise<any> {
    const searchQuery = payload.text.trim()
    
    if (!searchQuery) {
      return {
        response_type: 'ephemeral',
        text: 'Please provide a search query. Usage: `/inbox-search john@example.com`',
      }
    }

    // This would integrate with your contact search service
    // For now, return a placeholder response
    return {
      response_type: 'ephemeral',
      text: `Search results for: "${searchQuery}"`,
      attachments: [
        {
          color: 'good',
          title: 'Contact Found',
          fields: [
            {
              title: 'Name',
              value: 'John Doe',
              short: true,
            },
            {
              title: 'Email',
              value: searchQuery,
              short: true,
            },
            {
              title: 'Last Contact',
              value: '2 hours ago',
              short: true,
            },
            {
              title: 'Messages',
              value: '12',
              short: true,
            },
          ],
        },
      ],
    }
  }
}

export const createSlackService = (config: SlackConfig) => new SlackService(config)