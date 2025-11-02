'use client'

import React, { useState, useEffect } from 'react'
import { RealTimeMetrics } from '@/types/analytics'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useAuth } from '@/contexts/AuthContext'

interface PerformanceAlert {
  type: string
  severity: 'info' | 'warning' | 'error'
  message: string
  value: number
  timestamp: Date
}

interface PerformanceMonitorProps {
  className?: string
}

export default function PerformanceMonitor({ className = '' }: PerformanceMonitorProps) {
  const { user } = useAuth()
  const { socket, isConnected } = useWebSocket('/api/analytics/socket')
  const [metrics, setMetrics] = useState<RealTimeMetrics | null>(null)
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([])
  const [isMinimized, setIsMinimized] = useState(false)

  useEffect(() => {
    if (!socket || !isConnected || !user?.teamId) return

    // Subscribe to analytics updates
    socket.emit('subscribe', {
      teamId: user.teamId
    })

    // Listen for real-time metrics
    socket.on('realtime-metrics', (newMetrics: RealTimeMetrics) => {
      setMetrics(newMetrics)
    })

    // Listen for performance alerts
    socket.on('performance-alerts', (newAlerts: PerformanceAlert[]) => {
      const alertsWithTimestamp = newAlerts.map(alert => ({
        ...alert,
        timestamp: new Date()
      }))
      
      setAlerts(prev => [...alertsWithTimestamp, ...prev].slice(0, 10)) // Keep last 10 alerts
    })

    return () => {
      socket.off('realtime-metrics')
      socket.off('performance-alerts')
    }
  }, [socket, isConnected, user?.teamId])

  const clearAlerts = () => {
    setAlerts([])
  }

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return '🚨'
      case 'warning':
        return '⚠️'
      case 'info':
        return 'ℹ️'
      default:
        return '📊'
    }
  }

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800'
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800'
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800'
    }
  }

  const getMetricStatus = (metric: keyof RealTimeMetrics, value: number) => {
    switch (metric) {
      case 'averageResponseTime':
        if (value > 120) return 'error' // > 2 hours
        if (value > 60) return 'warning' // > 1 hour
        return 'good'
      case 'pendingMessages':
        if (value > 100) return 'error'
        if (value > 50) return 'warning'
        return 'good'
      case 'activeUsers':
        const now = new Date()
        const hour = now.getHours()
        const isBusinessHours = hour >= 9 && hour <= 17
        if (isBusinessHours && value < 2) return 'warning'
        return 'good'
      default:
        return 'good'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'error':
        return 'text-red-600'
      case 'warning':
        return 'text-yellow-600'
      case 'good':
        return 'text-green-600'
      default:
        return 'text-gray-600'
    }
  }

  if (!metrics) {
    return (
      <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-sm text-gray-600">Loading performance data...</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center">
          <div className={`w-3 h-3 rounded-full mr-2 ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
          <h3 className="text-lg font-semibold text-gray-900">Performance Monitor</h3>
          <span className="ml-2 text-xs text-gray-500">
            Updated {metrics.lastUpdated.toLocaleTimeString()}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {alerts.length > 0 && (
            <button
              onClick={clearAlerts}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Clear alerts
            </button>
          )}
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-gray-500 hover:text-gray-700"
          >
            {isMinimized ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="p-4">
          {/* Real-time metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className={`text-2xl font-bold ${getStatusColor(getMetricStatus('activeUsers', metrics.activeUsers))}`}>
                {metrics.activeUsers}
              </div>
              <div className="text-xs text-gray-500">Active Users</div>
            </div>
            
            <div className="text-center">
              <div className={`text-2xl font-bold ${getStatusColor(getMetricStatus('activeConversations', metrics.activeConversations))}`}>
                {metrics.activeConversations}
              </div>
              <div className="text-xs text-gray-500">Active Chats</div>
            </div>
            
            <div className="text-center">
              <div className={`text-2xl font-bold ${getStatusColor(getMetricStatus('pendingMessages', metrics.pendingMessages))}`}>
                {metrics.pendingMessages}
              </div>
              <div className="text-xs text-gray-500">Pending</div>
            </div>
            
            <div className="text-center">
              <div className={`text-2xl font-bold ${getStatusColor(getMetricStatus('averageResponseTime', metrics.averageResponseTime))}`}>
                {Math.round(metrics.averageResponseTime)}m
              </div>
              <div className="text-xs text-gray-500">Avg Response</div>
            </div>
          </div>

          {/* Performance alerts */}
          {alerts.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Recent Alerts</h4>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {alerts.map((alert, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded border text-xs ${getAlertColor(alert.severity)}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className="mr-2">{getAlertIcon(alert.severity)}</span>
                        <span>{alert.message}</span>
                      </div>
                      <span className="text-xs opacity-75">
                        {alert.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* System status indicators */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
              <div>
                {metrics.messagesPerMinute.toFixed(1)} msg/min
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}