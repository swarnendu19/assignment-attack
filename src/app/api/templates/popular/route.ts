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
    const channel = searchParams.get('channel')
    const limit = parseInt(searchParams.get('limit') || '10')

    const popularTemplates = await messageTemplateService.getPopularTemplates(
      session.user.teamId,
      channel as any,
      limit
    )

    return NextResponse.json({ templates: popularTemplates })
  } catch (error) {
    console.error('Error fetching popular templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch popular templates' },
      { status: 500 }
    )
  }
}