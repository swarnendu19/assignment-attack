'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState, useEffect } from 'react'
import { createOptimizedQueryClient, CacheManager, BackgroundSync } from '@/lib/query-client/optimized-config'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createOptimizedQueryClient())
  const [cacheManager] = useState(() => new CacheManager(queryClient))
  const [backgroundSync] = useState(() => new BackgroundSync(queryClient, cacheManager))

  // Start background sync when component mounts
  useEffect(() => {
    backgroundSync.startBackgroundSync()
  }, [backgroundSync])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      queryClient.clear()
    }
  }, [queryClient])

  // Performance monitoring
  useEffect(() => {
    const logCacheStats = () => {
      const stats = cacheManager.getCacheStats()
      console.log('Query Cache Stats:', stats)
      
      // Warn if cache is getting too large
      if (stats.cacheSize > 10 * 1024 * 1024) { // 10MB
        console.warn('Query cache size is large:', stats.cacheSize / 1024 / 1024, 'MB')
      }
    }

    // Log stats every 5 minutes in development
    if (process.env.NODE_ENV === 'development') {
      const interval = setInterval(logCacheStats, 5 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [cacheManager])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}