'use client'

import React, { useState, useEffect } from 'react'
import { 
  Twitter, 
  Facebook, 
  Settings, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  ExternalLink,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react'
import { SocialPlatform } from '@/types/social'

interface PlatformStatus {
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

interface ConfigData {
  platforms: PlatformStatus[]
  totalConfigured: number
  lastUpdated: string
}

const platformConfigs = {
  twitter: {
    name: 'Twitter',
    icon: Twitter,
    color: 'text-blue-500',
    description: 'Send and receive direct messages via Twitter API v2',
    docsUrl: 'https://developer.twitter.com/en/docs/twitter-api',
    webhookPath: '/api/webhooks/twitter',
    requiredEnvVars: [
      'TWITTER_API_KEY',
      'TWITTER_API_SECRET', 
      'TWITTER_ACCESS_TOKEN',
      'TWITTER_ACCESS_TOKEN_SECRET',
      'TWITTER_BEARER_TOKEN'
    ],
  },
  facebook: {
    name: 'Facebook Messenger',
    icon: Facebook,
    color: 'text-blue-600',
    description: 'Send and receive messages via Facebook Messenger Platform',
    docsUrl: 'https://developers.facebook.com/docs/messenger-platform',
    webhookPath: '/api/webhooks/facebook',
    requiredEnvVars: [
      'FACEBOOK_APP_ID',
      'FACEBOOK_APP_SECRET',
      'FACEBOOK_ACCESS_TOKEN',
      'FACEBOOK_PAGE_ID',
      'FACEBOOK_VERIFY_TOKEN'
    ],
  },
}

export default function SocialMediaConfig() {
  const [config, setConfig] = useState<ConfigData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [testingPlatform, setTestingPlatform] = useState<SocialPlatform | null>(null)
  const [showWebhookUrls, setShowWebhookUrls] = useState<Record<SocialPlatform, boolean>>({
    twitter: false,
    facebook: false,
  })

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/social/config')
      if (!response.ok) {
        throw new Error('Failed to fetch configuration')
      }

      const data = await response.json()
      setConfig(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration')
    } finally {
      setLoading(false)
    }
  }

  const testConnection = async (platform: SocialPlatform) => {
    try {
      setTestingPlatform(platform)

      const response = await fetch('/api/social/config/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ platform }),
      })

      const result = await response.json()

      if (response.ok) {
        alert(`${platformConfigs[platform].name} connection test passed!`)
        fetchConfig() // Refresh the config
      } else {
        alert(`Connection test failed: ${result.error}`)
      }
    } catch (err) {
      alert(`Connection test failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setTestingPlatform(null)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    // You could add a toast notification here
  }

  const getWebhookUrl = (platform: SocialPlatform) => {
    const baseUrl = window.location.origin
    return `${baseUrl}${platformConfigs[platform].webhookPath}`
  }

  const toggleWebhookUrl = (platform: SocialPlatform) => {
    setShowWebhookUrls(prev => ({
      ...prev,
      [platform]: !prev[platform]
    }))
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          Loading configuration...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-red-600 mb-4">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
        <button
          onClick={fetchConfig}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Social Media Integration</h1>
        <p className="text-gray-600">
          Configure and manage social media platform integrations for unified messaging.
        </p>
      </div>

      {/* Overview Stats */}
      {config && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Total Platforms</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {config.platforms.length}
            </p>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm font-medium text-gray-700">Configured</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {config.totalConfigured}
            </p>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-blue-500" />
              <span className="text-sm font-medium text-gray-700">Last Updated</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {new Date(config.lastUpdated).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Platform Configuration Cards */}
      <div className="space-y-6">
        {config?.platforms.map((platform) => {
          const platformConfig = platformConfigs[platform.platform]
          const Icon = platformConfig.icon
          const isShowingWebhook = showWebhookUrls[platform.platform]

          return (
            <div key={platform.platform} className="bg-white border border-gray-200 rounded-lg p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Icon className={`w-8 h-8 ${platformConfig.color}`} />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {platformConfig.name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {platformConfig.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {platform.configured ? (
                    <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                      <CheckCircle className="w-3 h-3" />
                      Configured
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">
                      <AlertCircle className="w-3 h-3" />
                      Not Configured
                    </div>
                  )}
                </div>
              </div>

              {/* Configuration Details */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Environment Variables */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Required Environment Variables</h4>
                  <div className="space-y-2">
                    {platformConfig.requiredEnvVars.map((envVar) => (
                      <div key={envVar} className="flex items-center gap-2 text-sm">
                        <code className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                          {envVar}
                        </code>
                        {platform.configured ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Webhook Configuration */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Webhook Configuration</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-600">Webhook URL:</label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type={isShowingWebhook ? 'text' : 'password'}
                          value={getWebhookUrl(platform.platform)}
                          readOnly
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm font-mono"
                        />
                        <button
                          onClick={() => toggleWebhookUrl(platform.platform)}
                          className="p-2 text-gray-500 hover:text-gray-700"
                        >
                          {isShowingWebhook ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => copyToClipboard(getWebhookUrl(platform.platform))}
                          className="p-2 text-gray-500 hover:text-gray-700"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rate Limits */}
              {platform.rateLimits && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-3">Current Rate Limits</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-600">Send Message:</span>
                      <span className="ml-2 text-sm font-medium">
                        {platform.rateLimits.sendMessage.remaining === -1 
                          ? 'Unknown' 
                          : `${platform.rateLimits.sendMessage.remaining} remaining`}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Get User Info:</span>
                      <span className="ml-2 text-sm font-medium">
                        {platform.rateLimits.getUserInfo.remaining === -1 
                          ? 'Unknown' 
                          : `${platform.rateLimits.getUserInfo.remaining} remaining`}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={() => testConnection(platform.platform)}
                  disabled={!platform.configured || testingPlatform === platform.platform}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium ${
                    platform.configured
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {testingPlatform === platform.platform ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Test Connection
                </button>

                <a
                  href={platformConfig.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  <ExternalLink className="w-4 h-4" />
                  Documentation
                </a>
              </div>
            </div>
          )
        })}
      </div>

      {/* Refresh Button */}
      <div className="mt-8 text-center">
        <button
          onClick={fetchConfig}
          disabled={loading}
          className="flex items-center gap-2 mx-auto px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Configuration
        </button>
      </div>
    </div>
  )
}