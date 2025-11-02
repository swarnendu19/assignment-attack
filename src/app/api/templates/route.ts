import { NextRequest, NextResponse } from 'next/server'
import { messageTemplateService } from '@/services/messageTemplateService'
import { auth } from '@/lib/auth'
import { CreateMessageTemplateSchema } from '@/types/database'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')
    const channel = searchParams.get('channel')
    const category = searchParams.get('category')
    const isActive = searchParams.get('isActive')
    const userId = searchParams.get('userId')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const grouped = searchParams.get('grouped') === 'true'

    if (grouped) {
      // Return templates grouped by category
      const categorizedTemplates = await messageTemplateService.getTemplatesByCategory(
        session.user.teamId,
        channel as any
      )
      return NextResponse.json({ categories: categorizedTemplates })
    }

    const searchQuery: any = {}
    if (query) searchQuery.query = query
    if (channel) searchQuery.channel = channel
    if (category) searchQuery.category = category
    if (isActive !== null) searchQuery.isActive = isActive === 'true'
    if (userId) searchQuery.userId = userId
    searchQuery.limit = limit
    searchQuery.offset = offset

    const result = await messageTemplateService.searchTemplates(
      searchQuery,
      session.user.teamId
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
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
    const validatedInput = CreateMessageTemplateSchema.parse(body)

    const template = await messageTemplateService.createTemplate(
      validatedInput,
      session.user.id,
      session.user.teamId
    )

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    console.error('Error creating template:', error)
    
    if (error instanceof Error && error.message.includes('validation')) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    )
  }
}