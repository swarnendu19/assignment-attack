'use client'

import React, { useState, useRef, useEffect } from 'react'
import { CreateNoteInput, UpdateNoteInput } from '@/types/database'

interface NoteEditorProps {
  initialContent?: string
  initialIsPrivate?: boolean
  onSave: (data: CreateNoteInput | UpdateNoteInput) => void
  onCancel: () => void
  isLoading?: boolean
  placeholder?: string
  className?: string
}

export function NoteEditor({
  initialContent = '',
  initialIsPrivate = false,
  onSave,
  onCancel,
  isLoading = false,
  placeholder = 'Write a note...',
  className = '',
}: NoteEditorProps) {
  const [content, setContent] = useState(initialContent)
  const [isPrivate, setIsPrivate] = useState(initialIsPrivate)
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [cursorPosition, setCursorPosition] = useState(0)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus()
      // Auto-resize textarea
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [content])

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

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    const cursorPos = e.target.selectionStart
    
    setContent(value)
    setCursorPosition(cursorPos)

    // Check for @ mentions
    const textBeforeCursor = value.substring(0, cursorPos)
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/)
    
    if (mentionMatch) {
      setMentionQuery(mentionMatch[1])
      setShowMentionSuggestions(true)
    } else {
      setShowMentionSuggestions(false)
      setMentionQuery('')
    }
  }

  const insertMention = (username: string) => {
    const textBeforeCursor = content.substring(0, cursorPosition)
    const textAfterCursor = content.substring(cursorPosition)
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/)
    
    if (mentionMatch) {
      const beforeMention = textBeforeCursor.substring(0, mentionMatch.index)
      const newContent = beforeMention + `@${username} ` + textAfterCursor
      setContent(newContent)
      setShowMentionSuggestions(false)
      setMentionQuery('')
      
      // Focus back to textarea
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPos = beforeMention.length + username.length + 2
          textareaRef.current.focus()
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
        }
      }, 0)
    }
  }

  // Mock team members for mention suggestions
  // In a real app, you'd fetch this from an API
  const teamMembers = [
    { id: '1', name: 'John Doe', username: 'john' },
    { id: '2', name: 'Jane Smith', username: 'jane' },
    { id: '3', name: 'Bob Johnson', username: 'bob' },
  ]

  const filteredMembers = teamMembers.filter(member =>
    member.username.toLowerCase().includes(mentionQuery.toLowerCase()) ||
    member.name.toLowerCase().includes(mentionQuery.toLowerCase())
  )

  return (
    <div className={`relative ${className}`}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Textarea */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full min-h-[100px] p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />

          {/* Mention Suggestions */}
          {showMentionSuggestions && filteredMembers.length > 0 && (
            <div className="absolute z-10 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg">
              <div className="py-1">
                {filteredMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => insertMention(member.username)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center space-x-2"
                  >
                    <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-gray-700">
                        {member.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{member.name}</div>
                      <div className="text-xs text-gray-500">@{member.username}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
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
          Use @ to mention team members. Press Cmd+Enter (Mac) or Ctrl+Enter (Windows) to save.
        </div>
      </form>
    </div>
  )
}