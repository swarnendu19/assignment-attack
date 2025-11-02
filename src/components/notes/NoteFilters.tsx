'use client'

import React, { useState, useEffect } from 'react'

interface NoteFiltersProps {
  filters: {
    isPrivate?: boolean
    content: string
  }
  onFiltersChange: (filters: { isPrivate?: boolean; content: string }) => void
  className?: string
}

export function NoteFilters({ filters, onFiltersChange, className = '' }: NoteFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.content)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      onFiltersChange({
        ...filters,
        content: searchInput,
      })
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput])

  const handlePrivacyFilter = (isPrivate?: boolean) => {
    onFiltersChange({
      ...filters,
      isPrivate,
    })
  }

  const clearFilters = () => {
    setSearchInput('')
    onFiltersChange({
      isPrivate: undefined,
      content: '',
    })
  }

  const hasActiveFilters = filters.isPrivate !== undefined || filters.content.length > 0

  return (
    <div className={`bg-gray-50 border border-gray-200 rounded-lg p-4 ${className}`}>
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search notes..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
        </div>

        {/* Privacy Filter */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-700 whitespace-nowrap">Show:</span>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => handlePrivacyFilter(undefined)}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                filters.isPrivate === undefined
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              All
            </button>
            <button
              onClick={() => handlePrivacyFilter(false)}
              className={`px-3 py-2 text-sm font-medium border-l border-gray-300 transition-colors ${
                filters.isPrivate === false
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Public
            </button>
            <button
              onClick={() => handlePrivacyFilter(true)}
              className={`px-3 py-2 text-sm font-medium border-l border-gray-300 transition-colors ${
                filters.isPrivate === true
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Private
            </button>
          </div>
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 whitespace-nowrap"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="mt-3 flex flex-wrap gap-2">
          {filters.content && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Search: "{filters.content}"
              <button
                onClick={() => {
                  setSearchInput('')
                  onFiltersChange({ ...filters, content: '' })
                }}
                className="ml-1 text-blue-600 hover:text-blue-800"
              >
                ×
              </button>
            </span>
          )}
          {filters.isPrivate !== undefined && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {filters.isPrivate ? 'Private only' : 'Public only'}
              <button
                onClick={() => handlePrivacyFilter(undefined)}
                className="ml-1 text-blue-600 hover:text-blue-800"
              >
                ×
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  )
}