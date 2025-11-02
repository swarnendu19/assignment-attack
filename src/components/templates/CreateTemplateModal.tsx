'use client'

import { useState } from 'react'
import { ChannelType } from '@prisma/client'

interface CreateTemplateModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editingTemplate?: MessageTemplate | null
}

interface MessageTemplate {
  id: string
  name: string
  content: string
  variables: string[]
  channel: ChannelType
  category?: string
  isActive: boolean
}

export default function CreateTemplateModal({
  isOpen,
  onClose,
  onSuccess,
  editingTemplate
}: CreateTemplateModalProps) {
  const [name, setName] = useState(editingTemplate?.name || '')
  const [content, setContent] = useState(editingTemplate?.content || '')
  const [channel, setChannel] = useState<ChannelType>(editingTemplate?.channel || ChannelType.SMS)
  const [category, setCategory] = useState(editingTemplate?.category || '')
  const [isLoading, setIsLoading] = useState(false)

  const extractVariables = (text: string): string[] => {
    const variableRegex = /{{\\s*([^}]+)\\s*}}/g
    const variables = new Set<string>()
    let match

    while ((match = variableRegex.exec(text)) !== null) {
      const variable = match[1].trim()
      // Skip built-in variables
      if (!['date', 'time', 'datetime', 'contact.name', 'contact.phone', 'contact.email', 'name', 'phone', 'email'].includes(variable)) {
        variables.add(variable)
      }
    }

    return Array.from(variables)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim() || !content.trim()) {
      alert('Please fill in all required fields')
      return
    }

    setIsLoading(true)

    try {
      const templateData = {
        name: name.trim(),
        content: content.trim(),
        channel,
        category: category.trim() || undefined,
        variables: extractVariables(content)
      }

      const url = editingTemplate 
        ? `/api/templates/${editingTemplate.id}`
        : '/api/templates'
      
      const method = editingTemplate ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(templateData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save template')
      }

      // Reset form
      setName('')
      setContent('')
      setChannel(ChannelType.SMS)
      setCategory('')
      
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error saving template:', error)
      alert(error instanceof Error ? error.message : 'Failed to save template')
    } finally {
      setIsLoading(false)
    }
  }

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('template-content') as HTMLTextAreaElement
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newContent = content.substring(0, start) + `{{${variable}}}` + content.substring(end)
      setContent(newContent)
      
      // Set cursor position after the inserted variable
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + variable.length + 4, start + variable.length + 4)
      }, 0)
    }
  }

  if (!isOpen) return null

  const detectedVariables = extractVariables(content)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {editingTemplate ? 'Edit Template' : 'Create Template'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Template Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Template Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter template name..."
              required
            />
          </div>

          {/* Channel */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Channel *
            </label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as ChannelType)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value={ChannelType.SMS}>SMS</option>
              <option value={ChannelType.WHATSAPP}>WhatsApp</option>
              <option value={ChannelType.EMAIL}>Email</option>
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category (Optional)
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Sales, Support, Marketing..."
            />
          </div>

          {/* Template Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Template Content *
            </label>
            <textarea
              id="template-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your template content..."
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Use {{variable}} syntax for dynamic content. Built-in variables: {{name}}, {{phone}}, {{email}}, {{date}}, {{time}}
            </p>
          </div>

          {/* Quick Variable Insertion */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quick Insert Variables
            </label>
            <div className="flex flex-wrap gap-2">
              {['name', 'phone', 'email', 'date', 'time'].map((variable) => (
                <button
                  key={variable}
                  type="button"
                  onClick={() => insertVariable(variable)}
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                >
                  {variable}
                </button>
              ))}
            </div>
          </div>

          {/* Detected Variables */}
          {detectedVariables.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Detected Custom Variables
              </label>
              <div className="flex flex-wrap gap-2">
                {detectedVariables.map((variable) => (
                  <span
                    key={variable}
                    className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded"
                  >
                    {variable}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                These variables will need to be filled in when using the template
              </p>
            </div>
          )}

          {/* Preview */}
          {content && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preview
              </label>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {content}
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading 
                ? (editingTemplate ? 'Updating...' : 'Creating...') 
                : (editingTemplate ? 'Update Template' : 'Create Template')
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}