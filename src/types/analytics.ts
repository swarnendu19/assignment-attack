import { ChannelType, Direction } from '@prisma/client'
import { z } from 'zod'

// Core analytics interfaces
export interface AnalyticsMetrics {
  responseTime: ResponseTimeMetrics
  messageVolume: MessageVolumeMetrics
  engagementRates: EngagementMetrics
  conversionFunnel: ConversionFunnelMetrics
  channelPerformance: ChannelPerformanceMetrics
  teamPerformance: TeamPerformanceMetrics
}

export interface ResponseTimeMetrics {
  averageResponseTime: number // in minutes
  medianResponseTime: number // in minutes
  firstResponseTime: number // in minutes
  resolutionTime: number // in minutes
  responseTimeByChannel: Record<ChannelType, number>
  responseTimeByUser: Record<string, number>
  responseTimeTrend: TimeSeriesData[]
}

export interface MessageVolumeMetrics {
  totalMessages: number
  inboundMessages: number
  outboundMessages: number
  messagesByChannel: Record<ChannelType, number>
  messagesByUser: Record<string, number>
  messagesByHour: Record<number, number>
  messagesByDay: Record<string, number>
  volumeTrend: TimeSeriesData[]
}

export interface EngagementMetrics {
  totalConversations: number
  activeConversations: number
  averageMessagesPerConversation: number
  conversationResolutionRate: number
  customerSatisfactionScore?: number
  engagementByChannel: Record<ChannelType, EngagementChannelMetrics>
  engagementTrend: TimeSeriesData[]
}

export interface EngagementChannelMetrics {
  conversationCount: number
  averageResponseTime: number
  resolutionRate: number
  customerSatisfaction?: number
}

export interface ConversionFunnelMetrics {
  totalLeads: number
  qualifiedLeads: number
  opportunitiesCreated: number
  dealsWon: number
  conversionRates: {
    leadToQualified: number
    qualifiedToOpportunity: number
    opportunityToWon: number
    overallConversion: number
  }
  funnelByChannel: Record<ChannelType, ConversionChannelMetrics>
  conversionTrend: TimeSeriesData[]
}

export interface ConversionChannelMetrics {
  leads: number
  qualified: number
  opportunities: number
  won: number
  conversionRate: number
}

export interface ChannelPerformanceMetrics {
  channelStats: Record<ChannelType, ChannelStats>
  channelComparison: ChannelComparisonData[]
  channelTrends: Record<ChannelType, TimeSeriesData[]>
}

export interface ChannelStats {
  messageCount: number
  conversationCount: number
  averageResponseTime: number
  resolutionRate: number
  customerSatisfaction?: number
  activeUsers: number
}

export interface ChannelComparisonData {
  channel: ChannelType
  messageCount: number
  responseTime: number
  resolutionRate: number
  growth: number // percentage change
}

export interface TeamPerformanceMetrics {
  userStats: Record<string, UserStats>
  teamComparison: UserComparisonData[]
  teamTrends: Record<string, TimeSeriesData[]>
}

export interface UserStats {
  messageCount: number
  conversationCount: number
  averageResponseTime: number
  resolutionRate: number
  workloadScore: number
  activeChannels: ChannelType[]
}

export interface UserComparisonData {
  userId: string
  userName: string
  messageCount: number
  responseTime: number
  resolutionRate: number
  workloadScore: number
}

export interface TimeSeriesData {
  timestamp: Date
  value: number
  label?: string
}

// Analytics query interfaces
export interface AnalyticsQuery {
  dateRange: DateRange
  channels?: ChannelType[]
  userIds?: string[]
  teamId: string
  granularity?: 'hour' | 'day' | 'week' | 'month'
  metrics?: AnalyticsMetricType[]
}

export interface DateRange {
  startDate: Date
  endDate: Date
}

export type AnalyticsMetricType = 
  | 'responseTime'
  | 'messageVolume'
  | 'engagement'
  | 'conversion'
  | 'channelPerformance'
  | 'teamPerformance'

// Real-time analytics interfaces
export interface RealTimeMetrics {
  activeUsers: number
  activeConversations: number
  pendingMessages: number
  averageResponseTime: number
  messagesPerMinute: number
  lastUpdated: Date
}

export interface AnalyticsFilter {
  channels?: ChannelType[]
  users?: string[]
  dateRange?: DateRange
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  status?: 'ACTIVE' | 'ARCHIVED' | 'SNOOZED' | 'CLOSED'
}

// Export interfaces
export interface ExportRequest {
  format: 'csv' | 'pdf' | 'json'
  metrics: AnalyticsMetricType[]
  query: AnalyticsQuery
  includeCharts?: boolean
  fileName?: string
}

export interface ExportResult {
  fileName: string
  downloadUrl: string
  fileSize: number
  expiresAt: Date
}

// Data aggregation interfaces
export interface AggregationJob {
  id: string
  type: 'hourly' | 'daily' | 'weekly' | 'monthly'
  status: 'pending' | 'running' | 'completed' | 'failed'
  startDate: Date
  endDate: Date
  createdAt: Date
  completedAt?: Date
  error?: string
}

export interface AggregatedData {
  id: string
  type: 'hourly' | 'daily' | 'weekly' | 'monthly'
  date: Date
  teamId: string
  metrics: Record<string, number>
  metadata?: Record<string, unknown>
  createdAt: Date
}

// Validation schemas
export const DateRangeSchema = z.object({
  startDate: z.date(),
  endDate: z.date(),
}).refine(
  (data) => data.endDate >= data.startDate,
  {
    message: "End date must be after start date",
    path: ["endDate"],
  }
)

export const AnalyticsQuerySchema = z.object({
  dateRange: DateRangeSchema,
  channels: z.array(z.nativeEnum(ChannelType)).optional(),
  userIds: z.array(z.string()).optional(),
  teamId: z.string(),
  granularity: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  metrics: z.array(z.enum([
    'responseTime',
    'messageVolume',
    'engagement',
    'conversion',
    'channelPerformance',
    'teamPerformance'
  ])).optional(),
})

export const AnalyticsFilterSchema = z.object({
  channels: z.array(z.nativeEnum(ChannelType)).optional(),
  users: z.array(z.string()).optional(),
  dateRange: DateRangeSchema.optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED', 'SNOOZED', 'CLOSED']).optional(),
})

export const ExportRequestSchema = z.object({
  format: z.enum(['csv', 'pdf', 'json']),
  metrics: z.array(z.enum([
    'responseTime',
    'messageVolume',
    'engagement',
    'conversion',
    'channelPerformance',
    'teamPerformance'
  ])),
  query: AnalyticsQuerySchema,
  includeCharts: z.boolean().default(false),
  fileName: z.string().optional(),
})

// Type exports for validation
export type AnalyticsQuery_Validated = z.infer<typeof AnalyticsQuerySchema>
export type AnalyticsFilter_Validated = z.infer<typeof AnalyticsFilterSchema>
export type ExportRequest_Validated = z.infer<typeof ExportRequestSchema>