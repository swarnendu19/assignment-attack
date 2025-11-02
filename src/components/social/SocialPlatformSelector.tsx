'use client'

import React, { useState, useEffect } from 'react'
import { Twitter, Facebook, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { SocialPlatform } from '@/types/social'

interface PlatformInfo {
  platform: SocialPlatform
  configured: boolean
  available: boolean
  rateLimits?: {
    sendMessage: {
      remaining: number
      resetTime?: string
    }
    getUserInfo: {
      remaining: number
      resetTime?: string
    }
  }
}

interface SocialPlatformSelectorProps {
  selectedPlatform?: SocialPlatform
  onPlatformSelect: (platform: SocialPlatform) => void
  disabled?: boolean
  className?: string
}

const platformConfigs = {
  twitter: {
    name: 'Twitter',
    icon: Twitter,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    selectedColor: 'bg-blue-100 border-blue-500',
  },
  facebook: {
    name: 'Facebook Messenger',
    icon: Facebook,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    selectedColor: 'bg-blue-100 border-blue-500',
  },
}

export default function SocialPlatformSelector({
  selectedPlatform,
  onPlatformSelect,
  disabled = false,
  className = '',
}: SocialPlatformSelectorProps) {
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPlatforms()
  }, [])

  const fetchPlatforms = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/messages/social')
      if (!response.ok) {
        throw new Error('Failed to fetch platform information')
      }

      const data = await response.json()
      setPlatforms(data.platforms || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load platforms')
    } finally {
      setLoading(false)
    }
  }

  const formatRateLimit = (rateLimit: { remaining: number; resetTime?: string }) => {
    if (rateLimit.remaining === -1) return 'Unknown'
    if (rateLimit.remaining === 0 && rateLimit.resetTime) {
      const resetDate = new Date(rateLimit.resetTime)
      const now = new Date()
      const minutesUntilReset = Math.ceil((resetDate.getTime() - now.getTime()) / (1000 * 60))
      return `Rate limited (resets in ${minutesUntilReset}m)`
    }
    return `${rateLimit.remaining} remaining`
  }

  const getRateLimitStatus = (platform: PlatformInfo) => {
    if (!platform.rateLimits) return 'unknown'
    
    const sendLimit = platform.rateLimits.sendMessage
    if (sendLimit.remaining === 0 && sendLimit.resetTime && new Date(sendLimit.resetTime) > new Date()) {
      return 'limited'
    }
    if (sendLimit.remaining < 10) return 'low'
    return 'good'
  }

  if (loading) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="flex items-center gap-2 text-gray-500">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          Loading platforms...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
        <button
          onClick={fetchPlatforms}
          className="mt-2 text-sm text-blue-600 hover:text-blue-800"
        >
          Try again
        </button>
      </div>
    )
  }

  if (platforms.length === 0) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="text-center text-gray-500">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <p>No social media platforms configured</p>
          <p className="text-sm mt-1">Contact your administrator to set up integrations</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <h3 className="text-sm font-medium text-gray-700">Select Platform</h3>
      
      <div className="grid gap-3">
        {platforms.map((platform) => {
          const config = platformConfigs[platform.platform]
          const Icon = config.icon
          const isSelected = selectedPlatform === platform.platform
          const rateLimitStatus = getRateLimitStatus(platform)
          const canSelect = platform.available && !disabled && rateLimitStatus !== 'limited'

          return (
            <button
              key={platform.platform}
              onClick={() => canSelect && onPlatformSelect(platform.platform)}
              disabled={!canSelect}
              className={`p-4 border-2 rounded-lg text-left transition-all ${
                isSelected
                  ? config.selectedColor
                  : canSelect
                  ? `${config.bgColor} ${config.borderColor} hover:border-gray-300`
                  : 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Icon className={`w-6 h-6 ${config.color}`} />
                  <div>
                    <h4 className="font-medium text-gray-900">{config.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      {platform.configured ? (
                        <div className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-green-500" />
                          <span className="text-xs text-green-600">Configured</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-red-500" />
                          <span className="text-xs text-red-600">Not configured</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Rate Limit Status */}
                {platform.rateLimits && (
                  <div className="text-right">
                    <div className={`flex items-center gap-1 text-xs ${
                      rateLimitStatus === 'good' ? 'text-green-600' :
                      rateLimitStatus === 'low' ? 'text-yellow-600' :
                      rateLimitStatus === 'limited' ? 'text-red-600' :
                      'text-gray-500'
                    }`}>
                      {rateLimitStatus === 'limited' ? (
                        <Clock className="w-3 h-3" />
                      ) : (
                        <CheckCircle className="w-3 h-3" />
                      )}
                      {formatRateLimit(platform.rateLimits.sendMessage)}
                    </div>
                  </div>
                )}
              </div>

              {/* Additional Info */}
              {platform.rateLimits && rateLimitStatus === 'limited' && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  Rate limit exceeded. Please wait before sending more messages.
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Refresh Button */}
      <button
        onClick={fetchPlatforms}
        disabled={loading}
        className="w-full py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
      >
        {loading ? 'Refreshing...' : 'Refresh Status'}
      </button>
    </div>
  )
}