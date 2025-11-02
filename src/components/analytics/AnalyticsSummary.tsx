'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { RealTimeMetrics } from '@/types/analytics'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'

interface AnalyticsSummaryProps {
  className?: string
}

export default function AnalyticsSummary({ className = '' }: AnalyticsSummaryProps) {
  const { user } = useAuth()

  // Query for real-time metrics
  const { data: realTimeMetrics, isLoading } = useQuery({
    queryKey: ['analytics-realtime', user?.teamId],
    queryFn: async (): Promise<RealTimeMetrics> => {
      const response = await fetch('/api/analytics/realtime')
      
      if (!response.ok) {
        throw new Error('Failed to fetch real-time metrics')
      }

      const result = await response.json()
      return result.data
    },
    enabled: !!user?.teamId,
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!realTimeMetrics) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Analytics Overview</h3>
        <p className="text-gray-500">Unable to load analytics data</p>
      </div>
    )
  }

  const getResponseTimeStatus = (responseTime: number) => {
    if (responseTime > 120) return { color: 'text-red-600', status: 'Poor' }
    if (responseTime > 60) return { color: 'text-yellow-600', status: 'Fair' }
    return { color: 'text-green-600', status: 'Good' }
  }

  const getPendingStatus = (pending: number) => {
    if (pending > 50) return { color: 'text-red-600', status: 'High' }
    if (pending > 20) return { color: 'text-yellow-600', status: 'Medium' }
    return { color: 'text-green-600', status: 'Low' }
  }

  const responseTimeStatus = getResponseTimeStatus(realTimeMetrics.averageResponseTime)
  const pendingStatus = getPendingStatus(realTimeMetrics.pendingMessages)

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Analytics Overview</h3>
        <Link
          href="/dashboard/analytics"
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          View Details →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Active Users */}
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">
            {realTimeMetrics.activeUsers}
          </div>
          <div className="text-sm text-blue-700">Active Users</div>
        </div>

        {/* Active Conversations */}
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">
            {realTimeMetrics.activeConversations}
          </div>
          <div className="text-sm text-green-700">Active Chats</div>
        </div>

        {/* Pending Messages */}
        <div className="text-center p-3 bg-yellow-50 rounded-lg">
          <div className={`text-2xl font-bold ${pendingStatus.color}`}>
            {realTimeMetrics.pendingMessages}
          </div>
          <div className="text-sm text-yellow-700">
            Pending ({pendingStatus.status})
          </div>
        </div>

        {/* Response Time */}
        <div className="text-center p-3 bg-purple-50 rounded-lg">
          <div className={`text-2xl font-bold ${responseTimeStatus.color}`}>
            {Math.round(realTimeMetrics.averageResponseTime)}m
          </div>
          <div className="text-sm text-purple-700">
            Response ({responseTimeStatus.status})
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
            <span>Live data</span>
          </div>
          <div>
            {realTimeMetrics.messagesPerMinute.toFixed(1)} msg/min
          </div>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Last updated: {realTimeMetrics.lastUpdated.toLocaleTimeString()}
        </div>
      </div>
    </div>
  )
}