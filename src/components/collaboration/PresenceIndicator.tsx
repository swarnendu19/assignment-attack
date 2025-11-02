'use client'

import React, { useEffect, useState } from 'react'
import { useCollaboration } from '@/contexts/CollaborationContext'
import { PresenceInfo } from '@/services/collaborationService'

interface PresenceIndicatorProps {
  resourceId: string
  resourceType: 'note' | 'contact'
  className?: string
  showDetails?: boolean
}

export function PresenceIndicator({ 
  resourceId, 
  resourceType, 
  className = '',
  showDetails = true 
}: PresenceIndicatorProps) {
  const [presence, setPresence] = useState<PresenceInfo[]>([])
  const { getPresence, trackPresence } = useCollaboration()

  useEffect(() => {
    // Track our own presence as viewing
    trackPresence(resourceId, resourceType, 'viewing')

    // Update presence every 2 seconds
    const interval = setInterval(() => {
      const currentPresence = getPresence(resourceId, resourceType)
      setPresence(currentPresence)
    }, 2000)

    // Initial load
    setPresence(getPresence(resourceId, resourceType))

    return () => {
      clearInterval(interval)
    }
  }, [resourceId, resourceType, getPresence, trackPresence])

  const activeUsers = presence.filter(p => {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000)
    return new Date(p.lastSeen) > oneMinuteAgo
  })

  const viewingUsers = activeUsers.filter(p => p.status === 'viewing')
  const editingUsers = activeUsers.filter(p => p.status === 'editing')

  if (activeUsers.length === 0) {
    return null
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* User Avatars */}
      <div className="flex -space-x-2">
        {activeUsers.slice(0, 5).map((user) => (
          <div
            key={user.userId}
            className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-medium text-white ${
              user.status === 'editing' 
                ? 'bg-green-500 animate-pulse' 
                : 'bg-blue-500'
            }`}
            title={`${user.userName} is ${user.status}`}
          >
            {user.userName.charAt(0).toUpperCase()}
          </div>
        ))}
        {activeUsers.length > 5 && (
          <div className="w-8 h-8 bg-gray-400 rounded-full border-2 border-white flex items-center justify-center text-xs font-medium text-white">
            +{activeUsers.length - 5}
          </div>
        )}
      </div>

      {/* Status Text */}
      {showDetails && (
        <div className="text-sm text-gray-600">
          {editingUsers.length > 0 && (
            <span className="text-green-600 font-medium">
              {editingUsers.length === 1 
                ? `${editingUsers[0].userName} is editing`
                : `${editingUsers.length} people are editing`
              }
            </span>
          )}
          {editingUsers.length > 0 && viewingUsers.length > 0 && (
            <span className="text-gray-500"> • </span>
          )}
          {viewingUsers.length > 0 && (
            <span>
              {viewingUsers.length === 1 
                ? `${viewingUsers[0].userName} is viewing`
                : `${viewingUsers.length} people are viewing`
              }
            </span>
          )}
        </div>
      )}

      {/* Live Indicator */}
      {editingUsers.length > 0 && (
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-green-600 font-medium">LIVE</span>
        </div>
      )}
    </div>
  )
}