/**
 * Optimized React Query configuration with advanced caching strategies
 */

import { QueryClient, QueryKey, QueryFunction } from '@tanstack/react-query'

// Cache key factories for consistent cache management
export const queryKeys = {
  conversations: {
    all: ['conversations'] as const,
    lists: () => [...queryKeys.conversations.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.conversations.lists(), filters] as const,
    details: () => [...queryKeys.conversations.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.conversations.details(), id] as const,
    messages: (id: string) => [...queryKeys.conversations.detail(id), 'messages'] as const,
  },
  contacts: {
    all: ['contacts'] as const,
    lists: () => [...queryKeys.contacts.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.contacts.lists(), filters] as const,
    details: () => [...queryKeys.contacts.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.contacts.details(), id] as const,
  },
  analytics: {
    all: ['analytics'] as const,
    dashboard: (filters: Record<string, any>) => [...queryKeys.analytics.all, 'dashboard', filters] as const,
    metrics: (type: string, filters: Record<string, any>) => [...queryKeys.analytics.all, type, filters] as const,
  },
  user: {
    all: ['user'] as const,
    profile: () => [...queryKeys.user.all, 'profile'] as const,
    preferences: () => [...queryKeys.user.all, 'preferences'] as const,
  },
}

// Optimized query client configuration
export function createOptimizedQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Caching strategy
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
        
        // Network behavior
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        refetchOnMount: true,
        
        // Retry configuration
        retry: (failureCount, error: any) => {
          // Don't retry on 4xx errors except 408, 429
          if (error?.status >= 400 && error?.status < 500 && ![408, 429].includes(error.status)) {
            return false
          }
          // Retry up to 3 times for other errors
          return failureCount < 3
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        
        // Performance optimizations
        structuralSharing: true, // Enable structural sharing for better performance
        
        // Error handling
        throwOnError: false,
      },
      mutations: {
        // Retry configuration for mutations
        retry: (failureCount, error: any) => {
          // Don't retry mutations on client errors
          if (error?.status >= 400 && error?.status < 500) {
            return false
          }
          return failureCount < 2
        },
        
        // Global error handling
        onError: (error: any, variables, context) => {
          console.error('Mutation error:', error)
          // You could send to error reporting service here
        },
        
        // Global success handling
        onSuccess: (data, variables, context) => {
          // Global success handling if needed
        },
      },
    },
  })
}

// Cache invalidation utilities
export class CacheManager {
  constructor(private queryClient: QueryClient) {}

  // Invalidate conversation-related queries
  invalidateConversations(conversationId?: string) {
    if (conversationId) {
      this.queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.detail(conversationId)
      })
    } else {
      this.queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.all
      })
    }
  }

  // Invalidate contact-related queries
  invalidateContacts(contactId?: string) {
    if (contactId) {
      this.queryClient.invalidateQueries({
        queryKey: queryKeys.contacts.detail(contactId)
      })
    } else {
      this.queryClient.invalidateQueries({
        queryKey: queryKeys.contacts.all
      })
    }
  }

  // Optimistic updates for messages
  updateMessageOptimistically(conversationId: string, newMessage: any) {
    const queryKey = queryKeys.conversations.messages(conversationId)
    
    this.queryClient.setQueryData(queryKey, (oldData: any) => {
      if (!oldData) return oldData
      
      return {
        ...oldData,
        messages: [...(oldData.messages || []), newMessage],
      }
    })
  }

  // Update conversation list optimistically
  updateConversationOptimistically(conversationId: string, updates: any) {
    // Update all conversation list queries
    this.queryClient.setQueriesData(
      { queryKey: queryKeys.conversations.lists() },
      (oldData: any) => {
        if (!oldData?.conversations) return oldData
        
        return {
          ...oldData,
          conversations: oldData.conversations.map((conv: any) =>
            conv.id === conversationId ? { ...conv, ...updates } : conv
          ),
        }
      }
    )
  }

  // Prefetch related data
  prefetchConversationMessages(conversationId: string) {
    this.queryClient.prefetchQuery({
      queryKey: queryKeys.conversations.messages(conversationId),
      queryFn: () => fetch(`/api/conversations/${conversationId}/messages`).then(res => res.json()),
      staleTime: 2 * 60 * 1000, // 2 minutes
    })
  }

  // Remove specific data from cache
  removeFromCache(queryKey: QueryKey) {
    this.queryClient.removeQueries({ queryKey })
  }

  // Clear all cache
  clearAllCache() {
    this.queryClient.clear()
  }

  // Get cache statistics
  getCacheStats() {
    const cache = this.queryClient.getQueryCache()
    const queries = cache.getAll()
    
    return {
      totalQueries: queries.length,
      staleQueries: queries.filter(q => q.isStale()).length,
      fetchingQueries: queries.filter(q => q.isFetching()).length,
      errorQueries: queries.filter(q => q.state.status === 'error').length,
      cacheSize: this.estimateCacheSize(queries),
    }
  }

  private estimateCacheSize(queries: any[]) {
    // Rough estimation of cache size
    let size = 0
    queries.forEach(query => {
      if (query.state.data) {
        size += JSON.stringify(query.state.data).length
      }
    })
    return size
  }
}

// Background sync utilities
export class BackgroundSync {
  constructor(private queryClient: QueryClient, private cacheManager: CacheManager) {}

  // Sync critical data in background
  startBackgroundSync() {
    // Sync conversations every 30 seconds
    setInterval(() => {
      this.syncConversations()
    }, 30000)

    // Sync unread counts every 10 seconds
    setInterval(() => {
      this.syncUnreadCounts()
    }, 10000)
  }

  private async syncConversations() {
    try {
      // Only sync if user is active and online
      if (document.hidden || !navigator.onLine) return

      // Invalidate and refetch conversation lists
      await this.queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.lists(),
        refetchType: 'active', // Only refetch active queries
      })
    } catch (error) {
      console.error('Background sync error:', error)
    }
  }

  private async syncUnreadCounts() {
    try {
      if (document.hidden || !navigator.onLine) return

      // Fetch and update unread counts
      const response = await fetch('/api/conversations/unread-counts')
      const unreadCounts = await response.json()

      // Update cache with new unread counts
      this.queryClient.setQueryData(['unread-counts'], unreadCounts)
    } catch (error) {
      console.error('Unread count sync error:', error)
    }
  }
}

// Query deduplication and batching
export class QueryOptimizer {
  private batchedQueries = new Map<string, any[]>()
  private batchTimeout: NodeJS.Timeout | null = null

  constructor(private queryClient: QueryClient) {}

  // Batch similar queries together
  batchQuery(queryKey: QueryKey, queryFn: QueryFunction) {
    const keyString = JSON.stringify(queryKey)
    
    if (!this.batchedQueries.has(keyString)) {
      this.batchedQueries.set(keyString, [])
    }
    
    this.batchedQueries.get(keyString)!.push({ queryKey, queryFn })
    
    // Process batch after short delay
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout)
    }
    
    this.batchTimeout = setTimeout(() => {
      this.processBatch()
    }, 10) // 10ms batching window
  }

  private async processBatch() {
    const batches = Array.from(this.batchedQueries.entries())
    this.batchedQueries.clear()
    
    // Process each batch
    for (const [keyString, queries] of batches) {
      if (queries.length === 1) {
        // Single query, execute normally
        const { queryKey, queryFn } = queries[0]
        this.queryClient.fetchQuery({ queryKey, queryFn })
      } else {
        // Multiple similar queries, batch them
        await this.executeBatchedQueries(queries)
      }
    }
  }

  private async executeBatchedQueries(queries: any[]) {
    try {
      // Extract IDs or parameters from queries
      const ids = queries.map(q => this.extractIdFromQueryKey(q.queryKey))
      
      // Make batched API call
      const response = await fetch('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, type: 'conversations' }),
      })
      
      const batchedData = await response.json()
      
      // Update cache for each query
      queries.forEach((query, index) => {
        this.queryClient.setQueryData(query.queryKey, batchedData[index])
      })
    } catch (error) {
      console.error('Batch query error:', error)
      
      // Fallback to individual queries
      queries.forEach(({ queryKey, queryFn }) => {
        this.queryClient.fetchQuery({ queryKey, queryFn })
      })
    }
  }

  private extractIdFromQueryKey(queryKey: QueryKey): string {
    // Extract ID from query key (implementation depends on key structure)
    const key = queryKey as string[]
    return key[key.length - 1] as string
  }
}