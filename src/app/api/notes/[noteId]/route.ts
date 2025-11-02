import { NextRequest, NextResponse } from 'next/server'
import { noteService } from '@/services/noteService'
import { UpdateNoteSchema } from '@/types/database'
import { auth } from '@/lib/auth'

interface RouteParams {
  params: {
    noteId: string
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const note = await noteService.getNoteById(params.noteId, session.user.id)
    
    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    return NextResponse.json(note)
  } catch (error) {
    console.error('Error fetching note:', error)
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json(
      { error: 'Failed to fetch note' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = UpdateNoteSchema.parse(body)

    const note = await noteService.updateNote(params.noteId, validatedData, session.user.id)

    return NextResponse.json(note)
  } catch (error) {
    console.error('Error updating note:', error)
    if (error instanceof Error) {
      if (error.message.includes('Permission denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
    }
    return NextResponse.json(
      { error: 'Failed to update note' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await noteService.deleteNote(params.noteId, session.user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting note:', error)
    if (error instanceof Error) {
      if (error.message.includes('Permission denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
    }
    return NextResponse.json(
      { error: 'Failed to delete note' },
      { status: 500 }
    )
  }
}