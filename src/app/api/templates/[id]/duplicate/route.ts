import { NextRequest, NextResponse } from 'next/server'
import { messageTemplateService } from '@/services/messageTemplateService'
import { auth } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name } = body

    const duplicatedTemplate = await messageTemplateService.duplicateTemplate(
      params.id,
      session.user.id,
      name
    )

    return NextResponse.json(duplicatedTemplate, { status: 201 })
  } catch (error) {
    console.error('Error duplicating template:', error)
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json(
      { error: 'Failed to duplicate template' },
      { status: 500 }
    )
  }
}