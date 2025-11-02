'use client'

import React, { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { useUpdateNote, useDeleteNote } from '@/hooks/useNotes'
import { NoteWithUser } from '@/services/noteService'
import { NoteEditor } from './NoteEditor'
import { UpdateNoteInput } from '@/types/database'
import { useAuth } from '@/contexts/AuthContext'

interface NoteCardProps {
  note: NoteWithUser
  contactId: string
  className?: string
}

export function NoteCard({ note, contactId, className = '' }: NoteCardProps) {
  const { user } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const updateNoteMutation = useUpdateNote()
  const deleteNoteMutation = useDeleteNote()

  const canEdit = user?.id === note.userId
  const canDelete = user?.id === note.userId

  const handleUpdate = async (data: UpdateNoteInput) => {
    try {
      await updateNoteMutation.mutateAsync({
        noteId: note.id,
        data,
      })
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to update note:', error)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteNoteMutation.mutateAsync(note.id)
      setShowDeleteConfirm(false)
    } catch (error) {
      console.error('Failed to delete note:', error)
    }
  }

  const renderMentions = (content: string) => {
    if (!note.mentions || note.mentions.length === 0) {
      return content
    }

    // Simple mention highlighting - in a real app you'd want more sophisticated parsing
    return content.replace(/@(\w+)/g, '<span class="text-blue-600 font-medium">@$1</span>')
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-gray-700">
              {note.user.name?.charAt(0) || note.user.email.charAt(0)}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">
              {note.user.name || note.user.email}
            </p>
            <p className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
              {note.updatedAt !== note.createdAt && (
                <span className="ml-1">(edited)</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Privacy Indicator */}
          {note.isPrivate && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              Private
            </span>
          )}

          {/* Actions */}
          <div className="flex items-center space-x-1">
            {canEdit && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
                title="Edit note"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-1 text-gray-400 hover:text-red-600 rounded"
                title="Delete note"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {isEditing ? (
        <NoteEditor
          initialContent={note.content}
          initialIsPrivate={note.isPrivate}
          onSave={handleUpdate}
          onCancel={() => setIsEditing(false)}
          isLoading={updateNoteMutation.isPending}
        />
      ) : (
        <div className="prose prose-sm max-w-none">
          <div
            dangerouslySetInnerHTML={{
              __html: renderMentions(note.content).replace(/\n/g, '<br>')
            }}
          />
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Delete Note</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete this note? This action cannot be undone.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={handleDelete}
                disabled={deleteNoteMutation.isPending}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteNoteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}