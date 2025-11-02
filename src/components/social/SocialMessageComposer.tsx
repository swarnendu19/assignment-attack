'use client'

import React, { useState, useEffect } from 'react'
import { Send, Image, AlertCircle, Twitter, Facebook } from 'lucide-react'
import { SocialPlatform } from '@/types/social'

interface SocialMessageComposerProps {
  platform: SocialPlatform
  recipientId: string
  recipientName?: string
  onSend: (message: {
    platform: SocialPlatform
    recipientId: string
    text: string
    mediaUrls?: string[]
  }) => Promise<void>
  disabled?: boolean
  className?: string
}

interface PlatformConfig {
  name: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  maxLength: number
  placeholder: string
  supportsMedia: boolean
}

const platformConfigs: Record<SocialPlatform, PlatformConfig> = {
  twitter: {
    name: 'Twitter',
    icon: Twitter,
    color: 'text-blue-500',
    maxLength: 280,
    placeholder: 'Send a direct message...',
    supportsMedia: true,
  },
  facebook: {
    name: 'Facebook',
    icon: Facebook,
    color: 'text-blue-600',
    maxLength: 2000,
    placeholder: 'Send a message...',
    supportsMedia: true,
  },
}

export default function SocialMessageComposer({
  platform,
  recipientId,
  recipientName,
  onSend,
  disabled = false,
  className = '',
}: SocialMessageComposerProps) {
  const [message, setMessage] = useState('')
  const [mediaUrls, setMediaUrls] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const config = platformConfigs[platform]
  const Icon = config.icon
  const remainingChars = config.maxLength - message.length
  const isOverLimit = remainingChars < 0
  const canSend = message.trim().length > 0 && !isOverLimit && !isLoading && !disabled

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!canSend) return

    setIsLoading(true)
    setError(null)

    try {
      await onSend({
        platform,
        recipientId,
        text: message.trim(),
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
      })

      // Clear the form on successful send
      setMessage('')
      setMediaUrls([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  const addMediaUrl = () => {
    const url = prompt('Enter media URL:')
    if (url && url.trim()) {
      setMediaUrls(prev => [...prev, url.trim()])
    }
  }

  const removeMediaUrl = (index: number) => {
    setMediaUrls(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <Icon className={`w-5 h-5 ${config.color}`} />
        <span className="font-medium text-gray-900">
          Send via {config.name}
        </span>
        {recipientName && (
          <span className="text-gray-500">
            to {recipientName}
          </span>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Message Form */}
      <form onSubmit={handleSubmit} className="p-4">
        {/* Text Input */}
        <div className="relative">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={config.placeholder}
            disabled={disabled || isLoading}
            className={`w-full p-3 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              isOverLimit ? 'border-red-300 focus:ring-red-500' : ''
            } ${disabled || isLoading ? 'bg-gray-50 cursor-not-allowed' : ''}`}
            rows={3}
          />
          
          {/* Character Counter */}
          <div className={`absolute bottom-2 right-2 text-xs ${
            isOverLimit ? 'text-red-500' : remainingChars < 20 ? 'text-yellow-600' : 'text-gray-400'
          }`}>
            {remainingChars}
          </div>
        </div>

        {/* Media Attachments */}
        {config.supportsMedia && mediaUrls.length > 0 && (
          <div className="mt-3 space-y-2">
            <label className="text-sm font-medium text-gray-700">Media Attachments:</label>
            {mediaUrls.map((url, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-md">
                <Image className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-700 truncate flex-1">{url}</span>
                <button
                  type="button"
                  onClick={() => removeMediaUrl(index)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            {config.supportsMedia && (
              <button
                type="button"
                onClick={addMediaUrl}
                disabled={disabled || isLoading}
                className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Image className="w-4 h-4" />
                Add Media
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              Ctrl+Enter to send
            </span>
            <button
              type="submit"
              disabled={!canSend}
              className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
                canSend
                  ? `bg-blue-600 hover:bg-blue-700 text-white`
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Send
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}