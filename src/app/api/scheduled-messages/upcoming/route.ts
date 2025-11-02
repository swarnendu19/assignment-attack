import { NextRequest, NextResponse } from 'next/server'
import { scheduledMessageService } from '@/services/scheduledMessageService'
import { auth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7')
    const limit = parseInt(searchParams.get('limit') || '50')

    const upcomingMessages = await scheduledMessageService.getUpcomingMessages(
      session.user.id,
      days,
      limit
    )

    return NextResponse.json({ messages: upcomingMessages })
  } catch (error) {
    console.error('Error fetching upcoming messages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch upcoming messages' },
      { status: 500 }
    )
  }
}