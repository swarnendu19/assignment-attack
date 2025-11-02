'use client'

import { ConversationThread } from '@/types/messages'
import { ChannelBadge } from './ChannelBadge'
import { formatDistanceToNow } from 'date-fns'

interface ConversationItemProps {
  conversation: ConversationThread
  isSelected: boolean
  onClick: () => void
}

export function ConversationItem({ conversation, isSelected, onClick }: ConversationItemProps) {
  const lastMessage = conversation.messages[conversation.messages.length - 1]
  const previewText = lastMessage?.content.text || 'No messages'
  const truncatedPreview = previewText.length > 60 ? previewText.substring(0, 60) + '...' : previewText

  return (
    <div
      onClick={onClick}
      className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
        isSelected ? 'bg-blue-50 border-r-2 border-blue-500' : ''
      }`}
    >
      <div className="flex items-start space-x-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-gray-700">
              {conversation.title ? conversation.title.charAt(0).toUpperCase() : '?'}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-medium text-gray-900 truncate">
              {conversation.title || 'Unknown Contact'}
            </h3>
            <div className="flex items-center space-x-2">
              <ChannelBadge channel={conversation.channel} size="sm" />
              {conversation.unreadCount > 0 && (
                <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
                  {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                </span>
              )}
            </div>
          </div>

          <p className="text-sm text-gray-600 truncate mb-1">
            {truncatedPreview}
          </p>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              {formatDistanceToNow(conversation.lastMessageAt, { addSuffix: true })}
            </span>
            <span>
              {conversation.messageCount} message{conversation.messageCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}