/**
 * Performance monitoring hook for tracking app performance metrics
 */

import { useEffect, useRef, useState, useCallback } from 'react'

interface PerformanceMetrics {
  renderTime: number
  memoryUsage: number
  networkLatency: number
  cacheHitRate: number
  errorRate: number
}

interface PerformanceConfig {
  enableMemoryTracking: boolean
  enableNetworkTracking: boolean
  enableRenderTracking: boolean
  sampleRate: number
  reportInterval: number
}

export function usePerformanceMonitor(config: Partial<PerformanceConfig> = {}) {
  const defaultConfig: PerformanceConfig = {
    enableMemoryTracking: true,
    enableNetworkTracking: true,
    enableRenderTracking: true,
    sampleRate: 0.1, // 10% sampling
    reportInterval: 30000, // 30 seconds
  }

  const finalConfig = { ...defaultConfig, ...config }
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    memoryUsage: 0,
    networkLatency: 0,
    cacheHitRate: 0,
    errorRate: 0,
  })

  const renderStartTime = useRef<number>(0)
  const networkRequests = useRef<Array<{ start: number; end?: number; success: boolean }>>([])
  const cacheStats = useRef({ hits: 0, misses: 0 })
  const errorCount = useRef(0)
  const totalRequests = useRef(0)

  // Track render performance
  const startRenderTracking = useCallback(() => {
    if (finalConfig.enableRenderTracking && Math.random() < finalConfig.sampleRate) {
      renderStartTime.current = performance.now()
    }
  }, [finalConfig.enableRenderTracking, finalConfig.sampleRate])

  const endRenderTracking = useCallback(() => {
    if (renderStartTime.current > 0) {
      const renderTime = performance.now() - renderStartTime.current
      setMetrics(prev => ({ ...prev, renderTime }))
      renderStartTime.current = 0
    }
  }, [])

  // Track network performance
  const trackNetworkRequest = useCallback((url: string, options?: RequestInit) => {
    if (!finalConfig.enableNetworkTracking) return

    const requestId = networkRequests.current.length
    const startTime = performance.now()
    
    networkRequests.current.push({
      start: startTime,
      success: false,
    })

    totalRequests.current++

    return {
      onSuccess: () => {
        const request = networkRequests.current[requestId]
        if (request) {
          request.end = performance.now()
          request.success = true
          
          const latency = request.end - request.start
          setMetrics(prev => ({ ...prev, networkLatency: latency }))
        }
      },
      onError: () => {
        const request = networkRequests.current[requestId]
        if (request) {
          request.end = performance.now()
          request.success = false
          errorCount.current++
        }
      },
    }
  }, [finalConfig.enableNetworkTracking])

  // Track cache performance
  const trackCacheHit = useCallback(() => {
    cacheStats.current.hits++
    updateCacheHitRate()
  }, [])

  const trackCacheMiss = useCallback(() => {
    cacheStats.current.misses++
    updateCacheHitRate()
  }, [])

  const updateCacheHitRate = () => {
    const { hits, misses } = cacheStats.current
    const total = hits + misses
    const hitRate = total > 0 ? (hits / total) * 100 : 0
    setMetrics(prev => ({ ...prev, cacheHitRate: hitRate }))
  }

  // Track memory usage
  const trackMemoryUsage = useCallback(() => {
    if (!finalConfig.enableMemoryTracking || !(performance as any).memory) return

    const memory = (performance as any).memory
    const memoryUsage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
    setMetrics(prev => ({ ...prev, memoryUsage }))
  }, [finalConfig.enableMemoryTracking])

  // Calculate error rate
  const updateErrorRate = useCallback(() => {
    const errorRate = totalRequests.current > 0 
      ? (errorCount.current / totalRequests.current) * 100 
      : 0
    setMetrics(prev => ({ ...prev, errorRate }))
  }, [])

  // Performance observer for navigation timing
  useEffect(() => {
    if (!finalConfig.enableNetworkTracking) return

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach((entry) => {
        if (entry.entryType === 'navigation') {
          const navEntry = entry as PerformanceNavigationTiming
          const loadTime = navEntry.loadEventEnd - navEntry.navigationStart
          setMetrics(prev => ({ ...prev, networkLatency: loadTime }))
        }
      })
    })

    observer.observe({ entryTypes: ['navigation'] })

    return () => observer.disconnect()
  }, [finalConfig.enableNetworkTracking])

  // Periodic metrics update
  useEffect(() => {
    const interval = setInterval(() => {
      trackMemoryUsage()
      updateErrorRate()
    }, finalConfig.reportInterval)

    return () => clearInterval(interval)
  }, [finalConfig.reportInterval, trackMemoryUsage, updateErrorRate])

  // Web Vitals tracking
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Track Largest Contentful Paint (LCP)
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const lastEntry = entries[entries.length - 1]
      console.log('LCP:', lastEntry.startTime)
    })

    try {
      observer.observe({ entryTypes: ['largest-contentful-paint'] })
    } catch (e) {
      // LCP not supported
    }

    return () => observer.disconnect()
  }, [])

  // Report performance issues
  const reportPerformanceIssue = useCallback((issue: {
    type: 'slow_render' | 'memory_leak' | 'network_error' | 'cache_miss'
    details: any
  }) => {
    console.warn('Performance Issue:', issue)
    
    // In a real app, you might send this to an analytics service
    if (process.env.NODE_ENV === 'production') {
      // Send to monitoring service
    }
  }, [])

  // Performance recommendations
  const getRecommendations = useCallback(() => {
    const recommendations: string[] = []

    if (metrics.renderTime > 16) { // 60fps threshold
      recommendations.push('Consider optimizing render performance - renders taking longer than 16ms')
    }

    if (metrics.memoryUsage > 80) {
      recommendations.push('High memory usage detected - consider implementing memory cleanup')
    }

    if (metrics.networkLatency > 1000) {
      recommendations.push('High network latency - consider implementing request caching or optimization')
    }

    if (metrics.cacheHitRate < 70) {
      recommendations.push('Low cache hit rate - review caching strategy')
    }

    if (metrics.errorRate > 5) {
      recommendations.push('High error rate detected - review error handling')
    }

    return recommendations
  }, [metrics])

  return {
    metrics,
    startRenderTracking,
    endRenderTracking,
    trackNetworkRequest,
    trackCacheHit,
    trackCacheMiss,
    reportPerformanceIssue,
    getRecommendations,
  }
}

// HOC for automatic render tracking
export function withPerformanceTracking<P extends object>(
  Component: React.ComponentType<P>
) {
  return function PerformanceTrackedComponent(props: P) {
    const { startRenderTracking, endRenderTracking } = usePerformanceMonitor()

    useEffect(() => {
      startRenderTracking()
      return () => {
        endRenderTracking()
      }
    })

    return <Component {...props} />
  }
}

// Hook for tracking specific operations
export function useOperationTracking(operationName: string) {
  const startTime = useRef<number>(0)

  const start = useCallback(() => {
    startTime.current = performance.now()
  }, [])

  const end = useCallback(() => {
    if (startTime.current > 0) {
      const duration = performance.now() - startTime.current
      console.log(`Operation "${operationName}" took ${duration.toFixed(2)}ms`)
      startTime.current = 0
      return duration
    }
    return 0
  }, [operationName])

  return { start, end }
}