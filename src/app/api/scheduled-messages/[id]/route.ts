import { NextRequest, NextResponse } from 'next/server'
import { scheduledMessageService } from '@/services/scheduledMessageService'
import { auth } from '@/lib/auth'
import { UpdateScheduledMessageSchema } from '@/types/database'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const scheduledMessage = await scheduledMessageService.getScheduledMessageById(params.id)
    
    if (!scheduledMessage) {
      return NextResponse.json({ error: 'Scheduled message not found' }, { status: 404 })
    }

    // Check if user has access to this message
    if (scheduledMessage.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(scheduledMessage)
  } catch (error) {
    console.error('Error fetching scheduled message:', error)
    return NextResponse.json(
      { error: 'Failed to fetch scheduled message' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // Validate input
    const validatedInput = UpdateScheduledMessageSchema.parse(body)

    const updatedMessage = await scheduledMessageService.updateScheduledMessage(
      params.id,
      validatedInput,
      session.user.id
    )

    return NextResponse.json(updatedMessage)
  } catch (error) {
    console.error('Error updating scheduled message:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: 'Scheduled message not found' }, { status: 404 })
      }
      if (error.message.includes('Permission denied')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (error.message.includes('validation')) {
        return NextResponse.json(
          { error: 'Invalid input data', details: error.message },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to update scheduled message' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await scheduledMessageService.cancelScheduledMessage(params.id, session.user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error cancelling scheduled message:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: 'Scheduled message not found' }, { status: 404 })
      }
      if (error.message.includes('Permission denied')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    return NextResponse.json(
      { error: 'Failed to cancel scheduled message' },
      { status: 500 }
    )
  }
}