'use client'

import { useState, useEffect } from 'react'
import { ChannelType } from '@prisma/client'
import { messageTemplateService } from '@/services/messageTemplateService'

interface ScheduleMessageModalProps {
  isOpen: boolean
  onClose: () => void
  onSchedule: (scheduleData: ScheduleMessageData) => void
  contactId: string
  contactName?: string
  defaultChannel?: ChannelType
}

interface ScheduleMessageData {
  contactId: string
  channel: ChannelType
  content: {
    text: string
    attachments?: Array<{
      id: string
      filename: string
      contentType: string
      size: number
      url: string
    }>
  }
  scheduledFor: Date
  recurrence?: RecurrencePattern
  templateId?: string
}

interface RecurrencePattern {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval: number
  daysOfWeek?: number[]
  dayOfMonth?: number
  endDate?: Date
  maxOccurrences?: number
}

interface MessageTemplate {
  id: string
  name: string
  content: string
  variables: string[]
  channel: ChannelType
  category?: string
}

export default function ScheduleMessageModal({
  isOpen,
  onClose,
  onSchedule,
  contactId,
  contactName,
  defaultChannel = ChannelType.SMS
}: ScheduleMessageModalProps) {
  const [channel, setChannel] = useState<ChannelType>(defaultChannel)
  const [message, setMessage] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrence, setRecurrence] = useState<RecurrencePattern>({
    type: 'daily',
    interval: 1
  })
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)

  // Load templates when modal opens or channel changes
  useEffect(() => {
    if (isOpen) {
      loadTemplates()
    }
  }, [isOpen, channel])

  // Set default date/time to 1 hour from now
  useEffect(() => {
    if (isOpen && !scheduledDate) {
      const now = new Date()
      now.setHours(now.getHours() + 1)
      setScheduledDate(now.toISOString().split('T')[0])
      setScheduledTime(now.toTimeString().slice(0, 5))
    }
  }, [isOpen])

  const loadTemplates = async () => {
    try {
      const response = await fetch(`/api/templates?channel=${channel}&limit=50`)
      if (response.ok) {
        const data = await response.json()
        setTemplates(data.templates || [])
      }
    } catch (error) {
      console.error('Error loading templates:', error)
    }
  }

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId)
    if (template) {
      setSelectedTemplate(templateId)
      setMessage(template.content)
      
      // Initialize template variables
      const variables: Record<string, string> = {}
      template.variables.forEach(variable => {
        variables[variable] = ''
      })
      setTemplateVariables(variables)
    } else {
      setSelectedTemplate('')
      setTemplateVariables({})
    }
  }

  const processMessageWithVariables = (content: string): string => {
    let processedContent = content

    // Substitute template variables
    Object.entries(templateVariables).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
      processedContent = processedContent.replace(regex, value)
    })

    // Substitute contact variables
    if (contactName) {
      processedContent = processedContent.replace(/{{\\s*(contact\\.name|name)\\s*}}/g, contactName)
    }

    // Add current date/time
    const now = new Date()
    processedContent = processedContent.replace(/{{\\s*date\\s*}}/g, now.toLocaleDateString())
    processedContent = processedContent.replace(/{{\\s*time\\s*}}/g, now.toLocaleTimeString())

    return processedContent
  }

  const handleSchedule = async () => {
    if (!message.trim() || !scheduledDate || !scheduledTime) {
      alert('Please fill in all required fields')
      return
    }

    setIsLoading(true)

    try {
      const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`)
      
      if (scheduledDateTime <= new Date()) {
        alert('Scheduled time must be in the future')
        setIsLoading(false)
        return
      }

      const processedMessage = processMessageWithVariables(message)

      const scheduleData: ScheduleMessageData = {
        contactId,
        channel,
        content: {
          text: processedMessage
        },
        scheduledFor: scheduledDateTime,
        recurrence: isRecurring ? recurrence : undefined,
        templateId: selectedTemplate || undefined
      }

      await onSchedule(scheduleData)
      
      // Reset form
      setMessage('')
      setScheduledDate('')
      setScheduledTime('')
      setIsRecurring(false)
      setSelectedTemplate('')
      setTemplateVariables({})
      
      onClose()
    } catch (error) {
      console.error('Error scheduling message:', error)
      alert('Failed to schedule message')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Schedule Message</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Contact Info */}
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-sm text-gray-600">
              Scheduling message for: <span className="font-medium">{contactName || 'Unknown Contact'}</span>
            </p>
          </div>

          {/* Channel Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Channel
            </label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as ChannelType)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={ChannelType.SMS}>SMS</option>
              <option value={ChannelType.WHATSAPP}>WhatsApp</option>
              <option value={ChannelType.EMAIL}>Email</option>
            </select>
          </div>

          {/* Template Selection */}
          {templates.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Use Template (Optional)
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => handleTemplateSelect(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a template...</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} {template.category && `(${template.category})`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Template Variables */}
          {selectedTemplate && Object.keys(templateVariables).length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Template Variables
              </label>
              <div className="space-y-2">
                {Object.keys(templateVariables).map((variable) => (
                  <div key={variable}>
                    <label className="block text-xs text-gray-600 mb-1">
                      {variable}
                    </label>
                    <input
                      type="text"
                      value={templateVariables[variable]}
                      onChange={(e) => setTemplateVariables(prev => ({
                        ...prev,
                        [variable]: e.target.value
                      }))}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={`Enter value for ${variable}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Message Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message *
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your message..."
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              You can use variables like {{name}}, {{date}}, {{time}}
            </p>
          </div>

          {/* Schedule Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date *
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time *
              </label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Recurring Options */}
          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Make this a recurring message
              </span>
            </label>
          </div>

          {/* Recurrence Settings */}
          {isRecurring && (
            <div className="bg-gray-50 p-4 rounded-md space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Repeat
                  </label>
                  <select
                    value={recurrence.type}
                    onChange={(e) => setRecurrence(prev => ({
                      ...prev,
                      type: e.target.value as RecurrencePattern['type']
                    }))}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Every
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={recurrence.interval}
                    onChange={(e) => setRecurrence(prev => ({
                      ...prev,
                      interval: parseInt(e.target.value) || 1
                    }))}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date (Optional)
                </label>
                <input
                  type="date"
                  value={recurrence.endDate?.toISOString().split('T')[0] || ''}
                  onChange={(e) => setRecurrence(prev => ({
                    ...prev,
                    endDate: e.target.value ? new Date(e.target.value) : undefined
                  }))}
                  min={scheduledDate}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleSchedule}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? 'Scheduling...' : 'Schedule Message'}
          </button>
        </div>
      </div>
    </div>
  )
}