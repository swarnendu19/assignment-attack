import { NextRequest, NextResponse } from 'next/server'
import { scheduledMessageService } from '@/services/scheduledMessageService'
import { auth } from '@/lib/auth'
import { CreateScheduledMessageSchema } from '@/types/database'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const channel = searchParams.get('channel')
    const contactId = searchParams.get('contactId')
    const userId = searchParams.get('userId')
    const scheduledAfter = searchParams.get('scheduledAfter')
    const scheduledBefore = searchParams.get('scheduledBefore')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    const query: any = {}
    if (status) query.status = status
    if (channel) query.channel = channel
    if (contactId) query.contactId = contactId
    if (userId) query.userId = userId
    if (scheduledAfter) query.scheduledAfter = new Date(scheduledAfter)
    if (scheduledBefore) query.scheduledBefore = new Date(scheduledBefore)
    query.limit = limit
    query.offset = offset

    const result = await scheduledMessageService.searchScheduledMessages(
      query,
      session.user.teamId
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching scheduled messages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch scheduled messages' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // Validate input
    const validatedInput = CreateScheduledMessageSchema.parse(body)

    const scheduledMessage = await scheduledMessageService.createScheduledMessage(
      validatedInput,
      session.user.id
    )

    return NextResponse.json(scheduledMessage, { status: 201 })
  } catch (error) {
    console.error('Error creating scheduled message:', error)
    
    if (error instanceof Error && error.message.includes('validation')) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create scheduled message' },
      { status: 500 }
    )
  }
}