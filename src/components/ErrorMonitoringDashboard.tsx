/**
 * Error Monitoring Dashboard Component
 * 
 * Provides real-time error monitoring, metrics visualization,
 * and system health overview
 */

'use client'

import React, { useState, useEffect } from 'react'
import { errorReportingService } from '@/lib/errorReporting'
import { errorRecoveryManager } from '@/lib/errorRecovery'
import { logger } from '@/lib/logger'
import { ErrorSeverity, ErrorCategory } from '@/lib/errorHandling'

interface ErrorMetrics {
  totalErrors: number
  errorsByCategory: Record<ErrorCategory, number>
  errorsBySeverity: Record<ErrorSeverity, number>
  errorsBySource: Record<string, number>
  errorRate: number
  averageResolutionTime: number
  timeWindow: {
    start: Date
    end: Date
  }
}

interface CircuitBreakerMetrics {
  [serviceName: string]: {
    name: string
    state: string
    failures: number
    successCount: number
    requestCount: number
    failureRate: number
    lastFailureTime: number
  }
}

interface ErrorTrend {
  timestamp: Date
  count: number
}

export function ErrorMonitoringDashboard() {
  const [metrics, setMetrics] = useState<ErrorMetrics | null>(null)
  const [circuitBreakers, setCircuitBreakers] = useState<CircuitBreakerMetrics>({})
  const [errorTrends, setErrorTrends] = useState<ErrorTrend[]>([])
  const [timeWindow, setTimeWindow] = useState<number>(60) // minutes
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  // Fetch metrics data
  const fetchMetrics = React.useCallback(async () => {
    try {
      const [metricsData, circuitBreakerData, trendsData] = await Promise.all([
        Promise.resolve(errorReportingService.getMetrics(timeWindow)),
        Promise.resolve(errorRecoveryManager.getCircuitBreakerMetrics()),
        Promise.resolve(errorReportingService.getErrorTrends(24))
      ])

      setMetrics(metricsData)
      setCircuitBreakers(circuitBreakerData)
      setErrorTrends(trendsData)
      setLastUpdated(new Date())
    } catch (error) {
      logger.error('Failed to fetch error metrics', {
        error: error instanceof Error ? error.message : error
      })
    } finally {
      setIsLoading(false)
    }
  }, [timeWindow])

  // Auto-refresh metrics
  useEffect(() => {
    fetchMetrics()
    const interval = setInterval(fetchMetrics, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [fetchMetrics])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-2 text-gray-600">Loading error metrics...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Error Monitoring</h2>
          <p className="text-sm text-gray-600">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        
        <div className="flex space-x-4">
          <select
            value={timeWindow}
            onChange={(e) => setTimeWindow(Number(e.target.value))}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value={15}>Last 15 minutes</option>
            <option value={60}>Last hour</option>
            <option value={240}>Last 4 hours</option>
            <option value={1440}>Last 24 hours</option>
          </select>
          
          <button
            onClick={fetchMetrics}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard
          title="Total Errors"
          value={metrics?.totalErrors || 0}
          subtitle={`${timeWindow} minutes`}
          color="red"
        />
        
        <MetricCard
          title="Error Rate"
          value={`${(metrics?.errorRate || 0).toFixed(2)}/min`}
          subtitle="Errors per minute"
          color="orange"
        />
        
        <MetricCard
          title="Active Circuits"
          value={Object.values(circuitBreakers).filter(cb => cb.state === 'open').length}
          subtitle="Circuit breakers open"
          color="yellow"
        />
        
        <MetricCard
          title="System Health"
          value={getSystemHealthStatus(metrics, circuitBreakers)}
          subtitle="Overall status"
          color={getSystemHealthColor(metrics, circuitBreakers)}
        />
      </div>

      {/* Error Trends Chart */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Error Trends (24 hours)</h3>
        <ErrorTrendsChart trends={errorTrends} />
      </div>

      {/* Error Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Errors by Category */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Errors by Category</h3>
          <ErrorBreakdownChart
            data={metrics?.errorsByCategory || {}}
            type="category"
          />
        </div>

        {/* Errors by Severity */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Errors by Severity</h3>
          <ErrorBreakdownChart
            data={metrics?.errorsBySeverity || {}}
            type="severity"
          />
        </div>
      </div>

      {/* Circuit Breakers Status */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Circuit Breakers</h3>
        <CircuitBreakerTable circuitBreakers={circuitBreakers} />
      </div>

      {/* Error Sources */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Top Error Sources</h3>
        <ErrorSourcesList sources={metrics?.errorsBySource || {}} />
      </div>
    </div>
  )
}

// Metric Card Component
interface MetricCardProps {
  title: string
  value: string | number
  subtitle: string
  color: 'red' | 'orange' | 'yellow' | 'green' | 'blue'
}

function MetricCard({ title, value, subtitle, color }: MetricCardProps) {
  const colorClasses = {
    red: 'bg-red-50 text-red-700 border-red-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200'
  }

  return (
    <div className={`p-6 rounded-lg border ${colorClasses[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs opacity-75">{subtitle}</div>
    </div>
  )
}

// Error Trends Chart Component
function ErrorTrendsChart({ trends }: { trends: ErrorTrend[] }) {
  const maxCount = Math.max(...trends.map(t => t.count), 1)
  
  return (
    <div className="h-64 flex items-end space-x-1">
      {trends.map((trend, index) => (
        <div
          key={index}
          className="flex-1 bg-red-200 hover:bg-red-300 transition-colors"
          style={{
            height: `${(trend.count / maxCount) * 100}%`,
            minHeight: trend.count > 0 ? '4px' : '1px'
          }}
          title={`${trend.timestamp.toLocaleTimeString()}: ${trend.count} errors`}
        />
      ))}
    </div>
  )
}

// Error Breakdown Chart Component
function ErrorBreakdownChart({ 
  data, 
  type 
}: { 
  data: Record<string, number>
  type: 'category' | 'severity'
}) {
  const entries = Object.entries(data).sort(([,a], [,b]) => b - a)
  const total = Object.values(data).reduce((sum, count) => sum + count, 0)

  const getColor = (key: string, type: string) => {
    if (type === 'severity') {
      switch (key) {
        case 'critical': return 'bg-red-500'
        case 'high': return 'bg-orange-500'
        case 'medium': return 'bg-yellow-500'
        case 'low': return 'bg-green-500'
        default: return 'bg-gray-500'
      }
    } else {
      const colors = ['bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500']
      return colors[entries.findIndex(([k]) => k === key) % colors.length]
    }
  }

  return (
    <div className="space-y-3">
      {entries.map(([key, count]) => (
        <div key={key} className="flex items-center">
          <div className="w-24 text-sm text-gray-600 capitalize">{key}</div>
          <div className="flex-1 mx-3">
            <div className="bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getColor(key, type)}`}
                style={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }}
              />
            </div>
          </div>
          <div className="w-12 text-sm text-gray-900 text-right">{count}</div>
        </div>
      ))}
    </div>
  )
}

// Circuit Breaker Table Component
function CircuitBreakerTable({ circuitBreakers }: { circuitBreakers: CircuitBreakerMetrics }) {
  const entries = Object.entries(circuitBreakers)

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No circuit breakers configured
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Service
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              State
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Failures
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Success Rate
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Last Failure
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {entries.map(([name, metrics]) => (
            <tr key={name}>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {metrics.name}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  metrics.state === 'closed' 
                    ? 'bg-green-100 text-green-800'
                    : metrics.state === 'open'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {metrics.state}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {metrics.failures}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {metrics.requestCount > 0 
                  ? `${(((metrics.requestCount - metrics.failures) / metrics.requestCount) * 100).toFixed(1)}%`
                  : 'N/A'
                }
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {metrics.lastFailureTime > 0 
                  ? new Date(metrics.lastFailureTime).toLocaleString()
                  : 'Never'
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Error Sources List Component
function ErrorSourcesList({ sources }: { sources: Record<string, number> }) {
  const entries = Object.entries(sources)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10) // Top 10 sources

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No error sources found
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {entries.map(([source, count]) => (
        <div key={source} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
          <span className="text-sm font-medium text-gray-900">{source}</span>
          <span className="text-sm text-gray-600">{count} errors</span>
        </div>
      ))}
    </div>
  )
}

// Helper functions
function getSystemHealthStatus(
  metrics: ErrorMetrics | null, 
  circuitBreakers: CircuitBreakerMetrics
): string {
  if (!metrics) return 'Unknown'
  
  const openCircuits = Object.values(circuitBreakers).filter(cb => cb.state === 'open').length
  const criticalErrors = metrics.errorsBySeverity[ErrorSeverity.CRITICAL] || 0
  
  if (openCircuits > 0 || criticalErrors > 0) return 'Unhealthy'
  if (metrics.errorRate > 5) return 'Degraded'
  return 'Healthy'
}

function getSystemHealthColor(
  metrics: ErrorMetrics | null, 
  circuitBreakers: CircuitBreakerMetrics
): 'red' | 'orange' | 'yellow' | 'green' | 'blue' {
  const status = getSystemHealthStatus(metrics, circuitBreakers)
  
  switch (status) {
    case 'Healthy': return 'green'
    case 'Degraded': return 'yellow'
    case 'Unhealthy': return 'red'
    default: return 'blue'
  }
}