'use client'

import { useState, useEffect } from 'react'
import { ChannelType, ScheduledMessageStatus } from '@prisma/client'
import { format } from 'date-fns'

interface ScheduledMessage {
  id: string
  channel: ChannelType
  content: Record<string, unknown>
  scheduledFor: Date
  recurrence?: any
  status: ScheduledMessageStatus
  createdAt: Date
  updatedAt: Date
  contactId: string
  userId: string
  contact?: {
    id: string
    name?: string
    email?: string
    phone?: string
  }
  user?: {
    id: string
    name?: string
    email: string
  }
}

interface ScheduledMessagesListProps {
  contactId?: string
  userId?: string
  status?: ScheduledMessageStatus
  onEdit?: (message: ScheduledMessage) => void
  onCancel?: (messageId: string) => void
}

export default function ScheduledMessagesList({
  contactId,
  userId,
  status,
  onEdit,
  onCancel
}: ScheduledMessagesListProps) {
  const [messages, setMessages] = useState<ScheduledMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [total, setTotal] = useState(0)

  const pageSize = 20

  useEffect(() => {
    loadMessages()
  }, [contactId, userId, status, currentPage])

  const loadMessages = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: (currentPage * pageSize).toString()
      })

      if (contactId) params.append('contactId', contactId)
      if (userId) params.append('userId', userId)
      if (status) params.append('status', status)

      const response = await fetch(`/api/scheduled-messages?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to load scheduled messages')
      }

      const data = await response.json()
      
      if (currentPage === 0) {
        setMessages(data.messages || [])
      } else {
        setMessages(prev => [...prev, ...(data.messages || [])])
      }
      
      setHasMore(data.hasMore || false)
      setTotal(data.total || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async (messageId: string) => {
    if (!confirm('Are you sure you want to cancel this scheduled message?')) {
      return
    }

    try {
      const response = await fetch(`/api/scheduled-messages/${messageId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to cancel message')
      }

      // Remove from local state
      setMessages(prev => prev.filter(msg => msg.id !== messageId))
      
      if (onCancel) {
        onCancel(messageId)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to cancel message')
    }
  }

  const getStatusBadge = (status: ScheduledMessageStatus) => {
    const baseClasses = "px-2 py-1 text-xs font-medium rounded-full"
    
    switch (status) {
      case ScheduledMessageStatus.PENDING:
        return `${baseClasses} bg-yellow-100 text-yellow-800`
      case ScheduledMessageStatus.SENT:
        return `${baseClasses} bg-green-100 text-green-800`
      case ScheduledMessageStatus.FAILED:
        return `${baseClasses} bg-red-100 text-red-800`
      case ScheduledMessageStatus.CANCELLED:
        return `${baseClasses} bg-gray-100 text-gray-800`
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`
    }
  }

  const getChannelBadge = (channel: ChannelType) => {
    const baseClasses = "px-2 py-1 text-xs font-medium rounded"
    
    switch (channel) {
      case ChannelType.SMS:
        return `${baseClasses} bg-blue-100 text-blue-800`
      case ChannelType.WHATSAPP:
        return `${baseClasses} bg-green-100 text-green-800`
      case ChannelType.EMAIL:
        return `${baseClasses} bg-purple-100 text-purple-800`
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`
    }
  }

  const formatRecurrence = (recurrence: any) => {
    if (!recurrence) return null
    
    const { type, interval } = recurrence
    const intervalText = interval === 1 ? '' : `every ${interval} `
    
    switch (type) {
      case 'daily':
        return `Repeats ${intervalText}day${interval > 1 ? 's' : ''}`
      case 'weekly':
        return `Repeats ${intervalText}week${interval > 1 ? 's' : ''}`
      case 'monthly':
        return `Repeats ${intervalText}month${interval > 1 ? 's' : ''}`
      case 'yearly':
        return `Repeats ${intervalText}year${interval > 1 ? 's' : ''}`
      default:
        return 'Recurring'
    }
  }

  if (loading && currentPage === 0) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={() => {
            setCurrentPage(0)
            loadMessages()
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No scheduled messages found</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">
          Scheduled Messages ({total})
        </h3>
      </div>

      <div className="space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center space-x-2">
                <span className={getChannelBadge(message.channel)}>
                  {message.channel}
                </span>
                <span className={getStatusBadge(message.status)}>
                  {message.status}
                </span>
                {message.recurrence && (
                  <span className="px-2 py-1 text-xs font-medium rounded bg-orange-100 text-orange-800">
                    Recurring
                  </span>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                {message.status === ScheduledMessageStatus.PENDING && onEdit && (
                  <button
                    onClick={() => onEdit(message)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Edit
                  </button>
                )}
                {message.status === ScheduledMessageStatus.PENDING && (
                  <button
                    onClick={() => handleCancel(message.id)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            <div className="mb-3">
              <p className="text-gray-900 text-sm">
                {typeof message.content === 'object' && message.content.text
                  ? String(message.content.text)
                  : 'No content'}
              </p>
            </div>

            <div className="flex justify-between items-center text-sm text-gray-500">
              <div>
                <p>
                  To: {message.contact?.name || message.contact?.phone || message.contact?.email || 'Unknown'}
                </p>
                {message.recurrence && (
                  <p className="text-xs text-orange-600">
                    {formatRecurrence(message.recurrence)}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p>
                  Scheduled: {format(new Date(message.scheduledFor), 'MMM d, yyyy h:mm a')}
                </p>
                <p className="text-xs">
                  Created: {format(new Date(message.createdAt), 'MMM d, yyyy')}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="text-center">
          <button
            onClick={() => setCurrentPage(prev => prev + 1)}
            disabled={loading}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  )
}