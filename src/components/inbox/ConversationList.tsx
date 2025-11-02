'use client'

import { ConversationThread } from '@/types/messages'
import { ConversationItem } from './ConversationItem'
import { VirtualScrollList } from '@/components/ui/VirtualScrollList'

interface ConversationListProps {
  conversations: ConversationThread[]
  selectedConversationId: string | null
  onConversationSelect: (conversationId: string) => void
  isLoading: boolean
}

export function ConversationList({
  conversations,
  selectedConversationId,
  onConversationSelect,
  isLoading,
}: ConversationListProps) {
  if (isLoading) {
    return (
      <div className="p-4">
        {/* Loading skeleton */}
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="mb-4 animate-pulse">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-gray-400 mb-2">
            <svg className="h-12 w-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-gray-900 mb-1">No conversations found</h3>
          <p className="text-xs text-gray-500">Try adjusting your search filters</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full">
      {conversations.length > 50 ? (
        // Use virtual scrolling for large lists
        <VirtualScrollList
          items={conversations}
          itemHeight={80} // Approximate height of ConversationItem
          containerHeight={window.innerHeight - 200} // Adjust based on header height
          renderItem={(conversation, index, style) => (
            <div style={style}>
              <ConversationItem
                conversation={conversation}
                isSelected={conversation.id === selectedConversationId}
                onClick={() => onConversationSelect(conversation.id)}
              />
            </div>
          )}
          className="divide-y divide-gray-100"
        />
      ) : (
        // Use regular scrolling for smaller lists
        <div className="overflow-y-auto h-full">
          <div className="divide-y divide-gray-100">
            {conversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isSelected={conversation.id === selectedConversationId}
                onClick={() => onConversationSelect(conversation.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}