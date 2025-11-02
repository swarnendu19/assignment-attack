'use client'

import React, { useState } from 'react'
import { format } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Mail, 
  Reply, 
  ReplyAll, 
  Forward, 
  Download,
  ExternalLink,
  Paperclip,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { UnifiedMessage } from '@/types/messages'

interface EmailMessageProps {
  message: UnifiedMessage
  isExpanded?: boolean
  showActions?: boolean
  onReply?: (message: UnifiedMessage) => void
  onReplyAll?: (message: UnifiedMessage) => void
  onForward?: (message: UnifiedMessage) => void
  onToggleExpanded?: () => void
  onMarkAsRead?: (messageId: string) => void
}

export function EmailMessage({
  message,
  isExpanded = false,
  showActions = true,
  onReply,
  onReplyAll,
  onForward,
  onToggleExpanded,
  onMarkAsRead,
}: EmailMessageProps) {
  const [showRawHtml, setShowRawHtml] = useState(false)

  const subject = message.content.metadata?.subject || 'No Subject'
  const hasAttachments = message.content.attachments && message.content.attachments.length > 0
  const isInbound = message.direction === 'INBOUND'
  const isRead = message.isRead

  // Extract sender/recipient info from metadata
  const senderEmail = isInbound 
    ? message.metadata.emailFrom || 'Unknown Sender'
    : message.metadata.emailTo || 'Unknown Recipient'

  const handleMarkAsRead = () => {
    if (!isRead && onMarkAsRead) {
      onMarkAsRead(message.id)
    }
  }

  const handleDownloadAttachment = (attachment: any) => {
    // Create a download link for the attachment
    const link = document.createElement('a')
    link.href = attachment.url
    link.download = attachment.filename
    link.click()
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const renderEmailContent = () => {
    if (message.content.html && !showRawHtml) {
      return (
        <div 
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: message.content.html }}
        />
      )
    }

    return (
      <div className="whitespace-pre-wrap text-sm">
        {message.content.text || message.content.html || 'No content'}
      </div>
    )
  }

  return (
    <Card className={`w-full ${!isRead ? 'border-blue-200 bg-blue-50/30' : ''}`}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 flex-1">
            <div className={`p-2 rounded-full ${isInbound ? 'bg-green-100' : 'bg-blue-100'}`}>
              <Mail className={`h-4 w-4 ${isInbound ? 'text-green-600' : 'text-blue-600'}`} />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium text-sm truncate">{subject}</h3>
                {!isRead && (
                  <Badge variant="secondary" className="text-xs">
                    Unread
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  EMAIL
                </Badge>
              </div>
              
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="truncate">
                  {isInbound ? `From: ${senderEmail}` : `To: ${senderEmail}`}
                </span>
                <span>•</span>
                <span>{format(message.timestamp, 'MMM d, yyyy h:mm a')}</span>
                {hasAttachments && (
                  <>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <Paperclip className="h-3 w-3" />
                      <span>{message.content.attachments!.length}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {!isRead && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAsRead}
                title="Mark as read"
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            
            {onToggleExpanded && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleExpanded}
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Content (shown when expanded) */}
        {isExpanded && (
          <div className="space-y-4">
            {/* Email Content */}
            <div className="border-t pt-4">
              {message.content.html && (
                <div className="flex justify-end mb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowRawHtml(!showRawHtml)}
                  >
                    {showRawHtml ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    <span className="ml-1 text-xs">
                      {showRawHtml ? 'Show Formatted' : 'Show HTML'}
                    </span>
                  </Button>
                </div>
              )}
              
              <div className="bg-gray-50 rounded-md p-4">
                {renderEmailContent()}
              </div>
            </div>

            {/* Attachments */}
            {hasAttachments && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Attachments ({message.content.attachments!.length})
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {message.content.attachments!.map((attachment, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 border rounded-md bg-white"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {attachment.filename}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(attachment.size)} • {attachment.contentType}
                        </p>
                      </div>
                      
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadAttachment(attachment)}
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        
                        {attachment.url.startsWith('http') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(attachment.url, '_blank')}
                            title="Open in new tab"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            {showActions && (
              <div className="border-t pt-4 flex gap-2">
                {onReply && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onReply(message)}
                  >
                    <Reply className="h-4 w-4 mr-1" />
                    Reply
                  </Button>
                )}
                
                {onReplyAll && isInbound && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onReplyAll(message)}
                  >
                    <ReplyAll className="h-4 w-4 mr-1" />
                    Reply All
                  </Button>
                )}
                
                {onForward && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onForward(message)}
                  >
                    <Forward className="h-4 w-4 mr-1" />
                    Forward
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Preview when collapsed */}
        {!isExpanded && (
          <div className="text-sm text-gray-600 line-clamp-2">
            {message.content.text?.substring(0, 150) || 
             message.content.html?.replace(/<[^>]*>/g, '').substring(0, 150) || 
             'No preview available'}
            {(message.content.text || message.content.html || '').length > 150 && '...'}
          </div>
        )}
      </CardContent>
    </Card>
  )
}