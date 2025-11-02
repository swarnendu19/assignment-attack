'use client'

import React from 'react'
import { Twitter, Facebook, ExternalLink, Image as ImageIcon, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { UnifiedMessage } from '@/types/messages'
import { SocialPlatform } from '@/types/social'

interface SocialMessageBubbleProps {
  message: UnifiedMessage
  isOwn?: boolean
  showTimestamp?: boolean
  showStatus?: boolean
  className?: string
}

const platformConfigs = {
  twitter: {
    name: 'Twitter',
    icon: Twitter,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  facebook: {
    name: 'Facebook',
    icon: Facebook,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
}

export default function SocialMessageBubble({
  message,
  isOwn = false,
  showTimestamp = true,
  showStatus = true,
  className = '',
}: SocialMessageBubbleProps) {
  // Determine platform from channel
  const platform: SocialPlatform = message.channel === 'TWITTER' ? 'twitter' : 'facebook'
  const config = platformConfigs[platform]
  const Icon = config.icon

  // Extract social media metadata
  const socialMetadata = message.metadata as any
  const senderHandle = socialMetadata?.senderHandle
  const recipientHandle = socialMetadata?.recipientHandle
  const mediaAttachments = socialMetadata?.mediaAttachments || []

  // Format timestamp
  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(date))
  }

  const formatDate = (date: Date) => {
    const messageDate = new Date(date)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (messageDate.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    } else {
      return messageDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: messageDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
      })
    }
  }

  const getStatusIcon = () => {
    switch (message.status) {
      case 'pending':
        return <Clock className="w-3 h-3 text-gray-400" />
      case 'sent':
        return <CheckCircle className="w-3 h-3 text-gray-500" />
      case 'delivered':
        return <CheckCircle className="w-3 h-3 text-green-500" />
      case 'read':
        return <CheckCircle className="w-3 h-3 text-blue-500" />
      case 'failed':
        return <AlertCircle className="w-3 h-3 text-red-500" />
      default:
        return null
    }
  }

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${className}`}>
      <div className={`max-w-xs lg:max-w-md ${isOwn ? 'order-2' : 'order-1'}`}>
        {/* Platform Badge */}
        <div className={`flex items-center gap-1 mb-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
          <Icon className={`w-3 h-3 ${config.color}`} />
          <span className="text-xs text-gray-500">{config.name}</span>
          {senderHandle && !isOwn && (
            <span className="text-xs text-gray-400">@{senderHandle}</span>
          )}
          {recipientHandle && isOwn && (
            <span className="text-xs text-gray-400">to @{recipientHandle}</span>
          )}
        </div>

        {/* Message Bubble */}
        <div
          className={`px-4 py-2 rounded-lg ${
            isOwn
              ? 'bg-blue-600 text-white'
              : `${config.bgColor} ${config.borderColor} border text-gray-900`
          }`}
        >
          {/* Text Content */}
          {message.content.text && (
            <p className="text-sm whitespace-pre-wrap break-words">
              {message.content.text}
            </p>
          )}

          {/* Media Attachments */}
          {message.content.attachments && message.content.attachments.length > 0 && (
            <div className="mt-2 space-y-2">
              {message.content.attachments.map((attachment, index) => (
                <div key={attachment.id || index} className="relative">
                  {attachment.contentType.startsWith('image/') ? (
                    <div className="relative">
                      <img
                        src={attachment.url}
                        alt={attachment.filename}
                        className="max-w-full h-auto rounded-md"
                        loading="lazy"
                      />
                      {attachment.thumbnailUrl && (
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute top-2 right-2 p-1 bg-black bg-opacity-50 rounded-full text-white hover:bg-opacity-70"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className={`flex items-center gap-2 p-2 rounded-md ${
                      isOwn ? 'bg-blue-500' : 'bg-gray-100'
                    }`}>
                      <ImageIcon className="w-4 h-4" />
                      <span className="text-xs truncate flex-1">{attachment.filename}</span>
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs hover:underline"
                      >
                        View
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Social Media Entities (URLs, mentions, etc.) */}
          {socialMetadata?.entities?.urls && socialMetadata.entities.urls.length > 0 && (
            <div className="mt-2 space-y-1">
              {socialMetadata.entities.urls.map((url: any, index: number) => (
                <a
                  key={index}
                  href={url.expandedUrl || url.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-xs hover:underline flex items-center gap-1 ${
                    isOwn ? 'text-blue-200' : 'text-blue-600'
                  }`}
                >
                  <ExternalLink className="w-3 h-3" />
                  {url.displayUrl || url.url}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Timestamp and Status */}
        {(showTimestamp || showStatus) && (
          <div className={`flex items-center gap-2 mt-1 text-xs text-gray-500 ${
            isOwn ? 'justify-end' : 'justify-start'
          }`}>
            {showTimestamp && (
              <span>
                {formatDate(message.timestamp)} {formatTime(message.timestamp)}
              </span>
            )}
            {showStatus && isOwn && (
              <div className="flex items-center gap-1">
                {getStatusIcon()}
                <span className="capitalize">{message.status}</span>
              </div>
            )}
          </div>
        )}

        {/* External Message ID (for debugging) */}
        {message.externalId && process.env.NODE_ENV === 'development' && (
          <div className={`text-xs text-gray-400 mt-1 ${isOwn ? 'text-right' : 'text-left'}`}>
            ID: {message.externalId}
          </div>
        )}
      </div>
    </div>
  )
}