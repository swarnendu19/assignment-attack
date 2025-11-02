'use client'

import { useState } from 'react'
import { ChannelType } from '@prisma/client'
import TwilioTrialWarning, { useTwilioTrialCheck } from '@/components/twilio/TwilioTrialWarning'

interface MessageComposerProps {
  recipientPhone?: string
  recipientEmail?: string
  contactId?: string
  onMessageSent?: (message: any) => void
  defaultChannel?: ChannelType
}

interface SendMessageResponse {
  success: boolean
  messageId?: string
  externalId?: string
  status?: string
  message?: any
  error?: string
  details?: any
}

export default function MessageComposer({
  recipientPhone,
  recipientEmail,
  contactId,
  onMessageSent,
  defaultChannel = ChannelType.SMS,
}: MessageComposerProps) {
  const [message, setMessage] = useState('')
  const [selectedChannel, setSelectedChannel] = useState<ChannelType>(defaultChannel)
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const [mediaUrls, setMediaUrls] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const { canSendTo, isTrial, loading: trialLoading } = useTwilioTrialCheck()

  // Determine recipient based on channel
  const getRecipient = () => {
    switch (selectedChannel) {
      case ChannelType.SMS:
      case ChannelType.WHATSAPP:
        return recipientPhone
      case ChannelType.EMAIL:
        return recipientEmail
      default:
        return undefined
    }
  }

  const recipient = getRecipient()
  const canSendMessage = recipient && (selectedChannel === ChannelType.EMAIL || canSendTo(recipient))

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setMediaFiles(prev => [...prev, ...files])

    // Create preview URLs
    files.forEach(file => {
      const url = URL.createObjectURL(file)
      setMediaUrls(prev => [...prev, url])
    })
  }

  const removeMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index))
    setMediaUrls(prev => {
      const newUrls = prev.filter((_, i) => i !== index)
      // Revoke the removed URL to free memory
      URL.revokeObjectURL(prev[index])
      return newUrls
    })
  }

  const handleSend = async () => {
    if (!message.trim() || !recipient || !canSendMessage) return

    setSending(true)
    setError(null)
    setSuccess(null)

    try {
      // TODO: Upload media files and get URLs
      const uploadedMediaUrls: string[] = []
      
      // For now, we'll skip media upload and just send text
      // In a real implementation, you'd upload files to a storage service first

      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: recipient,
          message: message.trim(),
          channel: selectedChannel,
          mediaUrls: uploadedMediaUrls,
          contactId,
        }),
      })

      const result: SendMessageResponse = await response.json()

      if (result.success) {
        setSuccess('Message sent successfully!')
        setMessage('')
        setMediaFiles([])
        setMediaUrls([])
        
        if (onMessageSent && result.message) {
          onMessageSent(result.message)
        }
      } else {
        setError(result.error || 'Failed to send message')
      }
    } catch (err) {
      console.error('Send message error:', err)
      setError('Failed to send message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const getChannelIcon = (channel: ChannelType) => {
    switch (channel) {
      case ChannelType.SMS:
        return (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )
      case ChannelType.WHATSAPP:
        return (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.700"/>
          </svg>
        )
      case ChannelType.EMAIL:
        return (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        )
      default:
        return null
    }
  }

  const availableChannels = [
    ...(recipientPhone ? [ChannelType.SMS, ChannelType.WHATSAPP] : []),
    ...(recipientEmail ? [ChannelType.EMAIL] : []),
  ]

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Send Message</h3>
        
        {/* Channel Selection */}
        {availableChannels.length > 1 && (
          <div className="flex space-x-2 mb-4">
            {availableChannels.map((channel) => (
              <button
                key={channel}
                onClick={() => setSelectedChannel(channel)}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                  selectedChannel === channel
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {getChannelIcon(channel)}
                <span className="ml-2 capitalize">{channel.toLowerCase()}</span>
              </button>
            ))}
          </div>
        )}

        {/* Recipient Display */}
        {recipient && (
          <div className="mb-4 p-3 bg-gray-50 rounded-md">
            <div className="flex items-center">
              <span className="text-sm text-gray-600">To:</span>
              <span className="ml-2 text-sm font-medium text-gray-900">{recipient}</span>
              <span className="ml-2 text-xs text-gray-500">
                via {selectedChannel.toLowerCase()}
              </span>
            </div>
          </div>
        )}

        {/* Trial Warning */}
        {(selectedChannel === ChannelType.SMS || selectedChannel === ChannelType.WHATSAPP) && (
          <TwilioTrialWarning recipientNumber={recipient} />
        )}
      </div>

      {/* Message Input */}
      <div className="mb-4">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message..."
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          disabled={sending}
        />
        <div className="mt-1 text-xs text-gray-500 text-right">
          {message.length} characters
        </div>
      </div>

      {/* Media Upload */}
      {(selectedChannel === ChannelType.SMS || selectedChannel === ChannelType.WHATSAPP) && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Attachments (optional)
          </label>
          <input
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            disabled={sending}
          />
          
          {/* Media Preview */}
          {mediaUrls.length > 0 && (
            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
              {mediaUrls.map((url, index) => (
                <div key={index} className="relative">
                  <img
                    src={url}
                    alt={`Media ${index + 1}`}
                    className="w-full h-20 object-cover rounded-md"
                  />
                  <button
                    onClick={() => removeMedia(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {/* Send Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSend}
          disabled={!message.trim() || !recipient || !canSendMessage || sending}
          className={`px-4 py-2 rounded-md text-sm font-medium ${
            !message.trim() || !recipient || !canSendMessage || sending
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {sending ? (
            <div className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Sending...
            </div>
          ) : (
            'Send Message'
          )}
        </button>
      </div>
    </div>
  )
}