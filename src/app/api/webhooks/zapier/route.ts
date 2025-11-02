import { NextRequest, NextResponse } from 'next/server'
import { contactService } from '@/services/contactService'
import { businessToolsService } from '@/services/businessToolsService'

/**
 * POST /api/webhooks/zapier
 * Handle incoming Zapier webhooks (actions)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate webhook payload
    if (!body.action || !body.data) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid webhook payload' 
      }, { status: 400 })
    }

    // Process the action
    let result

    switch (body.action) {
      case 'create_contact':
        result = await handleCreateContactAction(body.data)
        break
      case 'send_message':
        result = await handleSendMessageAction(body.data)
        break
      case 'add_note':
        result = await handleAddNoteAction(body.data)
        break
      case 'add_tag':
        result = await handleAddTagAction(body.data)
        break
      case 'search_contacts':
        result = await handleSearchContactsAction(body.data)
        break
      default:
        return NextResponse.json({ 
          success: false, 
          error: `Unknown action: ${body.action}` 
        }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error processing Zapier webhook:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function handleCreateContactAction(data: any): Promise<any> {
  try {
    // Validate required fields
    if (!data.teamId) {
      throw new Error('Team ID is required')
    }

    if (!data.name && !data.email && !data.phone) {
      throw new Error('At least one of name, email, or phone is required')
    }

    const contactData = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      tags: data.tags || [],
      customFields: data.customFields || {},
      teamId: data.teamId,
    }

    const contact = await contactService.createContact(contactData, data.userId || 'zapier')

    // Trigger other integrations
    await businessToolsService.broadcastEvent(data.teamId, 'contact_created', {
      contact,
      userId: data.userId || 'zapier'
    })

    return {
      success: true,
      contact: {
        id: contact.id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        tags: contact.tags,
        createdAt: contact.createdAt.toISOString(),
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create contact'
    }
  }
}

async function handleSendMessageAction(data: any): Promise<any> {
  try {
    // Validate required fields
    if (!data.contactId || !data.content || !data.channel) {
      throw new Error('Contact ID, content, and channel are required')
    }

    // This would integrate with your message service
    // For now, return a placeholder response
    const messageId = `msg_${Date.now()}`

    return {
      success: true,
      message: {
        id: messageId,
        contactId: data.contactId,
        content: data.content,
        channel: data.channel,
        direction: 'outbound',
        sentAt: new Date().toISOString(),
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message'
    }
  }
}

async function handleAddNoteAction(data: any): Promise<any> {
  try {
    // Validate required fields
    if (!data.contactId || !data.content) {
      throw new Error('Contact ID and content are required')
    }

    // This would integrate with your note service
    // For now, return a placeholder response
    const noteId = `note_${Date.now()}`

    return {
      success: true,
      note: {
        id: noteId,
        contactId: data.contactId,
        content: data.content,
        isPrivate: data.isPrivate || false,
        createdAt: new Date().toISOString(),
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add note'
    }
  }
}

async function handleAddTagAction(data: any): Promise<any> {
  try {
    // Validate required fields
    if (!data.contactId || !data.tag) {
      throw new Error('Contact ID and tag are required')
    }

    const contact = await contactService.addTags(
      data.contactId, 
      [data.tag], 
      data.userId || 'zapier'
    )

    return {
      success: true,
      contact: {
        id: contact.id,
        tags: contact.tags,
        updatedAt: contact.updatedAt.toISOString(),
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add tag'
    }
  }
}

async function handleSearchContactsAction(data: any): Promise<any> {
  try {
    // Validate required fields
    if (!data.teamId) {
      throw new Error('Team ID is required')
    }

    const searchQuery = {
      query: data.query,
      tags: data.tags,
      hasPhone: data.hasPhone,
      hasEmail: data.hasEmail,
      limit: Math.min(data.limit || 10, 50), // Cap at 50 results
      offset: data.offset || 0,
    }

    const result = await contactService.searchContacts(searchQuery, data.teamId)

    return {
      success: true,
      contacts: result.contacts.map(contact => ({
        id: contact.id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        tags: contact.tags,
        lastContactAt: contact.lastContactAt?.toISOString(),
        createdAt: contact.createdAt.toISOString(),
      })),
      total: result.total,
      hasMore: result.hasMore,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search contacts'
    }
  }
}

/**
 * GET /api/webhooks/zapier
 * Return webhook configuration for Zapier app setup
 */
export async function GET(request: NextRequest) {
  try {
    const config = {
      triggers: [
        {
          key: 'contact_created',
          name: 'New Contact',
          description: 'Triggers when a new contact is created',
          sample: {
            id: 'contact_created_123',
            type: 'contact_created',
            contactId: 'contact_123',
            data: {
              contact: {
                id: 'contact_123',
                name: 'John Doe',
                email: 'john@example.com',
                phone: '+1234567890',
                tags: ['customer'],
                createdAt: '2023-01-01T00:00:00Z',
              },
              createdBy: 'user_456',
            },
            timestamp: '2023-01-01T00:00:00Z',
          }
        },
        {
          key: 'message_received',
          name: 'New Message Received',
          description: 'Triggers when a new message is received',
          sample: {
            id: 'message_received_789',
            type: 'message_received',
            contactId: 'contact_123',
            messageId: 'message_789',
            data: {
              message: {
                id: 'message_789',
                content: 'Hello, I need help',
                channel: 'sms',
                direction: 'inbound',
                timestamp: '2023-01-01T00:00:00Z',
              },
              contact: {
                id: 'contact_123',
              },
            },
            timestamp: '2023-01-01T00:00:00Z',
          }
        }
      ],
      actions: [
        {
          key: 'create_contact',
          name: 'Create Contact',
          description: 'Create a new contact in the unified inbox',
          inputFields: [
            { key: 'teamId', label: 'Team ID', required: true },
            { key: 'name', label: 'Name', required: false },
            { key: 'email', label: 'Email', required: false },
            { key: 'phone', label: 'Phone', required: false },
            { key: 'tags', label: 'Tags (comma-separated)', required: false },
          ]
        },
        {
          key: 'add_tag',
          name: 'Add Tag to Contact',
          description: 'Add a tag to an existing contact',
          inputFields: [
            { key: 'contactId', label: 'Contact ID', required: true },
            { key: 'tag', label: 'Tag', required: true },
          ]
        }
      ]
    }

    return NextResponse.json(config)
  } catch (error) {
    console.error('Error getting Zapier config:', error)
    return NextResponse.json(
      { error: 'Failed to get webhook configuration' },
      { status: 500 }
    )
  }
}