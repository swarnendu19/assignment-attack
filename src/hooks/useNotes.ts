import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CreateNoteInput, UpdateNoteInput } from '@/types/database'
import { NoteWithUser, NoteSearchQuery } from '@/services/noteService'

interface NotesResponse {
  notes: NoteWithUser[]
  total: number
}

export function useNotes(query: NoteSearchQuery = {}) {
  return useQuery({
    queryKey: ['notes', query],
    queryFn: async (): Promise<NotesResponse> => {
      const params = new URLSearchParams()
      
      if (query.contactId) params.append('contactId', query.contactId)
      if (query.content) params.append('content', query.content)
      if (query.isPrivate !== undefined) params.append('isPrivate', query.isPrivate.toString())
      if (query.limit) params.append('limit', query.limit.toString())
      if (query.offset) params.append('offset', query.offset.toString())

      const response = await fetch(`/api/notes?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch notes')
      }
      return response.json()
    },
  })
}

export function useNote(noteId: string) {
  return useQuery({
    queryKey: ['notes', noteId],
    queryFn: async (): Promise<NoteWithUser> => {
      const response = await fetch(`/api/notes/${noteId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch note')
      }
      return response.json()
    },
    enabled: !!noteId,
  })
}

export function useCreateNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateNoteInput & { contactId: string }): Promise<NoteWithUser> => {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create note')
      }

      return response.json()
    },
    onSuccess: (newNote) => {
      // Invalidate and refetch notes queries
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      
      // Update contact timeline if applicable
      if (newNote.contactId) {
        queryClient.invalidateQueries({ queryKey: ['contacts', newNote.contactId, 'timeline'] })
      }
    },
  })
}

export function useUpdateNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ noteId, data }: { noteId: string; data: UpdateNoteInput }): Promise<NoteWithUser> => {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update note')
      }

      return response.json()
    },
    onSuccess: (updatedNote) => {
      // Update the specific note in cache
      queryClient.setQueryData(['notes', updatedNote.id], updatedNote)
      
      // Invalidate notes queries to refresh lists
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      
      // Update contact timeline if applicable
      if (updatedNote.contactId) {
        queryClient.invalidateQueries({ queryKey: ['contacts', updatedNote.contactId, 'timeline'] })
      }
    },
  })
}

export function useDeleteNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (noteId: string): Promise<void> => {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete note')
      }
    },
    onSuccess: (_, noteId) => {
      // Remove the note from cache
      queryClient.removeQueries({ queryKey: ['notes', noteId] })
      
      // Invalidate notes queries to refresh lists
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      
      // Invalidate contact timelines (we don't know which contact this note belonged to)
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
    },
  })
}

export function useContactNotes(contactId: string, options: Omit<NoteSearchQuery, 'contactId'> = {}) {
  return useNotes({ ...options, contactId })
}