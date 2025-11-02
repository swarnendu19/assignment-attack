'use client'

import React, { useState } from 'react'
import { useContactNotes, useCreateNote } from '@/hooks/useNotes'
import { NoteCard } from './NoteCard'
import { NoteEditor } from './NoteEditor'
import { NoteFilters } from './NoteFilters'
import { CreateNoteInput } from '@/types/database'

interface NotesSectionProps {
  contactId: string
  className?: string
}

export function NotesSection({ contactId, className = '' }: NotesSectionProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [filters, setFilters] = useState({
    isPrivate: undefined as boolean | undefined,
    content: '',
  })
  const [page, setPage] = useState(0)
  const limit = 20

  const { data, isLoading, error } = useContactNotes(contactId, {
    ...filters,
    limit,
    offset: page * limit,
  })

  const createNoteMutation = useCreateNote()

  const handleCreateNote = async (noteData: CreateNoteInput) => {
    try {
      await createNoteMutation.mutateAsync({
        ...noteData,
        contactId,
      })
      setIsCreating(false)
    } catch (error) {
      console.error('Failed to create note:', error)
    }
  }

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters)
    setPage(0) // Reset to first page when filters change
  }

  const handleLoadMore = () => {
    setPage(prev => prev + 1)
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <p className="text-red-700">Failed to load notes. Please try again.</p>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Notes</h3>
        <button
          onClick={() => setIsCreating(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Add Note
        </button>
      </div>

      {/* Filters */}
      <NoteFilters
        filters={filters}
        onFiltersChange={handleFilterChange}
      />

      {/* Create Note Form */}
      {isCreating && (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <NoteEditor
            onSave={handleCreateNote}
            onCancel={() => setIsCreating(false)}
            isLoading={createNoteMutation.isPending}
            placeholder="Add a note about this contact..."
          />
        </div>
      )}

      {/* Notes List */}
      <div className="space-y-3">
        {isLoading && page === 0 ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-gray-200 rounded-lg h-24"></div>
              </div>
            ))}
          </div>
        ) : data?.notes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No notes found.</p>
            {!isCreating && (
              <button
                onClick={() => setIsCreating(true)}
                className="mt-2 text-blue-600 hover:text-blue-700"
              >
                Add the first note
              </button>
            )}
          </div>
        ) : (
          <>
            {data?.notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                contactId={contactId}
              />
            ))}

            {/* Load More Button */}
            {data && data.notes.length < data.total && (
              <div className="text-center pt-4">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  className="px-4 py-2 text-blue-600 hover:text-blue-700 disabled:opacity-50"
                >
                  {isLoading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Results Summary */}
      {data && data.total > 0 && (
        <div className="text-sm text-gray-500 text-center">
          Showing {data.notes.length} of {data.total} notes
        </div>
      )}
    </div>
  )
}