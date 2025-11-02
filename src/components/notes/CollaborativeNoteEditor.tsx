'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useCollaboration } from '@/contexts/CollaborationContext'
import { CreateNoteInput, UpdateNoteInput } from '@/types/database'
import { EditOperation, CursorPosition } from '@/services/collaborationService'

interface CollaborativeNoteEditorProps {
  noteId?: string
  initialContent?: string
  initialIsPrivate?: boolean
  onSave: (data: CreateNoteInput | UpdateNoteInput) => void
  onCancel: () => void
  isLoading?: boolean
  placeholder?: string
  className?: string
}

export function CollaborativeNoteEditor({
  noteId,
  initialContent = '',
  initialIsPrivate = false,
  onSave,
  onCancel,
  isLoading = false,
  placeholder = 'Write a note...',
  className = '',
}: CollaborativeNoteEditorProps) {
  const [content, setContent] = useState(initialContent)
  const [isPrivate, setIsPrivate] = useState(initialIsPrivate)
  const [showPresence, setShowPresence] = useState(true)
  const [remoteCursors, setRemoteCursors] = useState<Map<string, { userName: string; cursor: CursorPosition }>>(new Map())

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lastContentRef = useRef(initialContent)
  const isComposingRef = useRef(false)

  const {
    trackPresence,
    removePresence,
    getPresence,
    broadcastEdit,
    onEdit,
    broadcastCursor,
    onCursorUpdate,
  } = useCollaboration()

  const resourceId = noteId || 'new-note'
  const resourceType = 'note' as const

  // Track presence when component mounts
  useEffect(() => {
    trackPresence(resourceId, resourceType, 'editing')
    
    return () => {
      removePresence(resourceId)
    }
  }, [resourceId, resourceType, trackPresence, removePresence])

  // Handle incoming collaborative edits
  useEffect(() => {
    const unsubscribe = onEdit((edit) => {
      if (edit.resourceId !== resourceId || edit.resourceType !== resourceType) return

      // Apply the edit to our content
      const newContent = applyEditOperation(content, edit.operation)
      setContent(newContent)
      lastContentRef.current = newContent
    })

    return unsubscribe
  }, [onEdit, resourceId, resourceType, content])

  // Handle incoming cursor updates
  useEffect(() => {
    const unsubscribe = onCursorUpdate((userId, userName, incomingResourceId, cursor) => {
      if (incomingResourceId !== resourceId) return

      setRemoteCursors(prev => {
        const newMap = new Map(prev)
        newMap.set(userId, { userName, cursor })
        return newMap
      })

      // Remove cursor after 3 seconds of inactivity
      setTimeout(() => {
        setRemoteCursors(prev => {
          const newMap = new Map(prev)
          newMap.delete(userId)
          return newMap
        })
      }, 3000)
    })

    return unsubscribe
  }, [onCursorUpdate, resourceId])

  // Apply edit operation to content
  const applyEditOperation = (currentContent: string, operation: EditOperation): string => {
    switch (operation.type) {
      case 'insert':
        return (
          currentContent.slice(0, operation.position) +
          (operation.content || '') +
          currentContent.slice(operation.position)
        )
      case 'delete':
        return (
          currentContent.slice(0, operation.position) +
          currentContent.slice(operation.position + (operation.length || 0))
        )
      case 'retain':
        return currentContent
      default:
        return currentContent
    }
  }

  // Generate edit operation from content change
  const generateEditOperation = (oldContent: string, newContent: string, cursorPosition: number): EditOperation | null => {
    if (oldContent === newContent) return null

    // Simple diff algorithm - in production you'd want a more sophisticated one
    let i = 0
    while (i < Math.min(oldContent.length, newContent.length) && oldContent[i] === newContent[i]) {
      i++
    }

    if (newContent.length > oldContent.length) {
      // Insertion
      const insertedText = newContent.slice(i, i + (newContent.length - oldContent.length))
      return {
        type: 'insert',
        position: i,
        content: insertedText,
      }
    } else if (newContent.length < oldContent.length) {
      // Deletion
      return {
        type: 'delete',
        position: i,
        length: oldContent.length - newContent.length,
      }
    } else {
      // Replacement (delete + insert)
      let j = oldContent.length - 1
      let k = newContent.length - 1
      while (j >= i && k >= i && oldContent[j] === newContent[k]) {
        j--
        k--
      }
      
      if (j >= i) {
        return {
          type: 'delete',
          position: i,
          length: j - i + 1,
        }
      }
    }

    return null
  }

  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isComposingRef.current) return

    const newContent = e.target.value
    const cursorPosition = e.target.selectionStart

    // Generate and broadcast edit operation
    const operation = generateEditOperation(lastContentRef.current, newContent, cursorPosition)
    if (operation) {
      broadcastEdit(resourceId, resourceType, operation, {
        start: cursorPosition,
        end: e.target.selectionEnd,
      })
    }

    setContent(newContent)
    lastContentRef.current = newContent

    // Update presence to editing
    trackPresence(resourceId, resourceType, 'editing', {
      start: cursorPosition,
      end: e.target.selectionEnd,
    })
  }, [resourceId, resourceType, broadcastEdit, trackPresence])

  const handleCursorChange = useCallback(() => {
    if (!textareaRef.current) return

    const cursor: CursorPosition = {
      start: textareaRef.current.selectionStart,
      end: textareaRef.current.selectionEnd,
    }

    broadcastCursor(resourceId, resourceType, cursor)
  }, [resourceId, resourceType, broadcastCursor])

  const handleCompositionStart = () => {
    isComposingRef.current = true
  }

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    isComposingRef.current = false
    handleContentChange(e as any)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (content.trim()) {
      onSave({
        content: content.trim(),
        isPrivate,
      })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit(e)
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [content])

  const presence = getPresence(resourceId, resourceType)
  const otherUsers = presence.filter(p => p.status === 'editing')

  return (
    <div className={`relative ${className}`}>
      {/* Presence Indicators */}
      {showPresence && otherUsers.length > 0 && (
        <div className="mb-3 flex items-center space-x-2">
          <div className="flex -space-x-2">
            {otherUsers.slice(0, 3).map((user) => (
              <div
                key={user.userId}
                className="w-6 h-6 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center"
                title={`${user.userName} is editing`}
              >
                <span className="text-xs font-medium text-white">
                  {user.userName.charAt(0).toUpperCase()}
                </span>
              </div>
            ))}
          </div>
          <span className="text-sm text-gray-600">
            {otherUsers.length === 1 
              ? `${otherUsers[0].userName} is editing`
              : `${otherUsers.length} people are editing`
            }
          </span>
          <button
            onClick={() => setShowPresence(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Textarea with cursor indicators */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            onSelect={handleCursorChange}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder={placeholder}
            className="w-full min-h-[100px] p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />

          {/* Remote cursor indicators */}
          {Array.from(remoteCursors.entries()).map(([userId, { userName, cursor }]) => (
            <div
              key={userId}
              className="absolute pointer-events-none"
              style={{
                // This is a simplified cursor positioning - in production you'd need more sophisticated positioning
                top: `${Math.floor(cursor.start / 50) * 20 + 12}px`,
                left: `${(cursor.start % 50) * 8 + 12}px`,
              }}
            >
              <div className="w-0.5 h-5 bg-red-500"></div>
              <div className="absolute -top-6 left-0 px-1 py-0.5 bg-red-500 text-white text-xs rounded whitespace-nowrap">
                {userName}
              </div>
            </div>
          ))}
        </div>

        {/* Options */}
        <div className="flex items-center justify-between">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              disabled={isLoading}
            />
            <span className="text-sm text-gray-700">Private note</span>
          </label>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!content.trim() || isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Saving...' : 'Save Note'}
            </button>
          </div>
        </div>

        {/* Help Text */}
        <div className="text-xs text-gray-500">
          Real-time collaborative editing enabled. Use @ to mention team members.
        </div>
      </form>
    </div>
  )
}