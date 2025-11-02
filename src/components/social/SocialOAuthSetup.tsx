'use client'

import React, { useState } from 'react'
import { 
  Twitter, 
  Facebook, 
  ExternalLink, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react'
import { SocialPlatform } from '@/types/social'

interface SocialOAuthSetupProps {
  platform: SocialPlatform
  onComplete?: (tokens: any) => void
  className?: string
}

interface OAuthState {
  step: 'initial' | 'authorizing' | 'completed' | 'error'
  authUrl?: string
  tokens?: any
  user?: any
  pages?: any[]
  error?: string
}

const platformConfigs = {
  twitter: {
    name: 'Twitter',
    icon: Twitter,
    color: 'text-blue-500',
    description: 'Connect your Twitter account to send and receive direct messages',
    permissions: [
      'Read direct messages',
      'Send direct messages',
      'Access user profile information',
    ],
  },
  facebook: {
    name: 'Facebook Messenger',
    icon: Facebook,
    color: 'text-blue-600',
    description: 'Connect your Facebook page to send and receive messages via Messenger',
    permissions: [
      'Manage page messaging',
      'Read page conversations',
      'Send messages on behalf of page',
      'Access page information',
    ],
  },
}

export default function SocialOAuthSetup({
  platform,
  onComplete,
  className = '',
}: SocialOAuthSetupProps) {
  const [state, setState] = useState<OAuthState>({ step: 'initial' })
  const [selectedPageId, setSelectedPageId] = useState<string>('')
  const [showTokens, setShowTokens] = useState(false)

  const config = platformConfigs[platform]
  const Icon = config.icon

  const startOAuth = async () => {
    try {
      setState({ step: 'authorizing' })

      const response = await fetch(`/api/auth/social/${platform}?action=authorize`)
      if (!response.ok) {
        throw new Error('Failed to initiate OAuth')
      }

      const data = await response.json()
      
      if (data.authUrl) {
        setState({ 
          step: 'authorizing', 
          authUrl: data.authUrl 
        })
        
        // Open OAuth window
        const popup = window.open(
          data.authUrl,
          'oauth',
          'width=600,height=600,scrollbars=yes,resizable=yes'
        )

        // Poll for completion
        const pollTimer = setInterval(() => {
          try {
            if (popup?.closed) {
              clearInterval(pollTimer)
              // Check if OAuth was completed
              checkOAuthCompletion()
            }
          } catch (error) {
            // Cross-origin error is expected
          }
        }, 1000)
      } else {
        throw new Error('No authorization URL received')
      }
    } catch (error) {
      setState({ 
        step: 'error', 
        error: error instanceof Error ? error.message : 'OAuth initiation failed' 
      })
    }
  }

  const checkOAuthCompletion = async () => {
    try {
      // In a real implementation, you would check the server for completion
      // For now, we'll simulate a successful completion
      setTimeout(() => {
        setState({
          step: 'completed',
          user: {
            id: '123456789',
            name: 'Test User',
            username: platform === 'twitter' ? 'testuser' : undefined,
            profileImage: 'https://via.placeholder.com/40',
          },
          tokens: {
            accessToken: 'mock_access_token',
            accessSecret: platform === 'twitter' ? 'mock_access_secret' : undefined,
          },
          pages: platform === 'facebook' ? [
            {
              id: 'page123',
              name: 'Test Page',
              accessToken: 'page_access_token',
              category: 'Business',
            }
          ] : undefined,
        })
      }, 2000)
    } catch (error) {
      setState({ 
        step: 'error', 
        error: 'Failed to complete OAuth process' 
      })
    }
  }

  const completeSetup = () => {
    if (platform === 'facebook' && !selectedPageId && state.pages) {
      alert('Please select a Facebook page to continue')
      return
    }

    const setupData = {
      platform,
      user: state.user,
      tokens: state.tokens,
      selectedPage: platform === 'facebook' && state.pages 
        ? state.pages.find(p => p.id === selectedPageId)
        : undefined,
    }

    onComplete?.(setupData)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    // You could add a toast notification here
  }

  const resetSetup = () => {
    setState({ step: 'initial' })
    setSelectedPageId('')
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Icon className={`w-8 h-8 ${config.color}`} />
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{config.name} Setup</h3>
          <p className="text-sm text-gray-600">{config.description}</p>
        </div>
      </div>

      {/* Initial Step */}
      {state.step === 'initial' && (
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Required Permissions</h4>
            <ul className="space-y-1">
              {config.permissions.map((permission, index) => (
                <li key={index} className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  {permission}
                </li>
              ))}
            </ul>
          </div>

          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Before you continue:</p>
                <ul className="space-y-1 text-xs">
                  <li>• Make sure you have admin access to the {platform === 'facebook' ? 'Facebook page' : 'Twitter account'}</li>
                  <li>• Ensure your {platform === 'facebook' ? 'Facebook app' : 'Twitter app'} is properly configured</li>
                  <li>• Have your API credentials ready in the environment variables</li>
                </ul>
              </div>
            </div>
          </div>

          <button
            onClick={startOAuth}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium`}
          >
            <Icon className="w-5 h-5" />
            Connect {config.name}
          </button>
        </div>
      )}

      {/* Authorizing Step */}
      {state.step === 'authorizing' && (
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Authorizing...</h4>
            <p className="text-sm text-gray-600">
              Please complete the authorization in the popup window.
            </p>
          </div>
          {state.authUrl && (
            <a
              href={state.authUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
            >
              <ExternalLink className="w-4 h-4" />
              Open authorization page
            </a>
          )}
          <button
            onClick={resetSetup}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Completed Step */}
      {state.step === 'completed' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Authorization successful!</span>
          </div>

          {/* User Info */}
          {state.user && (
            <div className="p-4 bg-gray-50 rounded-md">
              <h4 className="font-medium text-gray-900 mb-2">Connected Account</h4>
              <div className="flex items-center gap-3">
                {state.user.profileImage && (
                  <img
                    src={state.user.profileImage}
                    alt={state.user.name}
                    className="w-10 h-10 rounded-full"
                  />
                )}
                <div>
                  <p className="font-medium text-gray-900">{state.user.name}</p>
                  {state.user.username && (
                    <p className="text-sm text-gray-600">@{state.user.username}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Facebook Page Selection */}
          {platform === 'facebook' && state.pages && state.pages.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Select Facebook Page</h4>
              <select
                value={selectedPageId}
                onChange={(e) => setSelectedPageId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Choose a page...</option>
                {state.pages.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.name} ({page.category})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tokens (for debugging) */}
          {state.tokens && process.env.NODE_ENV === 'development' && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-medium text-gray-900">Access Tokens</h4>
                <button
                  onClick={() => setShowTokens(!showTokens)}
                  className="p-1 text-gray-500 hover:text-gray-700"
                >
                  {showTokens ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {showTokens && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                      {state.tokens.accessToken}
                    </code>
                    <button
                      onClick={() => copyToClipboard(state.tokens.accessToken)}
                      className="p-1 text-gray-500 hover:text-gray-700"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  {state.tokens.accessSecret && (
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                        {state.tokens.accessSecret}
                      </code>
                      <button
                        onClick={() => copyToClipboard(state.tokens.accessSecret)}
                        className="p-1 text-gray-500 hover:text-gray-700"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={completeSetup}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
            >
              Complete Setup
            </button>
            <button
              onClick={resetSetup}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              Start Over
            </button>
          </div>
        </div>
      )}

      {/* Error Step */}
      {state.step === 'error' && (
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Setup Failed</h4>
            <p className="text-sm text-red-600">{state.error}</p>
          </div>
          <button
            onClick={resetSetup}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}