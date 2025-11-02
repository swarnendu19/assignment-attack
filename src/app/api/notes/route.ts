import { NextRequest, NextResponse } from 'next/server'
import { noteService } from '@/services/noteService'
import { CreateNoteSchema } from '@/types/database'
import { auth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const contactId = searchParams.get('contactId')
    const content = searchParams.get('content')
    const isPrivate = searchParams.get('isPrivate')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (contactId) {
      // Get notes for a specific contact
      const result = await noteService.getContactNotes(contactId, session.user.id, {
        content: content || undefined,
        isPrivate: isPrivate ? isPrivate === 'true' : undefined,
        limit,
        offset,
      })
      return NextResponse.json(result)
    } else {
      // Search notes across all contacts
      const result = await noteService.searchNotes({
        content: content || undefined,
        isPrivate: isPrivate ? isPrivate === 'true' : undefined,
        limit,
        offset,
      }, session.user.id)
      return NextResponse.json(result)
    }
  } catch (error) {
    console.error('Error fetching notes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notes' },
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
    const validatedData = CreateNoteSchema.parse(body)

    if (!validatedData.contactId) {
      return NextResponse.json(
        { error: 'Contact ID is required' },
        { status: 400 }
      )
    }

    const note = await noteService.createNote({
      ...validatedData,
      userId: session.user.id,
    })

    return NextResponse.json(note, { status: 201 })
  } catch (error) {
    console.error('Error creating note:', error)
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to create note' },
      { status: 500 }
    )
  }
}