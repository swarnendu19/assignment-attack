'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ConversationThread, MessageSearchQuery } from '@/types/messages'
import { useWebSocket } from '@/contexts/WebSocketContext'
import { useEffect } from 'react'

interface ConversationsResponse {
  conversations: ConversationThread[]
  total: number
  hasMore: boolean
}

export function useConversations(searchQuery?: MessageSearchQuery) {
  const queryClient = useQueryClient()
  const { onMessage } = useWebSocket()

  const query = useQuery({
    queryKey: ['conversations', searchQuery],
    queryFn: async (): Promise<ConversationsResponse> => {
      const params = new URLSearchParams()
      
      if (searchQuery?.query) params.append('query', searchQuery.query)
      if (searchQuery?.channel) params.append('channel', searchQuery.channel)
      if (searchQuery?.isRead !== undefined) params.append('isRead', searchQuery.isRead.toString())
      if (searchQuery?.dateFrom) params.append('dateFrom', searchQuery.dateFrom.toISOString())
      if (searchQuery?.dateTo) params.append('dateTo', searchQuery.dateTo.toISOString())
      if (searchQuery?.limit) params.append('limit', searchQuery.limit.toString())
      if (searchQuery?.offset) params.append('offset', searchQuery.offset.toString())

      const response = await fetch(`/api/conversations?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch conversations')
      }
      
      return response.json()
    },
    staleTime: 30 * 1000, // 30 seconds
  })

  // Listen for real-time updates
  useEffect(() => {
    const unsubscribe = onMessage((message) => {
      if (message.type === 'message') {
        // Invalidate conversations to refresh the list
        queryClient.invalidateQueries({ queryKey: ['conversations'] })
      }
    })

    return unsubscribe
  }, [onMessage, queryClient])

  return query
}

export function useConversation(conversationId: string) {
  const queryClient = useQueryClient()
  const { onMessage } = useWebSocket()

  const query = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: async (): Promise<ConversationThread> => {
      const response = await fetch(`/api/conversations/${conversationId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch conversation')
      }
      
      return response.json()
    },
    enabled: !!conversationId,
    staleTime: 10 * 1000, // 10 seconds
  })

  // Listen for real-time updates for this specific conversation
  useEffect(() => {
    const unsubscribe = onMessage((message) => {
      if (message.type === 'message' && message.data.conversationId === conversationId) {
        // Invalidate this specific conversation
        queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] })
      }
    })

    return unsubscribe
  }, [onMessage, queryClient, conversationId])

  return query
}

export function useMarkAsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ messageIds, conversationId }: { messageIds: string[]; conversationId?: string }) => {
      const response = await fetch('/api/messages/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messageIds }),
      })

      if (!response.ok) {
        throw new Error('Failed to mark messages as read')
      }

      return response.json()
    },
    onSuccess: (_, { conversationId }) => {
      // Invalidate conversations list
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      
      // Invalidate specific conversation if provided
      if (conversationId) {
        queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] })
      }
    },
  })
}

export function useSendMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (messageData: {
      to: string
      message: string
      channel: string
      mediaUrls?: string[]
      contactId?: string
      conversationId?: string
    }) => {
      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send message')
      }

      return response.json()
    },
    onSuccess: (data) => {
      // Invalidate conversations to show the new message
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      
      // Invalidate specific conversation if available
      if (data.conversationId) {
        queryClient.invalidateQueries({ queryKey: ['conversation', data.conversationId] })
      }
    },
  })
}