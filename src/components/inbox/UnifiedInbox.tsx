'use client'

import { useState } from 'react'
import { ConversationList } from './ConversationList'
import { ConversationView } from './ConversationView'
import { InboxSearch } from './InboxSearch'
import { MessageSearchQuery } from '@/types/messages'
import { useConversations } from '@/hooks/useConversations'
import { useWebSocket } from '@/contexts/WebSocketContext'

export function UnifiedInbox() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState<MessageSearchQuery>({
    limit: 20,
    offset: 0,
  })

  const { data: conversationsData, isLoading, error } = useConversations(searchQuery)
  const { isConnected } = useWebSocket()

  const handleConversationSelect = (conversationId: string) => {
    setSelectedConversationId(conversationId)
  }

  const handleSearchChange = (newQuery: MessageSearchQuery) => {
    setSearchQuery(newQuery)
    setSelectedConversationId(null) // Clear selection when searching
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-500 mb-2">
            <svg className="h-12 w-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">Failed to load conversations</h3>
          <p className="text-gray-500">Please try refreshing the page</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full bg-white">
      {/* Left Sidebar - Conversation List */}
      <div className="w-1/3 border-r border-gray-200 flex flex-col">
        {/* Header with Search */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-gray-900">Inbox</h1>
            <div className="flex items-center space-x-2">
              {/* Connection Status */}
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-xs text-gray-500">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
          
          <InboxSearch onSearchChange={handleSearchChange} />
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-hidden">
          <ConversationList
            conversations={conversationsData?.conversations || []}
            selectedConversationId={selectedConversationId}
            onConversationSelect={handleConversationSelect}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Right Side - Conversation View */}
      <div className="flex-1 flex flex-col">
        {selectedConversationId ? (
          <ConversationView
            conversationId={selectedConversationId}
            onClose={() => setSelectedConversationId(null)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="text-gray-400 mb-4">
                <svg className="h-16 w-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a conversation</h3>
              <p className="text-gray-500">Choose a conversation from the list to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}