'use client'

import React, { useState, useEffect } from 'react'
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Clock, Users } from 'lucide-react'
import { ContactSyncStatus, HubSpotSyncResult } from '@/types/business'

interface HubSpotSyncManagerProps {
  configId: string
  teamId: string
}

export default function HubSpotSyncManager({ configId, teamId }: HubSpotSyncManagerProps) {
  const [syncStatuses, setSyncStatuses] = useState<ContactSyncStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const [syncResults, setSyncResults] = useState<HubSpotSyncResult[] | null>(null)

  useEffect(() => {
    loadSyncStatuses()
  }, [configId])

  const loadSyncStatuses = async () => {
    try {
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

  const handleBulkSync = async () => {
    if (selectedContacts.length === 0) {
      alert('Please select contacts to sync')
      return
    }

    setSyncing(true)
    try {
      const response = await fetch('/api/business-tools/hubspot/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configId,
          contactIds: selectedContacts,
          syncType: 'to_hubspot'
        })
      })

      if (response.ok) {
        const data = await response.json()
        setSyncResults(data.results)
        await loadSyncStatuses() // Refresh statuses
        setSelectedContacts([]) // Clear selection
      }
    } catch (error) {
      console.error('Error syncing contacts:', error)
    } finally {
      setSyncing(false)
    }
  }

  const handleSelectAll = () => {
    if (selectedContacts.length === syncStatuses.length) {
      setSelectedContacts([])
    } else {
      setSelectedContacts(syncStatuses.map(s => s.contactId))
    }
  }

  const getStatusIcon = (status: ContactSyncStatus['syncStatus']) => {
    switch (status) {
      case 'synced':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'conflict':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />
      default:
        return <Clock className="w-5 h-5 text-gray-400" />
    }
  }

  const getStatusText = (status: ContactSyncStatus['syncStatus']) => {
    switch (status) {
      case 'synced':
        return 'Synced'
      case 'pending':
        return 'Pending'
      case 'error':
        return 'Error'
      case 'conflict':
        return 'Conflict'
      default:
        return 'Unknown'
    }
  }

  const summary = {
    total: syncStatuses.length,
    synced: syncStatuses.filter(s => s.syncStatus === 'synced').length,
    pending: syncStatuses.filter(s => s.syncStatus === 'pending').length,
    errors: syncStatuses.filter(s => s.syncStatus === 'error').length,
    conflicts: syncStatuses.filter(s => s.syncStatus === 'conflict').length,
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
          <h3 className="text-lg font-medium text-gray-900">HubSpot Sync Status</h3>
          <p className="text-gray-600">Manage contact synchronization with HubSpot</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadSyncStatuses}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleBulkSync}
            disabled={syncing || selectedContacts.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Users className="w-4 h-4" />
            {syncing ? 'Syncing...' : `Sync Selected (${selectedContacts.length})`}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
          <div className="text-sm text-gray-600">Total Contacts</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-green-600">{summary.synced}</div>
          <div className="text-sm text-gray-600">Synced</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-yellow-600">{summary.pending}</div>
          <div className="text-sm text-gray-600">Pending</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-red-600">{summary.errors}</div>
          <div className="text-sm text-gray-600">Errors</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-orange-600">{summary.conflicts}</div>
          <div className="text-sm text-gray-600">Conflicts</div>
        </div>
      </div>

      {/* Sync Results */}
      {syncResults && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="font-medium text-gray-900 mb-4">Last Sync Results</h4>
          <div className="space-y-2">
            {syncResults.map((result, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                <div className="flex items-center gap-3">
                  {result.action === 'created' && <CheckCircle className="w-4 h-4 text-green-500" />}
                  {result.action === 'updated' && <CheckCircle className="w-4 h-4 text-blue-500" />}
                  {result.action === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
                  {result.action === 'skipped' && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                  <span className="text-sm text-gray-900">Contact {result.contactId}</span>
                </div>
                <div className="text-sm">
                  <span className={`capitalize ${
                    result.action === 'created' ? 'text-green-600' :
                    result.action === 'updated' ? 'text-blue-600' :
                    result.action === 'error' ? 'text-red-600' :
                    'text-yellow-600'
                  }`}>
                    {result.action}
                  </span>
                  {result.error && (
                    <span className="ml-2 text-red-600">- {result.error}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contact List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">Contact Sync Status</h4>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={selectedContacts.length === syncStatuses.length && syncStatuses.length > 0}
                onChange={handleSelectAll}
                className="rounded"
              />
              Select All
            </label>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {syncStatuses.map((status) => (
            <div key={status.contactId} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedContacts.includes(status.contactId)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedContacts([...selectedContacts, status.contactId])
                      } else {
                        setSelectedContacts(selectedContacts.filter(id => id !== status.contactId))
                      }
                    }}
                    className="rounded"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Contact {status.contactId}</div>
                    {status.hubspotId && (
                      <div className="text-sm text-gray-600">HubSpot ID: {status.hubspotId}</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(status.syncStatus)}
                    <span className="text-sm text-gray-900">{getStatusText(status.syncStatus)}</span>
                  </div>
                  
                  {status.lastSyncAt && (
                    <div className="text-sm text-gray-600">
                      {new Date(status.lastSyncAt).toLocaleDateString()}
                    </div>
                  )}

                  {status.syncStatus === 'conflict' && (
                    <button className="text-sm text-blue-600 hover:text-blue-800">
                      Resolve
                    </button>
                  )}
                </div>
              </div>

              {status.errorMessage && (
                <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                  {status.errorMessage}
                </div>
              )}
            </div>
          ))}
        </div>

        {syncStatuses.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No contacts found for synchronization
          </div>
        )}
      </div>
    </div>
  )
}