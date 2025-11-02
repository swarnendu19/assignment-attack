'use client'

import { UnifiedMessage } from '@/types/messages'
import { Direction } from '@prisma/client'
import { ChannelBadge } from './ChannelBadge'
import { MediaGallery } from './MediaGallery'
import { format, isToday, isYesterday } from 'date-fns'

interface MessageBubbleProps {
  message: UnifiedMessage
  isConsecutive?: boolean
}

export function MessageBubble({ message, isConsecutive = false }: MessageBubbleProps) {
  const isOutbound = message.direction === Direction.OUTBOUND
  const hasAttachments = message.content.attachments && message.content.attachments.length > 0

  const formatMessageTime = (timestamp: Date) => {
    if (isToday(timestamp)) {
      return format(timestamp, 'HH:mm')
    } else if (isYesterday(timestamp)) {
      return `Yesterday ${format(timestamp, 'HH:mm')}`
    } else {
      return format(timestamp, 'MMM d, HH:mm')
    }
  }

  const getStatusIcon = () => {
    switch (message.status) {
      case 'pending':
        return (
          <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'sent':
        return (
          <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )
      case 'delivered':
        return (
          <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )
      case 'read':
        return (
          <svg className="h-4 w-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
        )
      case 'failed':
        return (
          <svg className="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      default:
        return null
    }
  }

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} ${isConsecutive ? 'mt-1' : 'mt-4'}`}>
      <div className={`max-w-xs lg:max-w-md ${isOutbound ? 'order-2' : 'order-1'}`}>
        {/* Channel badge and timestamp for first message in group */}
        {!isConsecutive && (
          <div className={`flex items-center mb-1 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <ChannelBadge channel={message.channel} size="sm" />
              <span>{formatMessageTime(message.timestamp)}</span>
            </div>
          </div>
        )}

        {/* Message bubble */}
        <div
          className={`relative px-4 py-2 rounded-lg ${
            isOutbound
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-900'
          } ${
            isConsecutive
              ? isOutbound
                ? 'rounded-tr-sm'
                : 'rounded-tl-sm'
              : ''
          }`}
        >
          {/* Message content */}
          {message.content.text && (
            <p className="text-sm whitespace-pre-wrap break-words">
              {message.content.text}
            </p>
          )}

          {/* HTML content (for emails) */}
          {message.content.html && !message.content.text && (
            <div 
              className="text-sm prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: message.content.html }}
            />
          )}

          {/* Attachments */}
          {hasAttachments && (
            <div className="mt-2">
              <MediaGallery attachments={message.content.attachments!} />
            </div>
          )}

          {/* Email subject (if applicable) */}
          {message.content.metadata?.subject && (
            <div className="mt-1 pt-1 border-t border-opacity-20 border-current">
              <p className="text-xs opacity-75">
                Subject: {message.content.metadata.subject}
              </p>
            </div>
          )}
        </div>

        {/* Status and time for consecutive messages */}
        {isConsecutive && (
          <div className={`flex items-center mt-1 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
            <div className="flex items-center space-x-1">
              {isOutbound && getStatusIcon()}
              <span className="text-xs text-gray-500">
                {formatMessageTime(message.timestamp)}
              </span>
            </div>
          </div>
        )}

        {/* Status for non-consecutive outbound messages */}
        {!isConsecutive && isOutbound && (
          <div className="flex items-center justify-end mt-1">
            <div className="flex items-center space-x-1">
              {getStatusIcon()}
              <span className="text-xs text-gray-500 capitalize">
                {message.status}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}