import axios, { AxiosInstance } from 'axios'
import { 
  ZapierWebhookPayload, 
  ZapierTriggerEvent, 
  ZapierTriggerType,
  ZapierConfig 
} from '@/types/business'
import { Contact } from '@/types/contacts'

export class ZapierService {
  private client: AxiosInstance
  private config: ZapierConfig

  constructor(config: ZapierConfig) {
    this.config = config
    this.client = axios.create({
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  /**
   * Test Zapier webhook connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const testPayload = {
        trigger: 'test_connection',
        data: {
          message: 'Test connection from Unified Inbox',
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
      }

      const response = await this.client.post(this.config.webhookUrl, testPayload)
      return response.status >= 200 && response.status < 300
    } catch (error) {
      console.error('Zapier connection test failed:', error)
      return false
    }
  }

  /**
   * Send trigger event to Zapier
   */
  async sendTriggerEvent(event: ZapierTriggerEvent): Promise<boolean> {
    if (!this.shouldSendTrigger(event.type)) {
      return true // Skip trigger but return success
    }

    try {
      const payload: ZapierWebhookPayload = {
        trigger: event.type,
        data: {
          id: event.id,
          type: event.type,
          contactId: event.contactId,
          messageId: event.messageId,
          timestamp: event.timestamp.toISOString(),
          ...event.data,
          ...(this.config.includeMetadata && { metadata: this.getSystemMetadata() }),
        },
        timestamp: event.timestamp,
      }

      const response = await this.client.post(this.config.webhookUrl, payload)
      return response.status >= 200 && response.status < 300
    } catch (error) {
      console.error('Error sending Zapier trigger:', error)
      return false
    }
  }

  /**
   * Trigger contact created event
   */
  async triggerContactCreated(contact: Contact, userId: string): Promise<boolean> {
    const event: ZapierTriggerEvent = {
      id: `contact_created_${contact.id}`,
      type: 'contact_created',
      contactId: contact.id,
      data: {
        contact: {
          id: contact.id,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          tags: contact.tags,
          customFields: contact.customFields,
          createdAt: contact.createdAt.toISOString(),
          teamId: contact.teamId,
        },
        createdBy: userId,
      },
      timestamp: new Date(),
    }

    return this.sendTriggerEvent(event)
  }

  /**
   * Trigger contact updated event
   */
  async triggerContactUpdated(
    contact: Contact, 
    changes: Record<string, any>, 
    userId: string
  ): Promise<boolean> {
    const event: ZapierTriggerEvent = {
      id: `contact_updated_${contact.id}_${Date.now()}`,
      type: 'contact_updated',
      contactId: contact.id,
      data: {
        contact: {
          id: contact.id,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          tags: contact.tags,
          customFields: contact.customFields,
          updatedAt: contact.updatedAt.toISOString(),
          teamId: contact.teamId,
        },
        changes,
        updatedBy: userId,
      },
      timestamp: new Date(),
    }

    return this.sendTriggerEvent(event)
  }

  /**
   * Trigger message received event
   */
  async triggerMessageReceived(
    messageId: string,
    contactId: string,
    channel: string,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<boolean> {
    const event: ZapierTriggerEvent = {
      id: `message_received_${messageId}`,
      type: 'message_received',
      contactId,
      messageId,
      data: {
        message: {
          id: messageId,
          content,
          channel,
          direction: 'inbound',
          timestamp: new Date().toISOString(),
          metadata,
        },
        contact: {
          id: contactId,
        },
      },
      timestamp: new Date(),
    }

    return this.sendTriggerEvent(event)
  }

  /**
   * Trigger message sent event
   */
  async triggerMessageSent(
    messageId: string,
    contactId: string,
    channel: string,
    content: string,
    userId: string,
    metadata?: Record<string, unknown>
  ): Promise<boolean> {
    const event: ZapierTriggerEvent = {
      id: `message_sent_${messageId}`,
      type: 'message_sent',
      contactId,
      messageId,
      data: {
        message: {
          id: messageId,
          content,
          channel,
          direction: 'outbound',
          timestamp: new Date().toISOString(),
          metadata,
        },
        contact: {
          id: contactId,
        },
        sentBy: userId,
      },
      timestamp: new Date(),
    }

    return this.sendTriggerEvent(event)
  }

  /**
   * Trigger note added event
   */
  async triggerNoteAdded(
    noteId: string,
    contactId: string,
    content: string,
    isPrivate: boolean,
    userId: string
  ): Promise<boolean> {
    const event: ZapierTriggerEvent = {
      id: `note_added_${noteId}`,
      type: 'note_added',
      contactId,
      data: {
        note: {
          id: noteId,
          content,
          isPrivate,
          timestamp: new Date().toISOString(),
        },
        contact: {
          id: contactId,
        },
        addedBy: userId,
      },
      timestamp: new Date(),
    }

    return this.sendTriggerEvent(event)
  }

  /**
   * Trigger conversation started event
   */
  async triggerConversationStarted(
    conversationId: string,
    contactId: string,
    channel: string,
    firstMessageId: string
  ): Promise<boolean> {
    const event: ZapierTriggerEvent = {
      id: `conversation_started_${conversationId}`,
      type: 'conversation_started',
      contactId,
      messageId: firstMessageId,
      data: {
        conversation: {
          id: conversationId,
          channel,
          startedAt: new Date().toISOString(),
        },
        contact: {
          id: contactId,
        },
        firstMessage: {
          id: firstMessageId,
        },
      },
      timestamp: new Date(),
    }

    return this.sendTriggerEvent(event)
  }

  /**
   * Trigger conversation closed event
   */
  async triggerConversationClosed(
    conversationId: string,
    contactId: string,
    channel: string,
    userId: string,
    reason?: string
  ): Promise<boolean> {
    const event: ZapierTriggerEvent = {
      id: `conversation_closed_${conversationId}`,
      type: 'conversation_closed',
      contactId,
      data: {
        conversation: {
          id: conversationId,
          channel,
          closedAt: new Date().toISOString(),
          reason,
        },
        contact: {
          id: contactId,
        },
        closedBy: userId,
      },
      timestamp: new Date(),
    }

    return this.sendTriggerEvent(event)
  }

  /**
   * Process incoming Zapier webhook (for actions)
   */
  async processIncomingWebhook(payload: any): Promise<any> {
    try {
      // Validate webhook payload
      if (!payload.action || !payload.data) {
        throw new Error('Invalid webhook payload')
      }

      // Handle different action types
      switch (payload.action) {
        case 'create_contact':
          return this.handleCreateContactAction(payload.data)
        case 'send_message':
          return this.handleSendMessageAction(payload.data)
        case 'add_note':
          return this.handleAddNoteAction(payload.data)
        case 'add_tag':
          return this.handleAddTagAction(payload.data)
        default:
          throw new Error(`Unknown action: ${payload.action}`)
      }
    } catch (error) {
      console.error('Error processing Zapier webhook:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Get webhook configuration for Zapier app setup
   */
  getWebhookConfig(): any {
    return {
      triggers: this.config.triggerEvents.map(event => ({
        key: event,
        name: this.getTriggerDisplayName(event),
        description: this.getTriggerDescription(event),
        operation: {
          type: 'hook',
          perform: {
            url: this.config.webhookUrl,
            method: 'POST',
          },
        },
        sample: this.getTriggerSample(event),
      })),
      actions: [
        {
          key: 'create_contact',
          name: 'Create Contact',
          description: 'Create a new contact in the unified inbox',
          operation: {
            type: 'create',
            perform: {
              url: `${this.config.webhookUrl}/actions/create_contact`,
              method: 'POST',
            },
          },
        },
        {
          key: 'send_message',
          name: 'Send Message',
          description: 'Send a message to a contact',
          operation: {
            type: 'create',
            perform: {
              url: `${this.config.webhookUrl}/actions/send_message`,
              method: 'POST',
            },
          },
        },
      ],
    }
  }

  /**
   * Private helper methods
   */
  private shouldSendTrigger(triggerType: ZapierTriggerType): boolean {
    return this.config.triggerEvents.includes(triggerType)
  }

  private getSystemMetadata(): Record<string, unknown> {
    return {
      system: 'unified-inbox',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    }
  }

  private getTriggerDisplayName(event: ZapierTriggerType): string {
    const names = {
      contact_created: 'New Contact',
      contact_updated: 'Updated Contact',
      message_received: 'New Message Received',
      message_sent: 'Message Sent',
      note_added: 'Note Added',
      conversation_started: 'Conversation Started',
      conversation_closed: 'Conversation Closed',
    }
    return names[event] || event
  }

  private getTriggerDescription(event: ZapierTriggerType): string {
    const descriptions = {
      contact_created: 'Triggers when a new contact is created',
      contact_updated: 'Triggers when a contact is updated',
      message_received: 'Triggers when a new message is received',
      message_sent: 'Triggers when a message is sent',
      note_added: 'Triggers when a note is added to a contact',
      conversation_started: 'Triggers when a new conversation is started',
      conversation_closed: 'Triggers when a conversation is closed',
    }
    return descriptions[event] || `Triggers on ${event}`
  }

  private getTriggerSample(event: ZapierTriggerType): any {
    const samples = {
      contact_created: {
        id: 'contact_created_123',
        type: 'contact_created',
        contactId: 'contact_123',
        data: {
          contact: {
            id: 'contact_123',
            name: 'John Doe',
            email: 'john@example.com',
            phone: '+1234567890',
            tags: ['customer', 'vip'],
            createdAt: '2023-01-01T00:00:00Z',
          },
          createdBy: 'user_456',
        },
        timestamp: '2023-01-01T00:00:00Z',
      },
      message_received: {
        id: 'message_received_789',
        type: 'message_received',
        contactId: 'contact_123',
        messageId: 'message_789',
        data: {
          message: {
            id: 'message_789',
            content: 'Hello, I need help with my order',
            channel: 'sms',
            direction: 'inbound',
            timestamp: '2023-01-01T00:00:00Z',
          },
          contact: {
            id: 'contact_123',
          },
        },
        timestamp: '2023-01-01T00:00:00Z',
      },
    }
    return samples[event] || {}
  }

  private async handleCreateContactAction(data: any): Promise<any> {
    // This would integrate with your contact service
    // For now, return a placeholder response
    return {
      success: true,
      contact: {
        id: 'new_contact_id',
        name: data.name,
        email: data.email,
        phone: data.phone,
        createdAt: new Date().toISOString(),
      },
    }
  }

  private async handleSendMessageAction(data: any): Promise<any> {
    // This would integrate with your message service
    // For now, return a placeholder response
    return {
      success: true,
      message: {
        id: 'new_message_id',
        content: data.content,
        channel: data.channel,
        sentAt: new Date().toISOString(),
      },
    }
  }

  private async handleAddNoteAction(data: any): Promise<any> {
    // This would integrate with your note service
    // For now, return a placeholder response
    return {
      success: true,
      note: {
        id: 'new_note_id',
        content: data.content,
        contactId: data.contactId,
        createdAt: new Date().toISOString(),
      },
    }
  }

  private async handleAddTagAction(data: any): Promise<any> {
    // This would integrate with your contact service
    // For now, return a placeholder response
    return {
      success: true,
      contact: {
        id: data.contactId,
        tags: [...(data.existingTags || []), data.tag],
        updatedAt: new Date().toISOString(),
      },
    }
  }
}

export const createZapierService = (config: ZapierConfig) => new ZapierService(config)