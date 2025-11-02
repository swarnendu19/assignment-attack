'use client'

import React, { useState, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { useCollaboration } from '@/contexts/CollaborationContext'
import { EditHistory as EditHistoryType } from '@/services/collaborationService'

interface EditHistoryProps {
  resourceId: string
  resourceType: 'note' | 'contact'
  className?: string
}

export function EditHistory({ resourceId, resourceType, className = '' }: EditHistoryProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [history, setHistory] = useState<EditHistoryType[]>([])
  const { getEditHistory } = useCollaboration()

  useEffect(() => {
    if (isOpen) {
      const editHistory = getEditHistory(resourceId, resourceType)
      setHistory(editHistory)
    }
  }, [isOpen, resourceId, resourceType, getEditHistory])

  const getOperationDescription = (operation: EditHistoryType['operation']): string => {
    switch (operation.type) {
      case 'insert':
        const insertLength = operation.content?.length || 0
        return `Added ${insertLength} character${insertLength !== 1 ? 's' : ''}`
      case 'delete':
        const deleteLength = operation.length || 0
        return `Deleted ${deleteLength} character${deleteLength !== 1 ? 's' : ''}`
      case 'retain':
        return 'No changes'
      default:
        return 'Unknown operation'
    }
  }

  const getOperationIcon = (operation: EditHistoryType['operation']) => {
    switch (operation.type) {
      case 'insert':
        return (
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        )
      case 'delete':
        return (
          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
        )
      default:
        return (
          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
        )
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`text-sm text-gray-500 hover:text-gray-700 flex items-center space-x-1 ${className}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>View edit history</span>
      </button>
    )
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Edit History</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* History List */}
      <div className="max-h-96 overflow-y-auto">
        {history.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <p>No edit history available</p>
            <p className="text-sm mt-1">Start editing to see changes here</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {history.map((edit, index) => (
              <div key={edit.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start space-x-3">
                  {/* Operation Icon */}
                  <div className="flex-shrink-0 mt-1">
                    {getOperationIcon(edit.operation)}
                  </div>

                  {/* Edit Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900">
                          {edit.userName}
                        </span>
                        <span className="text-sm text-gray-500">
                          {getOperationDescription(edit.operation)}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {formatDistanceToNow(edit.timestamp, { addSuffix: true })}
                      </span>
                    </div>

                    {/* Operation Details */}
                    <div className="mt-1 text-xs text-gray-600">
                      {edit.operation.type === 'insert' && edit.operation.content && (
                        <div className="bg-green-50 border border-green-200 rounded px-2 py-1 inline-block">
                          <span className="text-green-800">+ "{edit.operation.content}"</span>
                        </div>
                      )}
                      {edit.operation.type === 'delete' && (
                        <div className="bg-red-50 border border-red-200 rounded px-2 py-1 inline-block">
                          <span className="text-red-800">- {edit.operation.length} characters</span>
                        </div>
                      )}
                      <span className="ml-2 text-gray-500">
                        at position {edit.operation.position}
                      </span>
                    </div>

                    {/* Content Preview */}
                    {(edit.previousContent || edit.newContent) && (
                      <div className="mt-2 text-xs">
                        {edit.previousContent && (
                          <div className="mb-1">
                            <span className="text-gray-500">Before: </span>
                            <span className="bg-red-50 text-red-800 px-1 rounded">
                              {edit.previousContent.length > 50 
                                ? edit.previousContent.substring(0, 50) + '...'
                                : edit.previousContent
                              }
                            </span>
                          </div>
                        )}
                        {edit.newContent && (
                          <div>
                            <span className="text-gray-500">After: </span>
                            <span className="bg-green-50 text-green-800 px-1 rounded">
                              {edit.newContent.length > 50 
                                ? edit.newContent.substring(0, 50) + '...'
                                : edit.newContent
                              }
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {history.length > 0 && (
        <div className="p-3 border-t border-gray-200 bg-gray-50 text-center">
          <span className="text-xs text-gray-500">
            Showing {history.length} recent edit{history.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  )
}