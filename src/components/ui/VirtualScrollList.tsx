'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'

interface VirtualScrollListProps<T> {
  items: T[]
  itemHeight: number | ((index: number, item: T) => number)
  containerHeight: number
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode
  overscan?: number
  className?: string
  onScroll?: (scrollTop: number) => void
  scrollToIndex?: number
  scrollToAlignment?: 'start' | 'center' | 'end' | 'auto'
  loadMore?: () => void
  hasNextPage?: boolean
  isLoading?: boolean
}

interface ItemStyle {
  position: 'absolute'
  top: number
  left: number
  right: number
  height: number
}

export function VirtualScrollList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  className = '',
  onScroll,
  scrollToIndex,
  scrollToAlignment = 'auto',
  loadMore,
  hasNextPage = false,
  isLoading = false,
}: VirtualScrollListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollElementRef = useRef<HTMLDivElement>(null)

  // Calculate item heights and positions
  const itemMetadata = useMemo(() => {
    const metadata: Array<{ offset: number; size: number }> = []
    let offset = 0

    for (let i = 0; i < items.length; i++) {
      const size = typeof itemHeight === 'function' ? itemHeight(i, items[i]) : itemHeight
      metadata[i] = { offset, size }
      offset += size
    }

    return metadata
  }, [items, itemHeight])

  const totalHeight = itemMetadata.length > 0 
    ? itemMetadata[itemMetadata.length - 1].offset + itemMetadata[itemMetadata.length - 1].size 
    : 0

  // Binary search to find the start index
  const findStartIndex = useCallback((scrollTop: number) => {
    let low = 0
    let high = itemMetadata.length - 1

    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      const { offset, size } = itemMetadata[mid]

      if (offset <= scrollTop && offset + size > scrollTop) {
        return mid
      } else if (offset < scrollTop) {
        low = mid + 1
      } else {
        high = mid - 1
      }
    }

    return Math.max(0, Math.min(low, itemMetadata.length - 1))
  }, [itemMetadata])

  // Calculate visible range
  const visibleRange = useMemo(() => {
    if (itemMetadata.length === 0) {
      return { start: 0, end: 0 }
    }

    const startIndex = findStartIndex(scrollTop)
    let endIndex = startIndex

    // Find end index
    let currentOffset = itemMetadata[startIndex].offset
    while (endIndex < itemMetadata.length - 1 && currentOffset < scrollTop + containerHeight) {
      endIndex++
      currentOffset = itemMetadata[endIndex].offset + itemMetadata[endIndex].size
    }

    return {
      start: Math.max(0, startIndex - overscan),
      end: Math.min(itemMetadata.length - 1, endIndex + overscan),
    }
  }, [scrollTop, containerHeight, itemMetadata, overscan, findStartIndex])

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop
    setScrollTop(newScrollTop)
    onScroll?.(newScrollTop)

    // Load more when near bottom
    if (loadMore && hasNextPage && !isLoading) {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
      if (scrollTop + clientHeight >= scrollHeight - 200) { // 200px threshold
        loadMore()
      }
    }
  }, [onScroll, loadMore, hasNextPage, isLoading])

  // Scroll to specific index
  const scrollToItem = useCallback((index: number, alignment: string = 'auto') => {
    if (!containerRef.current || index < 0 || index >= itemMetadata.length) return

    const { offset, size } = itemMetadata[index]
    const scrollElement = containerRef.current

    let targetScrollTop = offset

    switch (alignment) {
      case 'start':
        targetScrollTop = offset
        break
      case 'center':
        targetScrollTop = offset - (containerHeight - size) / 2
        break
      case 'end':
        targetScrollTop = offset - containerHeight + size
        break
      case 'auto':
        const currentScrollTop = scrollElement.scrollTop
        if (offset < currentScrollTop) {
          targetScrollTop = offset
        } else if (offset + size > currentScrollTop + containerHeight) {
          targetScrollTop = offset - containerHeight + size
        } else {
          return // Already visible
        }
        break
    }

    scrollElement.scrollTop = Math.max(0, Math.min(targetScrollTop, totalHeight - containerHeight))
  }, [itemMetadata, containerHeight, totalHeight])

  // Handle scrollToIndex prop
  useEffect(() => {
    if (scrollToIndex !== undefined) {
      scrollToItem(scrollToIndex, scrollToAlignment)
    }
  }, [scrollToIndex, scrollToAlignment, scrollToItem])

  // Render visible items
  const visibleItems = useMemo(() => {
    const items_to_render = []

    for (let i = visibleRange.start; i <= visibleRange.end; i++) {
      if (i >= items.length) break

      const { offset, size } = itemMetadata[i]
      const style: ItemStyle = {
        position: 'absolute',
        top: offset,
        left: 0,
        right: 0,
        height: size,
      }

      items_to_render.push(
        <div key={i} style={style}>
          {renderItem(items[i], i, style)}
        </div>
      )
    }

    return items_to_render
  }, [visibleRange, items, itemMetadata, renderItem])

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div
        ref={scrollElementRef}
        style={{ height: totalHeight, position: 'relative' }}
      >
        {visibleItems}
        
        {/* Loading indicator */}
        {isLoading && (
          <div
            style={{
              position: 'absolute',
              top: totalHeight,
              left: 0,
              right: 0,
              height: 60,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>
    </div>
  )
}

// Hook for managing virtual scroll state
export function useVirtualScroll<T>(items: T[], itemHeight: number | ((index: number, item: T) => number)) {
  const [scrollToIndex, setScrollToIndex] = useState<number | undefined>()
  
  const scrollToItem = useCallback((index: number, alignment?: 'start' | 'center' | 'end' | 'auto') => {
    setScrollToIndex(index)
    // Clear after scroll
    setTimeout(() => setScrollToIndex(undefined), 100)
  }, [])

  const scrollToBottom = useCallback(() => {
    if (items.length > 0) {
      scrollToItem(items.length - 1, 'end')
    }
  }, [items.length, scrollToItem])

  const scrollToTop = useCallback(() => {
    scrollToItem(0, 'start')
  }, [scrollToItem])

  return {
    scrollToIndex,
    scrollToItem,
    scrollToBottom,
    scrollToTop,
  }
}