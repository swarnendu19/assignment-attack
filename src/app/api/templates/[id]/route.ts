import { NextRequest, NextResponse } from 'next/server'
import { messageTemplateService } from '@/services/messageTemplateService'
import { auth } from '@/lib/auth'
import { UpdateMessageTemplateSchema } from '@/types/database'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const template = await messageTemplateService.getTemplateById(params.id)
    
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Check if user has access to this template (same team)
    if (template.teamId !== session.user.teamId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(template)
  } catch (error) {
    console.error('Error fetching template:', error)
    return NextResponse.json(
      { error: 'Failed to fetch template' },
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
    const validatedInput = UpdateMessageTemplateSchema.parse(body)

    const updatedTemplate = await messageTemplateService.updateTemplate(
      params.id,
      validatedInput,
      session.user.id
    )

    return NextResponse.json(updatedTemplate)
  } catch (error) {
    console.error('Error updating template:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 })
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
      { error: 'Failed to update template' },
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

    await messageTemplateService.deleteTemplate(params.id, session.user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting template:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 })
      }
      if (error.message.includes('Permission denied')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    )
  }
}