'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Settings, TestTube, Trash2, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { BusinessToolConfig, BusinessToolType } from '@/types/business'

interface BusinessToolsManagerProps {
  teamId: string
}

export default function BusinessToolsManager({ teamId }: BusinessToolsManagerProps) {
  const [configs, setConfigs] = useState<BusinessToolConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingConfig, setEditingConfig] = useState<BusinessToolConfig | null>(null)
  const [testingConfig, setTestingConfig] = useState<string | null>(null)

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = async () => {
    try {
      const response = await fetch('/api/business-tools')
      if (response.ok) {
        const data = await response.json()
        setConfigs(data.configs)
      }
    } catch (error) {
      console.error('Error loading business tool configs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTestConnection = async (configId: string) => {
    setTestingConfig(configId)
    try {
      const response = await fetch(`/api/business-tools/${configId}/test`, {
        method: 'POST'
      })
      const data = await response.json()
      
      // Show result (you might want to use a toast notification here)
      alert(data.message)
    } catch (error) {
      alert('Failed to test connection')
    } finally {
      setTestingConfig(null)
    }
  }

  const handleDeleteConfig = async (configId: string) => {
    if (!confirm('Are you sure you want to delete this integration?')) {
      return
    }

    try {
      const response = await fetch(`/api/business-tools/${configId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setConfigs(configs.filter(c => c.id !== configId))
      }
    } catch (error) {
      console.error('Error deleting config:', error)
    }
  }

  const getToolIcon = (type: BusinessToolType) => {
    switch (type) {
      case 'hubspot':
        return '🟠'
      case 'slack':
        return '💬'
      case 'zapier':
        return '⚡'
      default:
        return '🔧'
    }
  }

  const getStatusIcon = (config: BusinessToolConfig) => {
    if (!config.isEnabled) {
      return <XCircle className="w-5 h-5 text-gray-400" />
    }
    
    // You might want to store connection status
    return <CheckCircle className="w-5 h-5 text-green-500" />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Business Tool Integrations</h2>
          <p className="text-gray-600">Connect your unified inbox with external business tools</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Integration
        </button>
      </div>

      {configs.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔧</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No integrations configured</h3>
          <p className="text-gray-600 mb-4">
            Connect with HubSpot, Slack, Zapier and other tools to enhance your workflow
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Add Your First Integration
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {configs.map((config) => (
            <div key={config.id} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getToolIcon(config.type)}</span>
                  <div>
                    <h3 className="font-medium text-gray-900">{config.name}</h3>
                    <p className="text-sm text-gray-600 capitalize">{config.type}</p>
                  </div>
                </div>
                {getStatusIcon(config)}
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Status:</span>
                  <span className={config.isEnabled ? 'text-green-600' : 'text-gray-400'}>
                    {config.isEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                {config.lastSyncAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Last Sync:</span>
                    <span className="text-gray-900">
                      {new Date(config.lastSyncAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleTestConnection(config.id)}
                  disabled={testingConfig === config.id}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  <TestTube className="w-4 h-4" />
                  {testingConfig === config.id ? 'Testing...' : 'Test'}
                </button>
                <button
                  onClick={() => setEditingConfig(config)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <Settings className="w-4 h-4" />
                  Configure
                </button>
                <button
                  onClick={() => handleDeleteConfig(config.id)}
                  className="px-3 py-2 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal would go here */}
      {(showAddModal || editingConfig) && (
        <BusinessToolConfigModal
          config={editingConfig}
          onClose={() => {
            setShowAddModal(false)
            setEditingConfig(null)
          }}
          onSave={(config) => {
            if (editingConfig) {
              setConfigs(configs.map(c => c.id === config.id ? config : c))
            } else {
              setConfigs([...configs, config])
            }
            setShowAddModal(false)
            setEditingConfig(null)
          }}
        />
      )}
    </div>
  )
}

interface BusinessToolConfigModalProps {
  config?: BusinessToolConfig | null
  onClose: () => void
  onSave: (config: BusinessToolConfig) => void
}

function BusinessToolConfigModal({ config, onClose, onSave }: BusinessToolConfigModalProps) {
  const [formData, setFormData] = useState({
    name: config?.name || '',
    type: config?.type || 'hubspot' as BusinessToolType,
    isEnabled: config?.isEnabled ?? true,
    credentials: config?.credentials || {},
    settings: config?.settings || {},
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const configId = config?.id || `${formData.type}_${Date.now()}`
      const url = config ? `/api/business-tools/${configId}` : '/api/business-tools'
      const method = config ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config ? formData : { configId, ...formData })
      })

      if (response.ok) {
        const data = await response.json()
        onSave(data.config)
      }
    } catch (error) {
      console.error('Error saving config:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3 className="text-lg font-medium mb-4">
          {config ? 'Edit Integration' : 'Add Integration'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Integration Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as BusinessToolType })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              disabled={!!config}
            >
              <option value="hubspot">HubSpot</option>
              <option value="slack">Slack</option>
              <option value="zapier">Zapier</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="My HubSpot Integration"
              required
            />
          </div>

          {/* Type-specific credential fields would go here */}
          {formData.type === 'hubspot' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key
              </label>
              <input
                type="password"
                value={formData.credentials.apiKey || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  credentials: { ...formData.credentials, apiKey: e.target.value }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Enter HubSpot API key"
                required
              />
            </div>
          )}

          {formData.type === 'slack' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Webhook URL
              </label>
              <input
                type="url"
                value={formData.credentials.webhookUrl || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  credentials: { ...formData.credentials, webhookUrl: e.target.value }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="https://hooks.slack.com/services/..."
                required
              />
            </div>
          )}

          {formData.type === 'zapier' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Webhook URL
              </label>
              <input
                type="url"
                value={formData.credentials.webhookUrl || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  credentials: { ...formData.credentials, webhookUrl: e.target.value }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="https://hooks.zapier.com/hooks/catch/..."
                required
              />
            </div>
          )}

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isEnabled"
              checked={formData.isEnabled}
              onChange={(e) => setFormData({ ...formData, isEnabled: e.target.checked })}
              className="mr-2"
            />
            <label htmlFor="isEnabled" className="text-sm text-gray-700">
              Enable this integration
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}