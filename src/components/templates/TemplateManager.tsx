'use client'

import { useState, useEffect } from 'react'
import { ChannelType } from '@prisma/client'

interface MessageTemplate {
  id: string
  name: string
  content: string
  variables: string[]
  channel: ChannelType
  category?: string
  isActive: boolean
  usageCount: number
  createdAt: Date
  updatedAt: Date
  userId: string
  teamId: string
  user?: {
    id: string
    name?: string
    email: string
  }
}

interface TemplateManagerProps {
  onSelectTemplate?: (template: MessageTemplate) => void
  selectedChannel?: ChannelType
  showCreateButton?: boolean
}

export default function TemplateManager({
  onSelectTemplate,
  selectedChannel,
  showCreateButton = true
}: TemplateManagerProps) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [categorizedTemplates, setCategorizedTemplates] = useState<Record<string, MessageTemplate[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'list' | 'categories'>('categories')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null)

  useEffect(() => {
    loadTemplates()
  }, [selectedChannel])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        limit: '100',
        grouped: viewMode === 'categories' ? 'true' : 'false'
      })

      if (selectedChannel) {
        params.append('channel', selectedChannel)
      }

      if (searchQuery) {
        params.append('query', searchQuery)
      }

      if (selectedCategory !== 'all') {
        params.append('category', selectedCategory)
      }

      const response = await fetch(`/api/templates?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to load templates')
      }

      const data = await response.json()
      
      if (viewMode === 'categories') {
        setCategorizedTemplates(data.categories || {})
      } else {
        setTemplates(data.templates || [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) {
      return
    }

    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete template')
      }

      // Reload templates
      loadTemplates()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete template')
    }
  }

  const handleDuplicateTemplate = async (template: MessageTemplate) => {
    try {
      const response = await fetch(`/api/templates/${template.id}/duplicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `${template.name} (Copy)`
        })
      })

      if (!response.ok) {
        throw new Error('Failed to duplicate template')
      }

      // Reload templates
      loadTemplates()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to duplicate template')
    }
  }

  const getChannelBadge = (channel: ChannelType) => {
    const baseClasses = "px-2 py-1 text-xs font-medium rounded"
    
    switch (channel) {
      case ChannelType.SMS:
        return `${baseClasses} bg-blue-100 text-blue-800`
      case ChannelType.WHATSAPP:
        return `${baseClasses} bg-green-100 text-green-800`
      case ChannelType.EMAIL:
        return `${baseClasses} bg-purple-100 text-purple-800`
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`
    }
  }

  const renderTemplate = (template: MessageTemplate) => (
    <div
      key={template.id}
      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="font-medium text-gray-900">{template.name}</h4>
          <div className="flex items-center space-x-2 mt-1">
            <span className={getChannelBadge(template.channel)}>
              {template.channel}
            </span>
            {template.category && (
              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                {template.category}
              </span>
            )}
            <span className="text-xs text-gray-500">
              Used {template.usageCount} times
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {onSelectTemplate && (
            <button
              onClick={() => onSelectTemplate(template)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Use
            </button>
          )}
          <button
            onClick={() => setEditingTemplate(template)}
            className="text-gray-600 hover:text-gray-800 text-sm font-medium"
          >
            Edit
          </button>
          <button
            onClick={() => handleDuplicateTemplate(template)}
            className="text-gray-600 hover:text-gray-800 text-sm font-medium"
          >
            Duplicate
          </button>
          <button
            onClick={() => handleDeleteTemplate(template.id)}
            className="text-red-600 hover:text-red-800 text-sm font-medium"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="mb-3">
        <p className="text-gray-700 text-sm line-clamp-3">
          {template.content}
        </p>
      </div>

      {template.variables.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-1">Variables:</p>
          <div className="flex flex-wrap gap-1">
            {template.variables.map((variable) => (
              <span
                key={variable}
                className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded"
              >
                {variable}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-gray-500">
        Created by {template.user?.name || template.user?.email} • 
        {new Date(template.createdAt).toLocaleDateString()}
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={loadTemplates}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Message Templates</h2>
        {showCreateButton && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Create Template
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && loadTemplates()}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => {
              setViewMode(viewMode === 'list' ? 'categories' : 'list')
              loadTemplates()
            }}
            className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            {viewMode === 'list' ? 'Group by Category' : 'List View'}
          </button>
          
          <button
            onClick={loadTemplates}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Templates */}
      {viewMode === 'categories' ? (
        <div className="space-y-6">
          {Object.entries(categorizedTemplates).map(([category, categoryTemplates]) => (
            <div key={category}>
              <h3 className="text-lg font-medium text-gray-900 mb-3">
                {category} ({categoryTemplates.length})
              </h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {categoryTemplates.map(renderTemplate)}
              </div>
            </div>
          ))}
          
          {Object.keys(categorizedTemplates).length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No templates found</p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map(renderTemplate)}
          
          {templates.length === 0 && (
            <div className="col-span-full text-center py-8">
              <p className="text-gray-500">No templates found</p>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Template Modal would go here */}
      {/* This would be a separate component for template creation/editing */}
    </div>
  )
}