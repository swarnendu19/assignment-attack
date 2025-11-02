import { NextRequest, NextResponse } from 'next/server'
import { businessToolsService } from '@/services/businessToolsService'

/**
 * POST /api/webhooks/slack
 * Handle incoming Slack webhooks (slash commands, interactive components)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const params = new URLSearchParams(body)
    
    // Parse Slack webhook payload
    const payload = {
      token: params.get('token') || '',
      teamId: params.get('team_id') || '',
      teamDomain: params.get('team_domain') || '',
      channelId: params.get('channel_id') || '',
      channelName: params.get('channel_name') || '',
      userId: params.get('user_id') || '',
      userName: params.get('user_name') || '',
      command: params.get('command') || '',
      text: params.get('text') || '',
      responseUrl: params.get('response_url') || '',
      triggerId: params.get('trigger_id') || '',
    }

    // Validate token (you should implement proper token validation)
    if (!payload.token) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Find the appropriate Slack service based on team
    // For now, we'll use a simple approach - in production you'd want to map Slack teams to your teams
    const teamId = 'default' // You'll need to implement team mapping
    const configs = await businessToolsService.getBusinessToolConfigs(teamId)
    const slackConfig = configs.find(c => c.type === 'slack' && c.isEnabled)

    if (!slackConfig) {
      return NextResponse.json({ 
        response_type: 'ephemeral',
        text: 'Slack integration not configured for this team'
      })
    }

    // Process the webhook based on command
    let response

    switch (payload.command) {
      case '/inbox-stats':
        response = await handleStatsCommand(payload)
        break
      case '/inbox-search':
        response = await handleSearchCommand(payload)
        break
      case '/inbox-help':
        response = handleHelpCommand()
        break
      default:
        response = {
          response_type: 'ephemeral',
          text: `Unknown command: ${payload.command}. Type \`/inbox-help\` for available commands.`
        }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error processing Slack webhook:', error)
    return NextResponse.json({
      response_type: 'ephemeral',
      text: 'Sorry, there was an error processing your request.'
    })
  }
}

async function handleStatsCommand(payload: any): Promise<any> {
  // This would integrate with your analytics service
  // For now, return placeholder data
  return {
    response_type: 'ephemeral',
    text: 'Inbox Statistics for Today',
    attachments: [
      {
        color: 'good',
        fields: [
          {
            title: 'Total Messages',
            value: '127',
            short: true,
          },
          {
            title: 'Response Time (Avg)',
            value: '3.2 min',
            short: true,
          },
          {
            title: 'Active Conversations',
            value: '23',
            short: true,
          },
          {
            title: 'New Contacts',
            value: '8',
            short: true,
          },
          {
            title: 'Messages by Channel',
            value: 'SMS: 45, WhatsApp: 32, Email: 28, Social: 22',
            short: false,
          },
        ],
        footer: 'Unified Inbox',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  }
}

async function handleSearchCommand(payload: any): Promise<any> {
  const searchQuery = payload.text.trim()
  
  if (!searchQuery) {
    return {
      response_type: 'ephemeral',
      text: 'Please provide a search query.\n\nUsage:\n• `/inbox-search john@example.com` - Search by email\n• `/inbox-search +1234567890` - Search by phone\n• `/inbox-search John Doe` - Search by name'
    }
  }

  // This would integrate with your contact search service
  // For now, return placeholder data
  return {
    response_type: 'ephemeral',
    text: `Search results for: "${searchQuery}"`,
    attachments: [
      {
        color: 'good',
        title: 'Contact Found',
        title_link: `${process.env.NEXTAUTH_URL}/contacts/contact_123`,
        fields: [
          {
            title: 'Name',
            value: 'John Doe',
            short: true,
          },
          {
            title: 'Email',
            value: searchQuery.includes('@') ? searchQuery : 'john@example.com',
            short: true,
          },
          {
            title: 'Phone',
            value: searchQuery.startsWith('+') ? searchQuery : '+1 (555) 123-4567',
            short: true,
          },
          {
            title: 'Last Contact',
            value: '2 hours ago via WhatsApp',
            short: true,
          },
          {
            title: 'Total Messages',
            value: '24',
            short: true,
          },
          {
            title: 'Tags',
            value: 'customer, vip, support',
            short: true,
          },
        ],
        footer: 'Click title to view full contact profile',
      },
    ],
  }
}

function handleHelpCommand(): any {
  return {
    response_type: 'ephemeral',
    text: 'Unified Inbox Slack Commands',
    attachments: [
      {
        color: 'good',
        title: 'Available Commands',
        fields: [
          {
            title: '/inbox-stats',
            value: 'View inbox statistics and metrics',
            short: false,
          },
          {
            title: '/inbox-search <query>',
            value: 'Search for contacts by name, email, or phone',
            short: false,
          },
          {
            title: '/inbox-help',
            value: 'Show this help message',
            short: false,
          },
        ],
        footer: 'More commands coming soon!',
      },
    ],
  }
}