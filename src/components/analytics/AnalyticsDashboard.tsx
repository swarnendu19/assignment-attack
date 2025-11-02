'use client'

import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  AnalyticsMetrics, 
  AnalyticsQuery, 
  RealTimeMetrics,
  AnalyticsFilter,
  DateRange 
} from '@/types/analytics'
import { ChannelType } from '@prisma/client'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useAuth } from '@/contexts/AuthContext'

// Import chart components (would need to install chart library like recharts)
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

interface AnalyticsDashboardProps {
  initialDateRange?: DateRange
  initialFilters?: AnalyticsFilter
}

export default function AnalyticsDashboard({ 
  initialDateRange,
  initialFilters 
}: AnalyticsDashboardProps) {
  const { user } = useAuth()
  const [dateRange, setDateRange] = useState<DateRange>(
    initialDateRange || {
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      endDate: new Date()
    }
  )
  const [filters, setFilters] = useState<AnalyticsFilter>(initialFilters || {})
  const [realTimeMetrics, setRealTimeMetrics] = useState<RealTimeMetrics | null>(null)
  const [selectedMetrics, setSelectedMetrics] = useState([
    'responseTime',
    'messageVolume',
    'engagement',
    'conversion'
  ])

  // WebSocket connection for real-time updates
  const { socket, isConnected } = useWebSocket('/api/analytics/socket')

  // Query for analytics metrics
  const { data: analyticsData, isLoading, error, refetch } = useQuery({
    queryKey: ['analytics', dateRange, filters, selectedMetrics],
    queryFn: async (): Promise<AnalyticsMetrics> => {
      const query: AnalyticsQuery = {
        dateRange,
        channels: filters.channels,
        userIds: filters.users,
        teamId: user?.teamId || '',
        granularity: 'day',
        metrics: selectedMetrics as any
      }

      const response = await fetch('/api/analytics/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query)
      })

      if (!response.ok) {
        throw new Error('Failed to fetch analytics data')
      }

      const result = await response.json()
      return result.data
    },
    enabled: !!user?.teamId
  })

  // Setup WebSocket listeners
  useEffect(() => {
    if (!socket || !isConnected || !user?.teamId) return

    // Subscribe to analytics updates
    socket.emit('subscribe', {
      teamId: user.teamId,
      filters
    })

    // Listen for real-time metrics
    socket.on('realtime-metrics', (metrics: RealTimeMetrics) => {
      setRealTimeMetrics(metrics)
    })

    // Listen for performance alerts
    socket.on('performance-alerts', (alerts: any[]) => {
      // Handle performance alerts (show notifications, etc.)
      console.log('Performance alerts:', alerts)
    })

    // Listen for dashboard refresh events
    socket.on('dashboard-refresh', () => {
      refetch()
    })

    return () => {
      socket.off('realtime-metrics')
      socket.off('performance-alerts')
      socket.off('dashboard-refresh')
    }
  }, [socket, isConnected, user?.teamId, filters, refetch])

  // Update filters on WebSocket
  useEffect(() => {
    if (socket && isConnected) {
      socket.emit('update-filters', filters)
    }
  }, [socket, isConnected, filters])

  const handleDateRangeChange = (newDateRange: DateRange) => {
    setDateRange(newDateRange)
  }

  const handleFiltersChange = (newFilters: AnalyticsFilter) => {
    setFilters(newFilters)
  }

  const handleExport = async (format: 'csv' | 'pdf' | 'json') => {
    try {
      const exportRequest = {
        format,
        metrics: selectedMetrics,
        query: {
          dateRange,
          channels: filters.channels,
          userIds: filters.users,
          teamId: user?.teamId || '',
          granularity: 'day'
        },
        includeCharts: format === 'pdf'
      }

      const response = await fetch('/api/analytics/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exportRequest)
      })

      if (!response.ok) {
        throw new Error('Export failed')
      }

      const result = await response.json()
      
      // Trigger download
      window.open(result.data.downloadUrl, '_blank')
    } catch (error) {
      console.error('Export error:', error)
      // Show error notification
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading analytics...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <h3 className="text-red-800 font-medium">Error loading analytics</h3>
        <p className="text-red-600 text-sm mt-1">
          {error instanceof Error ? error.message : 'Unknown error occurred'}
        </p>
        <button
          onClick={() => refetch()}
          className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600">
            Real-time insights and performance metrics
            {isConnected && (
              <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-1 animate-pulse"></div>
                Live
              </span>
            )}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleExport('csv')}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
          >
            Export CSV
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* Real-time metrics cards */}
      {realTimeMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Active Users"
            value={realTimeMetrics.activeUsers}
            icon="👥"
            color="blue"
          />
          <MetricCard
            title="Active Conversations"
            value={realTimeMetrics.activeConversations}
            icon="💬"
            color="green"
          />
          <MetricCard
            title="Pending Messages"
            value={realTimeMetrics.pendingMessages}
            icon="📨"
            color="yellow"
          />
          <MetricCard
            title="Avg Response Time"
            value={`${Math.round(realTimeMetrics.averageResponseTime)}m`}
            icon="⏱️"
            color="purple"
          />
        </div>
      )}

      {/* Filters */}
      <AnalyticsFilters
        dateRange={dateRange}
        filters={filters}
        onDateRangeChange={handleDateRangeChange}
        onFiltersChange={handleFiltersChange}
      />

      {/* Charts and visualizations */}
      {analyticsData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Response Time Chart */}
          {selectedMetrics.includes('responseTime') && (
            <ChartCard title="Response Time Trends">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analyticsData.responseTime.responseTimeTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    name="Response Time (min)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Message Volume Chart */}
          {selectedMetrics.includes('messageVolume') && (
            <ChartCard title="Message Volume">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analyticsData.messageVolume.volumeTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#10B981" name="Messages" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Channel Performance */}
          {selectedMetrics.includes('channelPerformance') && (
            <ChartCard title="Channel Performance">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={Object.entries(analyticsData.channelPerformance.channelStats).map(
                      ([channel, stats]) => ({
                        name: channel,
                        value: stats.messageCount
                      })
                    )}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {Object.keys(analyticsData.channelPerformance.channelStats).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Conversion Funnel */}
          {selectedMetrics.includes('conversion') && (
            <ChartCard title="Conversion Funnel">
              <div className="space-y-4">
                <FunnelStep
                  label="Total Leads"
                  value={analyticsData.conversionFunnel.totalLeads}
                  percentage={100}
                />
                <FunnelStep
                  label="Qualified Leads"
                  value={analyticsData.conversionFunnel.qualifiedLeads}
                  percentage={analyticsData.conversionFunnel.conversionRates.leadToQualified * 100}
                />
                <FunnelStep
                  label="Opportunities"
                  value={analyticsData.conversionFunnel.opportunitiesCreated}
                  percentage={analyticsData.conversionFunnel.conversionRates.qualifiedToOpportunity * 100}
                />
                <FunnelStep
                  label="Won Deals"
                  value={analyticsData.conversionFunnel.dealsWon}
                  percentage={analyticsData.conversionFunnel.conversionRates.opportunityToWon * 100}
                />
              </div>
            </ChartCard>
          )}
        </div>
      )}
    </div>
  )
}

// Helper components
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4']

interface MetricCardProps {
  title: string
  value: string | number
  icon: string
  color: 'blue' | 'green' | 'yellow' | 'purple' | 'red'
}

function MetricCard({ title, value, icon, color }: MetricCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    red: 'bg-red-50 text-red-700 border-red-200'
  }

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-75">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <div className="text-2xl">{icon}</div>
      </div>
    </div>
  )
}

interface ChartCardProps {
  title: string
  children: React.ReactNode
}

function ChartCard({ title, children }: ChartCardProps) {
  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      {children}
    </div>
  )
}

interface FunnelStepProps {
  label: string
  value: number
  percentage: number
}

function FunnelStep({ label, value, percentage }: FunnelStepProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className="text-sm text-gray-500">{value}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
        <div className="text-xs text-gray-500 mt-1">{percentage.toFixed(1)}%</div>
      </div>
    </div>
  )
}

interface AnalyticsFiltersProps {
  dateRange: DateRange
  filters: AnalyticsFilter
  onDateRangeChange: (dateRange: DateRange) => void
  onFiltersChange: (filters: AnalyticsFilter) => void
}

function AnalyticsFilters({
  dateRange,
  filters,
  onDateRangeChange,
  onFiltersChange
}: AnalyticsFiltersProps) {
  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date Range
          </label>
          <div className="flex gap-2">
            <input
              type="date"
              value={dateRange.startDate.toISOString().split('T')[0]}
              onChange={(e) => onDateRangeChange({
                ...dateRange,
                startDate: new Date(e.target.value)
              })}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <input
              type="date"
              value={dateRange.endDate.toISOString().split('T')[0]}
              onChange={(e) => onDateRangeChange({
                ...dateRange,
                endDate: new Date(e.target.value)
              })}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
        </div>

        {/* Channel Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Channels
          </label>
          <select
            multiple
            value={filters.channels || []}
            onChange={(e) => {
              const selectedChannels = Array.from(e.target.selectedOptions, option => option.value) as ChannelType[]
              onFiltersChange({ ...filters, channels: selectedChannels })
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value={ChannelType.SMS}>SMS</option>
            <option value={ChannelType.WHATSAPP}>WhatsApp</option>
            <option value={ChannelType.EMAIL}>Email</option>
            <option value={ChannelType.TWITTER}>Twitter</option>
            <option value={ChannelType.FACEBOOK}>Facebook</option>
          </select>
        </div>

        {/* Quick Date Presets */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Quick Select
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => onDateRangeChange({
                startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
                endDate: new Date()
              })}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
            >
              24h
            </button>
            <button
              onClick={() => onDateRangeChange({
                startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                endDate: new Date()
              })}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
            >
              7d
            </button>
            <button
              onClick={() => onDateRangeChange({
                startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                endDate: new Date()
              })}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
            >
              30d
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}