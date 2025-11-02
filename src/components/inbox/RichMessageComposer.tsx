'use client'

import { useState, useRef, useEffect } from 'react'
import { ChannelType } from '@prisma/client'
import { useSendMessage } from '@/hooks/useConversations'
import { useWebSocket } from '@/contexts/WebSocketContext'
import { MediaUploader } from './MediaUploader'
import ScheduleMessageModal from '../scheduling/ScheduleMessageModal'

interface RichMessageComposerProps {
  conversationId: string
  channel: ChannelType
  contactId: string | null
  contactName?: string
}

export function RichMessageComposer({ conversationId, channel, contactId, contactName }: RichMessageComposerProps) {
  const [message, setMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const [showMediaUploader, setShowMediaUploader] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()
  
  const sendMessageMutation = useSendMessage()
  const { sendTyping } = useWebSocket()

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [message])

  // Handle typing indicators
  const handleTypingStart = () => {
    if (!isTyping) {
      setIsTyping(true)
      sendTyping(conversationId, true)
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false)
      sendTyping(conversationId, false)
    }, 2000)
  }

  const handleTypingStop = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    if (isTyping) {
      setIsTyping(false)
      sendTyping(conversationId, false)
    }
  }

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
    if (e.target.value.trim()) {
      handleTypingStart()
    } else {
      handleTypingStop()
    }
  }

  const handleMediaFilesChange = (files: File[]) => {
    setMediaFiles(files)
  }

  const handleSend = async () => {
    if (!message.trim() && mediaFiles.length === 0) return

    handleTypingStop()

    try {
      // For now, we'll skip media upload and just send text
      // In a real implementation, you'd upload files to a storage service first
      const uploadedMediaUrls: string[] = []

      await sendMessageMutation.mutateAsync({
        to: 'placeholder', // This should be derived from conversation/contact
        message: message.trim(),
        channel: channel,
        mediaUrls: uploadedMediaUrls,
        contactId: contactId || undefined,
        conversationId,
      })

      // Clear form
      setMessage('')
      setMediaFiles([])
      setShowMediaUploader(false)
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  const handleScheduleMessage = async (scheduleData: any) => {
    try {
      const response = await fetch('/api/scheduled-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(scheduleData)
      })

      if (!response.ok) {
        throw new Error('Failed to schedule message')
      }

      // Clear form
      setMessage('')
      setMediaFiles([])
      setShowMediaUploader(false)
      
      // Show success message
      alert('Message scheduled successfully!')
    } catch (error) {
      console.error('Failed to schedule message:', error)
      throw error
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const canAttachMedia = channel === ChannelType.SMS || channel === ChannelType.WHATSAPP || channel === ChannelType.EMAIL

  return (
    <div className="p-4 space-y-4">
      {/* Media Uploader */}
      {showMediaUploader && canAttachMedia && (
        <div className="border-t border-gray-200 pt-4">
          <MediaUploader
            channel={channel}
            onFilesChange={handleMediaFilesChange}
            maxFiles={channel === ChannelType.EMAIL ? 10 : 5}
          />
        </div>
      )}

      {/* Composer */}
      <div className="flex items-end space-x-3">
        {/* Media Upload Button */}
        {canAttachMedia && (
          <button
            onClick={() => setShowMediaUploader(!showMediaUploader)}
            className={`flex-shrink-0 p-2 transition-colors ${
              showMediaUploader 
                ? 'text-blue-600 bg-blue-50' 
                : 'text-gray-400 hover:text-gray-600'
            }`}
            disabled={sendMessageMutation.isPending}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
        )}

        {/* Text Input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleMessageChange}
            onKeyPress={handleKeyPress}
            placeholder={`Type a message...`}
            rows={1}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none max-h-32"
            disabled={sendMessageMutation.isPending}
          />
          
          {/* Character count for SMS */}
          {channel === ChannelType.SMS && message.length > 0 && (
            <div className="absolute -bottom-5 right-0 text-xs text-gray-500">
              {message.length}/160
              {message.length > 160 && (
                <span className="text-orange-500 ml-1">
                  ({Math.ceil(message.length / 160)} SMS)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Schedule Button */}
        {contactId && (
          <button
            onClick={() => setShowScheduleModal(true)}
            disabled={(!message.trim() && mediaFiles.length === 0) || sendMessageMutation.isPending}
            className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
              (!message.trim() && mediaFiles.length === 0) || sendMessageMutation.isPending
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-orange-500 text-white hover:bg-orange-600'
            }`}
            title="Schedule message"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        )}

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={(!message.trim() && mediaFiles.length === 0) || sendMessageMutation.isPending}
          className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
            (!message.trim() && mediaFiles.length === 0) || sendMessageMutation.isPending
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          {sendMessageMutation.isPending ? (
            <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>

      {/* Error display */}
      {sendMessageMutation.error && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">
            {sendMessageMutation.error.message || 'Failed to send message'}
          </p>
        </div>
      )}

      {/* Schedule Message Modal */}
      {contactId && (
        <ScheduleMessageModal
          isOpen={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          onSchedule={handleScheduleMessage}
          contactId={contactId}
          contactName={contactName}
          defaultChannel={channel}
        />
      )}
    </div>
  )
}