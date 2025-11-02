'use client'

import { useEffect, useRef } from 'react'
import { useConversation, useMarkAsRead } from '@/hooks/useConversations'
import { MessageBubble } from './MessageBubble'
import { RichMessageComposer } from './RichMessageComposer'
import { TypingIndicator } from './TypingIndicator'
import { ChannelBadge } from './ChannelBadge'
import { useWebSocket } from '@/contexts/WebSocketContext'
import { VirtualScrollList } from '@/components/ui/VirtualScrollList'
import { Direction } from '@prisma/client'

interface ConversationViewProps {
  conversationId: string
  onClose: () => void
}

export function ConversationView({ conversationId, onClose }: ConversationViewProps) {
  const { data: conversation, isLoading, error } = useConversation(conversationId)
  const markAsReadMutation = useMarkAsRead()
  const { typingUsers } = useWebSocket()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation?.messages])

  // Mark unread messages as read when conversation is opened
  useEffect(() => {
    if (conversation && conversation.unreadCount > 0) {
      const unreadMessageIds = conversation.messages
        .filter(msg => !msg.isRead && msg.direction === Direction.INBOUND)
        .map(msg => msg.id)

      if (unreadMessageIds.length > 0) {
        markAsReadMutation.mutate({
          messageIds: unreadMessageIds,
          conversationId: conversation.id,
        })
      }
    }
  }, [conversation, markAsReadMutation])

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !conversation) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-2">
            <svg className="h-12 w-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">Failed to load conversation</h3>
          <p className="text-gray-500">Please try selecting another conversation</p>
        </div>
      </div>
    )
  }

  const conversationTypingUsers = typingUsers.filter(
    typing => typing.conversationId === conversationId
  )

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="lg:hidden p-2 text-gray-400 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-gray-700">
                  {conversation.title ? conversation.title.charAt(0).toUpperCase() : '?'}
                </span>
              </div>
            </div>
            
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {conversation.title || 'Unknown Contact'}
              </h2>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <ChannelBadge channel={conversation.channel} size="sm" showLabel />
                <span>•</span>
                <span>{conversation.messageCount} messages</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Additional actions can be added here */}
            <button className="p-2 text-gray-400 hover:text-gray-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden px-6 py-4">
        {conversation.messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-gray-400 mb-2">
                <svg className="h-12 w-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No messages yet</h3>
              <p className="text-gray-500">Start the conversation by sending a message below</p>
            </div>
          </div>
        ) : (
          <div className="h-full relative">
            {conversation.messages.length > 100 ? (
              // Use virtual scrolling for large message lists
              <VirtualScrollList
                items={conversation.messages}
                itemHeight={(index, message) => {
                  // Estimate height based on message content
                  const baseHeight = 60
                  const contentLines = Math.ceil(message.content.length / 50)
                  const hasMedia = message.metadata && (message.metadata as any).attachments?.length > 0
                  return baseHeight + (contentLines * 20) + (hasMedia ? 200 : 0)
                }}
                containerHeight={window.innerHeight - 300} // Adjust based on header/footer
                renderItem={(message, index, style) => (
                  <div style={style} className="px-2">
                    <MessageBubble
                      message={message}
                      isConsecutive={
                        index > 0 &&
                        conversation.messages[index - 1].direction === message.direction &&
                        conversation.messages[index - 1].timestamp.getTime() - message.timestamp.getTime() < 5 * 60 * 1000
                      }
                    />
                  </div>
                )}
                scrollToIndex={conversation.messages.length - 1} // Auto-scroll to bottom
                scrollToAlignment="end"
              />
            ) : (
              // Use regular scrolling for smaller lists
              <div className="overflow-y-auto h-full space-y-4">
                {conversation.messages.map((message, index) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isConsecutive={
                      index > 0 &&
                      conversation.messages[index - 1].direction === message.direction &&
                      conversation.messages[index - 1].timestamp.getTime() - message.timestamp.getTime() < 5 * 60 * 1000
                    }
                  />
                ))}
                
                <div ref={messagesEndRef} />
              </div>
            )}
            
            {/* Typing Indicators - Always visible at bottom */}
            {conversationTypingUsers.length > 0 && (
              <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-2">
                {conversationTypingUsers.map((typing) => (
                  <TypingIndicator key={typing.userId} userName={typing.userName} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Message Composer */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white">
        <RichMessageComposer
          conversationId={conversationId}
          channel={conversation.channel}
          contactId={conversation.contactId}
        />
      </div>
    </div>
  )
}