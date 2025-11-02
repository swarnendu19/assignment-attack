import { NextRequest, NextResponse } from 'next/server'
import { messageService } from '@/services/messageService'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const MarkReadSchema = z.object({
  messageIds: z.array(z.string()),
})

export async function POST(request: NextRequest) {
  try {
    // Get current user
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { messageIds } = MarkReadSchema.parse(body)

    // Mark messages as read
    await messageService.markMessagesAsRead(messageIds, session.user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to mark messages as read:', error)
    return NextResponse.json(
      { error: 'Failed to mark messages as read' },
      { status: 500 }
    )
  }
}