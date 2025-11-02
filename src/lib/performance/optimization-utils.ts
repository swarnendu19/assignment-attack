/**
 * Performance optimization utilities
 */

import { useCallback, useRef, useMemo } from 'react'

// Debounce utility for performance optimization
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>()

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args)
      }, delay)
    }) as T,
    [callback, delay]
  )
}

// Throttle utility for performance optimization
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastCallRef = useRef<number>(0)
  const timeoutRef = useRef<NodeJS.Timeout>()

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now()
      const timeSinceLastCall = now - lastCallRef.current

      if (timeSinceLastCall >= delay) {
        lastCallRef.current = now
        callback(...args)
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
        
        timeoutRef.current = setTimeout(() => {
          lastCallRef.current = Date.now()
          callback(...args)
        }, delay - timeSinceLastCall)
      }
    }) as T,
    [callback, delay]
  )
}

// Memoization with size limit
export function useMemoWithLimit<T>(
  factory: () => T,
  deps: React.DependencyList,
  limit: number = 100
): T {
  const cache = useRef<Map<string, T>>(new Map())
  
  return useMemo(() => {
    const key = JSON.stringify(deps)
    
    if (cache.current.has(key)) {
      return cache.current.get(key)!
    }
    
    const result = factory()
    
    // Limit cache size
    if (cache.current.size >= limit) {
      const firstKey = cache.current.keys().next().value
      cache.current.delete(firstKey)
    }
    
    cache.current.set(key, result)
    return result
  }, deps)
}

// Intersection Observer hook for lazy loading
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
) {
  const elementRef = useRef<HTMLElement>(null)
  const observerRef = useRef<IntersectionObserver>()
  const callbackRef = useRef<(isIntersecting: boolean) => void>()

  const observe = useCallback((callback: (isIntersecting: boolean) => void) => {
    callbackRef.current = callback

    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          callbackRef.current?.(entry.isIntersecting)
        })
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options,
      }
    )

    if (elementRef.current) {
      observerRef.current.observe(elementRef.current)
    }
  }, [options])

  const disconnect = useCallback(() => {
    observerRef.current?.disconnect()
  }, [])

  return { elementRef, observe, disconnect }
}

// Batch operations for better performance
export class BatchProcessor<T> {
  private batch: T[] = []
  private timeout: NodeJS.Timeout | null = null

  constructor(
    private processor: (items: T[]) => void | Promise<void>,
    private batchSize: number = 10,
    private delay: number = 100
  ) {}

  add(item: T) {
    this.batch.push(item)

    if (this.batch.length >= this.batchSize) {
      this.flush()
    } else {
      this.scheduleFlush()
    }
  }

  private scheduleFlush() {
    if (this.timeout) {
      clearTimeout(this.timeout)
    }

    this.timeout = setTimeout(() => {
      this.flush()
    }, this.delay)
  }

  private async flush() {
    if (this.batch.length === 0) return

    const items = [...this.batch]
    this.batch = []

    if (this.timeout) {
      clearTimeout(this.timeout)
      this.timeout = null
    }

    try {
      await this.processor(items)
    } catch (error) {
      console.error('Batch processing error:', error)
    }
  }

  forceFlush() {
    this.flush()
  }
}

// Memory management utilities
export class MemoryManager {
  private static instance: MemoryManager
  private cleanupTasks: (() => void)[] = []

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager()
    }
    return MemoryManager.instance
  }

  addCleanupTask(task: () => void) {
    this.cleanupTasks.push(task)
  }

  cleanup() {
    this.cleanupTasks.forEach(task => {
      try {
        task()
      } catch (error) {
        console.error('Cleanup task error:', error)
      }
    })
    this.cleanupTasks = []
  }

  getMemoryUsage() {
    if ((performance as any).memory) {
      const memory = (performance as any).memory
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
      }
    }
    return null
  }

  checkMemoryPressure() {
    const usage = this.getMemoryUsage()
    if (usage && usage.percentage > 80) {
      console.warn('High memory usage detected:', usage.percentage.toFixed(2) + '%')
      this.cleanup()
      
      // Force garbage collection if available (Chrome DevTools)
      if ((window as any).gc) {
        (window as any).gc()
      }
    }
  }
}

// Image optimization utilities
export function optimizeImageUrl(
  url: string,
  options: {
    width?: number
    height?: number
    quality?: number
    format?: 'webp' | 'jpeg' | 'png'
  } = {}
): string {
  // If using a CDN like Cloudinary, Imgix, etc.
  // This is a placeholder implementation
  const params = new URLSearchParams()
  
  if (options.width) params.set('w', options.width.toString())
  if (options.height) params.set('h', options.height.toString())
  if (options.quality) params.set('q', options.quality.toString())
  if (options.format) params.set('f', options.format)
  
  const separator = url.includes('?') ? '&' : '?'
  return params.toString() ? `${url}${separator}${params.toString()}` : url
}

// Network optimization utilities
export class NetworkOptimizer {
  private static requestCache = new Map<string, Promise<any>>()
  private static requestTimestamps = new Map<string, number>()

  static async fetchWithCache<T>(
    url: string,
    options: RequestInit = {},
    cacheTime: number = 5 * 60 * 1000 // 5 minutes
  ): Promise<T> {
    const cacheKey = `${url}_${JSON.stringify(options)}`
    const now = Date.now()
    
    // Check if we have a cached request
    const cachedTimestamp = this.requestTimestamps.get(cacheKey)
    if (cachedTimestamp && now - cachedTimestamp < cacheTime) {
      const cachedRequest = this.requestCache.get(cacheKey)
      if (cachedRequest) {
        return cachedRequest
      }
    }

    // Make new request
    const request = fetch(url, options).then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      return response.json()
    })

    // Cache the request
    this.requestCache.set(cacheKey, request)
    this.requestTimestamps.set(cacheKey, now)

    // Clean up old cache entries
    this.cleanupCache()

    return request
  }

  private static cleanupCache() {
    const now = Date.now()
    const maxAge = 10 * 60 * 1000 // 10 minutes

    for (const [key, timestamp] of this.requestTimestamps.entries()) {
      if (now - timestamp > maxAge) {
        this.requestCache.delete(key)
        this.requestTimestamps.delete(key)
      }
    }
  }

  static prefetchResource(url: string) {
    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.href = url
    document.head.appendChild(link)
  }

  static preloadResource(url: string, as: string = 'fetch') {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.href = url
    link.as = as
    document.head.appendChild(link)
  }
}

// Performance monitoring
export function measurePerformance<T>(
  name: string,
  fn: () => T | Promise<T>
): T | Promise<T> {
  const start = performance.now()
  
  const result = fn()
  
  if (result instanceof Promise) {
    return result.finally(() => {
      const end = performance.now()
      console.log(`${name} took ${(end - start).toFixed(2)}ms`)
    })
  } else {
    const end = performance.now()
    console.log(`${name} took ${(end - start).toFixed(2)}ms`)
    return result
  }
}

// Bundle size optimization
export function lazyImport<T>(
  importFn: () => Promise<{ default: T }>
): () => Promise<T> {
  let modulePromise: Promise<T> | null = null
  
  return () => {
    if (!modulePromise) {
      modulePromise = importFn().then(module => module.default)
    }
    return modulePromise
  }
}