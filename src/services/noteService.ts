import { prisma } from '@/lib/prisma'
import { CreateNoteInput, UpdateNoteInput, Note } from '@/types/database'
import { ContactEventType } from '@prisma/client'

export interface NoteSearchQuery {
  contactId?: string
  userId?: string
  isPrivate?: boolean
  content?: string
  limit?: number
  offset?: number
}

export interface NoteMention {
  userId: string
  userName: string
  position: number
}

export interface NoteWithUser extends Note {
  user: {
    id: string
    name: string | null
    email: string
  }
  mentions?: NoteMention[]
}

export class NoteService {
  /**
   * Create a new note
   */
  async createNote(data: CreateNoteInput & { userId: string; contactId: string }): Promise<NoteWithUser> {
    const mentions = this.extractMentions(data.content)
    
    const note = await prisma.note.create({
      data: {
        content: data.content,
        isPrivate: data.isPrivate,
        mentions: mentions.length > 0 ? { mentions } : null,
        userId: data.userId,
        contactId: data.contactId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Create contact event
    await prisma.contactEvent.create({
      data: {
        eventType: ContactEventType.NOTE_ADDED,
        eventData: {
          noteId: note.id,
          content: note.content.substring(0, 100),
          isPrivate: note.isPrivate,
        },
        contactId: data.contactId,
        userId: data.userId,
      },
    })

    return {
      ...note,
      mentions: mentions,
    }
  }

  /**
   * Update an existing note
   */
  async updateNote(noteId: string, data: UpdateNoteInput, userId: string): Promise<NoteWithUser> {
    // Check if user has permission to update this note
    const existingNote = await prisma.note.findUnique({
      where: { id: noteId },
      include: { user: true },
    })

    if (!existingNote) {
      throw new Error('Note not found')
    }

    // Only the note creator can update private notes
    if (existingNote.isPrivate && existingNote.userId !== userId) {
      throw new Error('Permission denied: Cannot update private note')
    }

    const mentions = data.content ? this.extractMentions(data.content) : undefined

    const updatedNote = await prisma.note.update({
      where: { id: noteId },
      data: {
        ...(data.content && { content: data.content }),
        ...(data.isPrivate !== undefined && { isPrivate: data.isPrivate }),
        ...(mentions && { mentions: { mentions } }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return {
      ...updatedNote,
      mentions: mentions || [],
    }
  }

  /**
   * Delete a note
   */
  async deleteNote(noteId: string, userId: string): Promise<void> {
    // Check if user has permission to delete this note
    const existingNote = await prisma.note.findUnique({
      where: { id: noteId },
    })

    if (!existingNote) {
      throw new Error('Note not found')
    }

    // Only the note creator can delete private notes
    if (existingNote.isPrivate && existingNote.userId !== userId) {
      throw new Error('Permission denied: Cannot delete private note')
    }

    await prisma.note.delete({
      where: { id: noteId },
    })
  }

  /**
   * Get notes for a contact with filtering and pagination
   */
  async getContactNotes(
    contactId: string,
    userId: string,
    options: Omit<NoteSearchQuery, 'contactId'> = {}
  ): Promise<{ notes: NoteWithUser[]; total: number }> {
    const { limit = 50, offset = 0, isPrivate, content } = options

    const where: any = {
      contactId,
      OR: [
        { isPrivate: false },
        { isPrivate: true, userId },
      ],
    }

    if (isPrivate !== undefined) {
      where.isPrivate = isPrivate
    }

    if (content) {
      where.content = {
        contains: content,
        mode: 'insensitive',
      }
    }

    const [notes, total] = await Promise.all([
      prisma.note.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.note.count({ where }),
    ])

    return {
      notes: notes.map(note => ({
        ...note,
        mentions: note.mentions ? (note.mentions as any).mentions : [],
      })),
      total,
    }
  }

  /**
   * Search notes across all contacts (respecting privacy)
   */
  async searchNotes(
    query: NoteSearchQuery,
    userId: string
  ): Promise<{ notes: NoteWithUser[]; total: number }> {
    const { contactId, content, isPrivate, limit = 50, offset = 0 } = query

    const where: any = {
      OR: [
        { isPrivate: false },
        { isPrivate: true, userId },
      ],
    }

    if (contactId) {
      where.contactId = contactId
    }

    if (content) {
      where.content = {
        contains: content,
        mode: 'insensitive',
      }
    }

    if (isPrivate !== undefined) {
      where.isPrivate = isPrivate
    }

    const [notes, total] = await Promise.all([
      prisma.note.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          contact: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.note.count({ where }),
    ])

    return {
      notes: notes.map(note => ({
        ...note,
        mentions: note.mentions ? (note.mentions as any).mentions : [],
      })),
      total,
    }
  }

  /**
   * Get a single note by ID
   */
  async getNoteById(noteId: string, userId: string): Promise<NoteWithUser | null> {
    const note = await prisma.note.findUnique({
      where: { id: noteId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (!note) {
      return null
    }

    // Check privacy permissions
    if (note.isPrivate && note.userId !== userId) {
      throw new Error('Permission denied: Cannot access private note')
    }

    return {
      ...note,
      mentions: note.mentions ? (note.mentions as any).mentions : [],
    }
  }

  /**
   * Extract @mentions from note content
   */
  private extractMentions(content: string): NoteMention[] {
    const mentionRegex = /@(\w+)/g
    const mentions: NoteMention[] = []
    let match

    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push({
        userId: match[1], // In a real implementation, you'd resolve username to userId
        userName: match[1],
        position: match.index,
      })
    }

    return mentions
  }

  /**
   * Get notes that mention a specific user
   */
  async getNotesWithMentions(userId: string, limit = 50, offset = 0): Promise<{ notes: NoteWithUser[]; total: number }> {
    // This is a simplified implementation - in a real app you'd have a more sophisticated mention system
    const where = {
      mentions: {
        path: ['mentions'],
        array_contains: [{ userId }],
      },
      OR: [
        { isPrivate: false },
        { isPrivate: true, userId },
      ],
    }

    const [notes, total] = await Promise.all([
      prisma.note.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          contact: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.note.count({ where }),
    ])

    return {
      notes: notes.map(note => ({
        ...note,
        mentions: note.mentions ? (note.mentions as any).mentions : [],
      })),
      total,
    }
  }
}

export const noteService = new NoteService()