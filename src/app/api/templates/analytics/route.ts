import { NextRequest, NextResponse } from 'next/server'
import { messageTemplateService } from '@/services/messageTemplateService'
import { auth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')

    const analytics = await messageTemplateService.getTemplateAnalytics(
      session.user.teamId,
      days
    )

    return NextResponse.json({ analytics })
  } catch (error) {
    console.error('Error fetching template analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch template analytics' },
      { status: 500 }
    )
  }
}