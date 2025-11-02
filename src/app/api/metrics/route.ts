import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface Metrics {
  // Application metrics
  app_info: {
    version: string
    uptime_seconds: number
    node_version: string
  }
  
  // Performance metrics
  memory_usage_bytes: number
  memory_usage_percentage: number
  cpu_usage_percentage: number
  
  // Business metrics
  total_messages: number
  messages_last_24h: number
  active_conversations: number
  total_contacts: number
  
  // Channel metrics
  messages_by_channel: Record<string, number>
  
  // Error metrics
  webhook_failures_total: number
  message_delivery_failures_total: number
  
  // Response time metrics (simplified)
  avg_response_time_ms: number
}

const startTime = Date.now()

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    
    // Get memory usage
    const memUsage = process.memoryUsage()
    
    // Get database metrics
    const [
      totalMessages,
      messagesLast24h,
      activeConversations,
      totalContacts,
      messagesByChannel,
    ] = await Promise.all([
      // Total messages
      prisma.message.count(),
      
      // Messages in last 24 hours
      prisma.message.count({
        where: {
          timestamp: {
            gte: yesterday,
          },
        },
      }),
      
      // Active conversations (conversations with messages in last 7 days)
      prisma.message.groupBy({
        by: ['contactId'],
        where: {
          timestamp: {
            gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }).then(result => result.length),
      
      // Total contacts
      prisma.contact.count(),
      
      // Messages by channel
      prisma.message.groupBy({
        by: ['channel'],
        _count: {
          id: true,
        },
        where: {
          timestamp: {
            gte: yesterday,
          },
        },
      }),
    ])

    // Transform channel data
    const channelMetrics = messagesByChannel.reduce((acc, item) => {
      acc[item.channel] = item._count.id
      return acc
    }, {} as Record<string, number>)

    // Get error metrics (simplified - in production you'd track these in Redis or a metrics store)
    const webhookFailures = 0 // This would be tracked in your error handling
    const deliveryFailures = 0 // This would be tracked in your message sending logic

    const metrics: Metrics = {
      app_info: {
        version: process.env.npm_package_version || '1.0.0',
        uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
        node_version: process.version,
      },
      memory_usage_bytes: memUsage.heapUsed,
      memory_usage_percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      cpu_usage_percentage: 0, // Would need additional monitoring for accurate CPU usage
      total_messages: totalMessages,
      messages_last_24h: messagesLast24h,
      active_conversations: activeConversations,
      total_contacts: totalContacts,
      messages_by_channel: channelMetrics,
      webhook_failures_total: webhookFailures,
      message_delivery_failures_total: deliveryFailures,
      avg_response_time_ms: 0, // Would be calculated from request timing middleware
    }

    // Format as Prometheus metrics
    const prometheusMetrics = formatPrometheusMetrics(metrics)
    
    return new NextResponse(prometheusMetrics, {
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      },
    })
  } catch (error) {
    console.error('Metrics collection error:', error)
    return new NextResponse('Error collecting metrics', { status: 500 })
  }
}

function formatPrometheusMetrics(metrics: Metrics): string {
  const lines: string[] = []
  
  // App info
  lines.push(`# HELP app_info Application information`)
  lines.push(`# TYPE app_info gauge`)
  lines.push(`app_info{version="${metrics.app_info.version}",node_version="${metrics.app_info.node_version}"} 1`)
  
  // Uptime
  lines.push(`# HELP app_uptime_seconds Application uptime in seconds`)
  lines.push(`# TYPE app_uptime_seconds counter`)
  lines.push(`app_uptime_seconds ${metrics.app_info.uptime_seconds}`)
  
  // Memory usage
  lines.push(`# HELP memory_usage_bytes Memory usage in bytes`)
  lines.push(`# TYPE memory_usage_bytes gauge`)
  lines.push(`memory_usage_bytes ${metrics.memory_usage_bytes}`)
  
  lines.push(`# HELP memory_usage_percentage Memory usage percentage`)
  lines.push(`# TYPE memory_usage_percentage gauge`)
  lines.push(`memory_usage_percentage ${metrics.memory_usage_percentage}`)
  
  // Business metrics
  lines.push(`# HELP total_messages Total number of messages`)
  lines.push(`# TYPE total_messages counter`)
  lines.push(`total_messages ${metrics.total_messages}`)
  
  lines.push(`# HELP messages_last_24h Messages in the last 24 hours`)
  lines.push(`# TYPE messages_last_24h gauge`)
  lines.push(`messages_last_24h ${metrics.messages_last_24h}`)
  
  lines.push(`# HELP active_conversations Number of active conversations`)
  lines.push(`# TYPE active_conversations gauge`)
  lines.push(`active_conversations ${metrics.active_conversations}`)
  
  lines.push(`# HELP total_contacts Total number of contacts`)
  lines.push(`# TYPE total_contacts counter`)
  lines.push(`total_contacts ${metrics.total_contacts}`)
  
  // Channel metrics
  lines.push(`# HELP messages_by_channel Messages by channel in last 24h`)
  lines.push(`# TYPE messages_by_channel gauge`)
  Object.entries(metrics.messages_by_channel).forEach(([channel, count]) => {
    lines.push(`messages_by_channel{channel="${channel}"} ${count}`)
  })
  
  // Error metrics
  lines.push(`# HELP webhook_failures_total Total webhook failures`)
  lines.push(`# TYPE webhook_failures_total counter`)
  lines.push(`webhook_failures_total ${metrics.webhook_failures_total}`)
  
  lines.push(`# HELP message_delivery_failures_total Total message delivery failures`)
  lines.push(`# TYPE message_delivery_failures_total counter`)
  lines.push(`message_delivery_failures_total ${metrics.message_delivery_failures_total}`)
  
  return lines.join('\n') + '\n'
}