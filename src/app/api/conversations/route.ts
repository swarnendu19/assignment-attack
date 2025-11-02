import { NextRequest, NextResponse } from 'next/server'
import { messageService } from '@/services/messageService'
import { MessageSearchQuerySchema } from '@/types/messages'
import { auth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Get current user
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    
    // Parse search parameters
    const searchQuery = {
      query: searchParams.get('query') || undefined,
      channel: searchParams.get('channel') || undefined,
      isRead: searchParams.get('isRead') ? searchParams.get('isRead') === 'true' : undefined,
      dateFrom: searchParams.get('dateFrom') ? new Date(searchParams.get('dateFrom')!) : undefined,
      dateTo: searchParams.get('dateTo') ? new Date(searchParams.get('dateTo')!) : undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    }

    // Validate search query
    const validatedQuery = MessageSearchQuerySchema.parse(searchQuery)

    // Search messages and group by conversations
    const searchResult = await messageService.searchMessages(validatedQuery)
    
    // Group messages into conversation threads
    const conversations = await messageService.groupMessagesByConversation(
      searchResult.messages,
      {
        groupByContact: true,
        groupBySubject: false,
        timeWindowMinutes: 30,
      }
    )

    return NextResponse.json({
      conversations,
      total: searchResult.total,
      hasMore: searchResult.hasMore,
    })
  } catch (error) {
    console.error('Failed to fetch conversations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    )
  }
}