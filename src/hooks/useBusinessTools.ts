'use client'

import { useState, useEffect } from 'react'
import { BusinessToolConfig } from '@/types/business'

export function useBusinessTools() {
  const [configs, setConfigs] = useState<BusinessToolConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/business-tools')
      
      if (!response.ok) {
        throw new Error('Failed to load business tool configurations')
      }
      
      const data = await response.json()
      setConfigs(data.configs)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const saveConfig = async (configId: string, configData: any) => {
    try {
      const isUpdate = configs.some(c => c.id === configId)
      const url = isUpdate ? `/api/business-tools/${configId}` : '/api/business-tools'
      const method = isUpdate ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isUpdate ? configData : { configId, ...configData })
      })

      if (!response.ok) {
        throw new Error('Failed to save configuration')
      }

      const data = await response.json()
      
      if (isUpdate) {
        setConfigs(configs.map(c => c.id === configId ? data.config : c))
      } else {
        setConfigs([...configs, data.config])
      }

      return data.config
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to save configuration')
    }
  }

  const deleteConfig = async (configId: string) => {
    try {
      const response = await fetch(`/api/business-tools/${configId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete configuration')
      }

      setConfigs(configs.filter(c => c.id !== configId))
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to delete configuration')
    }
  }

  const testConnection = async (configId: string) => {
    try {
      const response = await fetch(`/api/business-tools/${configId}/test`, {
        method: 'POST'
      })

      const data = await response.json()
      return data
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to test connection')
    }
  }

  const getEnabledConfigs = (type?: string) => {
    return configs.filter(config => 
      config.isEnabled && (!type || config.type === type)
    )
  }

  const hasIntegration = (type: string) => {
    return getEnabledConfigs(type).length > 0
  }

  return {
    configs,
    loading,
    error,
    loadConfigs,
    saveConfig,
    deleteConfig,
    testConnection,
    getEnabledConfigs,
    hasIntegration,
  }
}

export function useHubSpotSync(configId: string) {
  const [syncStatuses, setSyncStatuses] = useState([])
  const [loading, setLoading] = useState(false)

  const loadSyncStatuses = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/business-tools/hubspot/sync/status?configId=${configId}`)
      
      if (response.ok) {
        const data = await response.json()
        setSyncStatuses(data.statuses)
      }
    } catch (error) {
      console.error('Error loading sync statuses:', error)
    } finally {
      setLoading(false)
    }
  }

  const syncContacts = async (contactIds: string[]) => {
    try {
      const response = await fetch('/api/business-tools/hubspot/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configId,
          contactIds,
          syncType: 'to_hubspot'
        })
      })

      if (response.ok) {
        const data = await response.json()
        await loadSyncStatuses() // Refresh statuses
        return data
      }
      
      throw new Error('Sync failed')
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Sync failed')
    }
  }

  const resolveConflicts = async (resolution: any) => {
    try {
      const response = await fetch('/api/business-tools/hubspot/sync/resolve-conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configId,
          resolution
        })
      })

      if (response.ok) {
        const data = await response.json()
        await loadSyncStatuses() // Refresh statuses
        return data.contact
      }
      
      throw new Error('Failed to resolve conflicts')
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to resolve conflicts')
    }
  }

  return {
    syncStatuses,
    loading,
    loadSyncStatuses,
    syncContacts,
    resolveConflicts,
  }
}