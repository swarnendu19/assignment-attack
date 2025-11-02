'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Mail, 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronUp,
  Reply,
  Archive,
  Trash2
} from 'lucide-react'
import { EmailMessage } from './EmailMessage'
import { UnifiedMessage } from '@/types/messages'
import { format } from 'date-fns'

interface EmailThreadProps {
  messages: UnifiedMessage[]
  subject?: string
  contactName?: string
  contactEmail?: string
  onReply?: (message: UnifiedMessage) => void
  onReplyAll?: (message: UnifiedMessage) => void
  onForward?: (message: UnifiedMessage) => void
  onArchive?: (threadId: string) => void
  onDelete?: (threadId: string) => void
  onMarkAsRead?: (messageId: string) => void
}

export function EmailThread({
  messages,
  subject,
  contactName,
  contactEmail,
  onReply,
  onReplyAll,
  onForward,
  onArchive,
  onDelete,
  onMarkAsRead,
}: EmailThreadProps) {
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [showAllMessages, setShowAllMessages] = useState(false)

  // Sort messages by timestamp
  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }, [messages])

  // Filter messages based on search query
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return sortedMessages

    const query = searchQuery.toLowerCase()
    return sortedMessages.filter(message => 
      message.content.text?.toLowerCase().includes(query) ||
      message.content.html?.toLowerCase().includes(query) ||
      message.content.metadata?.subject?.toLowerCase().includes(query)
    )
  }, [sortedMessages, searchQuery])

  // Show only recent messages by default, or all if requested
  const displayMessages = useMemo(() => {
    if (showAllMessages || filteredMessages.length <= 5) {
      return filteredMessages
    }
    return filteredMessages.slice(-5) // Show last 5 messages
  }, [filteredMessages, showAllMessages])

  const unreadCount = messages.filter(m => !m.isRead).length
  const threadId = messages[0]?.conversationId || 'unknown'
  const latestMessage = sortedMessages[sortedMessages.length - 1]
  const threadSubject = subject || latestMessage?.content.metadata?.subject || 'No Subject'

  const handleToggleExpanded = (messageId: string) => {
    const newExpanded = new Set(expandedMessages)
    if (newExpanded.has(messageId)) {
      newExpanded.delete(messageId)
    } else {
      newExpanded.add(messageId)
    }
    setExpandedMessages(newExpanded)
  }

  const handleExpandAll = () => {
    if (expandedMessages.size === displayMessages.length) {
      setExpandedMessages(new Set())
    } else {
      setExpandedMessages(new Set(displayMessages.map(m => m.id)))
    }
  }

  const handleReplyToLatest = () => {
    if (onReply && latestMessage) {
      onReply(latestMessage)
    }
  }

  return (
    <div className="space-y-4">
      {/* Thread Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2 mb-2">
                <Mail className="h-5 w-5 text-blue-600" />
                <span className="truncate">{threadSubject}</span>
                {unreadCount > 0 && (
                  <Badge variant="secondary">
                    {unreadCount} unread
                  </Badge>
                )}
              </CardTitle>
              
              <div className="flex items-center gap-4 text-sm text-gray-600">
                {contactName && (
                  <span className="font-medium">{contactName}</span>
                )}
                {contactEmail && (
                  <span>{contactEmail}</span>
                )}
                <span>{messages.length} messages</span>
                {latestMessage && (
                  <span>Last: {format(latestMessage.timestamp, 'MMM d, yyyy h:mm a')}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReplyToLatest}
                disabled={!onReply}
              >
                <Reply className="h-4 w-4 mr-1" />
                Reply
              </Button>
              
              {onArchive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onArchive(threadId)}
                >
                  <Archive className="h-4 w-4" />
                </Button>
              )}
              
              {onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(threadId)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Search and Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search in this thread..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleExpandAll}
            >
              {expandedMessages.size === displayMessages.length ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Collapse All
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Expand All
                </>
              )}
            </Button>

            {filteredMessages.length > 5 && !showAllMessages && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAllMessages(true)}
              >
                Show All ({filteredMessages.length})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Hidden Messages Indicator */}
      {!showAllMessages && filteredMessages.length > 5 && (
        <Card className="border-dashed">
          <CardContent className="p-4 text-center">
            <Button
              variant="ghost"
              onClick={() => setShowAllMessages(true)}
              className="text-gray-600"
            >
              <ChevronUp className="h-4 w-4 mr-2" />
              Show {filteredMessages.length - 5} earlier messages
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Messages */}
      <div className="space-y-3">
        {displayMessages.map((message, index) => (
          <EmailMessage
            key={message.id}
            message={message}
            isExpanded={expandedMessages.has(message.id)}
            showActions={true}
            onReply={onReply}
            onReplyAll={onReplyAll}
            onForward={onForward}
            onToggleExpanded={() => handleToggleExpanded(message.id)}
            onMarkAsRead={onMarkAsRead}
          />
        ))}
      </div>

      {/* No Messages */}
      {displayMessages.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery ? 'No matching messages' : 'No messages in this thread'}
            </h3>
            <p className="text-gray-600">
              {searchQuery 
                ? 'Try adjusting your search terms'
                : 'This email thread is empty'
              }
            </p>
          </CardContent>
        </Card>
      )}

      {/* Thread Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-center">
            <Button
              onClick={handleReplyToLatest}
              disabled={!onReply || !latestMessage}
              className="min-w-[120px]"
            >
              <Reply className="h-4 w-4 mr-2" />
              Reply to Thread
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}