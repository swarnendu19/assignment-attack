/**
 * Error Reporting and Alerting System
 * 
 * Handles error escalation, notification, and integration
 * with external monitoring services
 */

import { 
  BaseError, 
  RecoverableError, 
  ErrorSeverity, 
  ErrorCategory,
  UserErrorMessage,
  UserErrorMessageGenerator 
} from './errorHandling'
import { logger } from './logger'

// Alert configuration
export interface AlertConfig {
  enabled: boolean
  channels: AlertChannel[]
  thresholds: AlertThresholds
  escalationRules: EscalationRule[]
  suppressionRules: SuppressionRule[]
}

// Alert channels
export enum AlertChannelType {
  EMAIL = 'email',
  SLACK = 'slack',
  WEBHOOK = 'webhook',
  SMS = 'sms',
  PUSH = 'push'
}

export interface AlertChannel {
  type: AlertChannelType
  config: Record<string, unknown>
  enabled: boolean
  severityFilter: ErrorSeverity[]
}

// Alert thresholds
export interface AlertThresholds {
  errorRate: {
    threshold: number
    timeWindow: number // minutes
  }
  responseTime: {
    threshold: number // milliseconds
    timeWindow: number // minutes
  }
  failureCount: {
    threshold: number
    timeWindow: number // minutes
  }
}

// Escalation rules
export interface EscalationRule {
  condition: EscalationCondition
  action: EscalationAction
  delay: number // minutes
}

export interface EscalationCondition {
  errorCount?: number
  severity?: ErrorSeverity
  category?: ErrorCategory
  timeWindow?: number // minutes
  services?: string[]
}

export interface EscalationAction {
  type: 'notify' | 'create_incident' | 'auto_resolve' | 'scale_service'
  config: Record<string, unknown>
}

// Suppression rules
export interface SuppressionRule {
  condition: SuppressionCondition
  duration: number // minutes
  reason: string
}

export interface SuppressionCondition {
  errorCode?: string
  category?: ErrorCategory
  source?: string
  pattern?: string
}

// Error metrics
export interface ErrorMetrics {
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

// Incident interface
export interface Incident {
  id: string
  title: string
  description: string
  severity: ErrorSeverity
  status: 'open' | 'investigating' | 'resolved' | 'closed'
  createdAt: Date
  updatedAt: Date
  resolvedAt?: Date
  assignee?: string
  errors: BaseError[]
  tags: string[]
  metadata: Record<string, unknown>
}

/**
 * Error Metrics Collector
 */
export class ErrorMetricsCollector {
  private readonly errors: BaseError[] = []
  private readonly maxHistorySize: number = 10000

  /**
   * Record an error for metrics
   */
  recordError(error: BaseError): void {
    this.errors.push(error)

    // Maintain history size
    if (this.errors.length > this.maxHistorySize) {
      this.errors.shift()
    }

    logger.debug('Error recorded for metrics', {
      errorId: error.id,
      code: error.code,
      category: error.category,
      severity: error.severity
    })
  }

  /**
   * Get error metrics for a time window
   */
  getMetrics(timeWindowMinutes: number = 60): ErrorMetrics {
    const now = new Date()
    const windowStart = new Date(now.getTime() - timeWindowMinutes * 60 * 1000)
    
    const windowErrors = this.errors.filter(
      error => error.timestamp >= windowStart
    )

    const errorsByCategory = this.groupBy(windowErrors, 'category')
    const errorsBySeverity = this.groupBy(windowErrors, 'severity')
    const errorsBySource = this.groupBy(windowErrors, 'source')

    return {
      totalErrors: windowErrors.length,
      errorsByCategory,
      errorsBySeverity,
      errorsBySource,
      errorRate: windowErrors.length / timeWindowMinutes,
      averageResolutionTime: this.calculateAverageResolutionTime(windowErrors),
      timeWindow: {
        start: windowStart,
        end: now
      }
    }
  }

  /**
   * Get error trends
   */
  getErrorTrends(hours: number = 24): Array<{ timestamp: Date; count: number }> {
    const now = new Date()
    const trends: Array<{ timestamp: Date; count: number }> = []

    for (let i = hours; i >= 0; i--) {
      const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000)
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000)
      
      const hourErrors = this.errors.filter(
        error => error.timestamp >= hourStart && error.timestamp < hourEnd
      )

      trends.push({
        timestamp: hourStart,
        count: hourErrors.length
      })
    }

    return trends
  }

  private groupBy<T extends BaseError>(
    errors: T[], 
    key: keyof T
  ): Record<string, number> {
    return errors.reduce((acc, error) => {
      const value = String(error[key])
      acc[value] = (acc[value] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }

  private calculateAverageResolutionTime(errors: BaseError[]): number {
    // For now, return 0 as we don't track resolution times yet
    // This would be enhanced to track actual resolution times
    return 0
  }
}

/**
 * Alert Manager
 */
export class AlertManager {
  private readonly config: AlertConfig
  private readonly suppressedAlerts: Set<string> = new Set()
  private readonly activeIncidents: Map<string, Incident> = new Map()

  constructor(config: AlertConfig) {
    this.config = config
  }

  /**
   * Process an error and determine if alerts should be sent
   */
  async processError(error: BaseError): Promise<void> {
    if (!this.config.enabled) return

    // Check suppression rules
    if (this.isErrorSuppressed(error)) {
      logger.debug('Error suppressed by rules', {
        errorId: error.id,
        code: error.code
      })
      return
    }

    // Check if alert should be sent based on severity
    const shouldAlert = this.shouldSendAlert(error)
    
    if (shouldAlert) {
      await this.sendAlert(error)
    }

    // Check escalation rules
    await this.checkEscalationRules(error)
  }

  /**
   * Send alert through configured channels
   */
  private async sendAlert(error: BaseError): Promise<void> {
    const userMessage = UserErrorMessageGenerator.generateUserMessage(error)
    
    for (const channel of this.config.channels) {
      if (!channel.enabled) continue
      
      if (!channel.severityFilter.includes(error.severity)) continue

      try {
        await this.sendAlertToChannel(channel, error, userMessage)
        
        logger.info('Alert sent successfully', {
          errorId: error.id,
          channel: channel.type,
          severity: error.severity
        })
      } catch (alertError) {
        logger.error('Failed to send alert', {
          errorId: error.id,
          channel: channel.type,
          error: alertError instanceof Error ? alertError.message : alertError
        })
      }
    }
  }

  /**
   * Send alert to specific channel
   */
  private async sendAlertToChannel(
    channel: AlertChannel,
    error: BaseError,
    userMessage: UserErrorMessage
  ): Promise<void> {
    switch (channel.type) {
      case AlertChannelType.EMAIL:
        await this.sendEmailAlert(channel.config, error, userMessage)
        break
      
      case AlertChannelType.SLACK:
        await this.sendSlackAlert(channel.config, error, userMessage)
        break
      
      case AlertChannelType.WEBHOOK:
        await this.sendWebhookAlert(channel.config, error, userMessage)
        break
      
      case AlertChannelType.SMS:
        await this.sendSMSAlert(channel.config, error, userMessage)
        break
      
      default:
        logger.warn('Unsupported alert channel type', { type: channel.type })
    }
  }

  /**
   * Check if error should trigger an alert
   */
  private shouldSendAlert(error: BaseError): boolean {
    // Always alert on critical errors
    if (error.severity === ErrorSeverity.CRITICAL) {
      return true
    }

    // Alert on high severity errors during business hours
    if (error.severity === ErrorSeverity.HIGH) {
      return this.isBusinessHours()
    }

    // Alert on medium severity if error rate is high
    if (error.severity === ErrorSeverity.MEDIUM) {
      return this.isErrorRateHigh()
    }

    return false
  }

  /**
   * Check if error is suppressed by rules
   */
  private isErrorSuppressed(error: BaseError): boolean {
    for (const rule of this.config.suppressionRules) {
      if (this.matchesSuppressionRule(error, rule)) {
        return true
      }
    }
    return false
  }

  /**
   * Check escalation rules and take action
   */
  private async checkEscalationRules(error: BaseError): Promise<void> {
    for (const rule of this.config.escalationRules) {
      if (this.matchesEscalationCondition(error, rule.condition)) {
        await this.executeEscalationAction(rule.action, error)
      }
    }
  }

  /**
   * Execute escalation action
   */
  private async executeEscalationAction(
    action: EscalationAction,
    error: BaseError
  ): Promise<void> {
    switch (action.type) {
      case 'create_incident':
        await this.createIncident(error, action.config)
        break
      
      case 'notify':
        await this.sendEscalationNotification(error, action.config)
        break
      
      case 'auto_resolve':
        await this.attemptAutoResolve(error, action.config)
        break
      
      default:
        logger.warn('Unsupported escalation action', { type: action.type })
    }
  }

  /**
   * Create incident from error
   */
  private async createIncident(error: BaseError, config: Record<string, unknown>): Promise<void> {
    const incident: Incident = {
      id: `inc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: `${error.category.toUpperCase()}: ${error.message}`,
      description: `Error ${error.code} occurred in ${error.source}`,
      severity: error.severity,
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
      errors: [error],
      tags: [error.category, error.source],
      metadata: { ...error.context, config }
    }

    this.activeIncidents.set(incident.id, incident)

    logger.info('Incident created', {
      incidentId: incident.id,
      errorId: error.id,
      severity: error.severity
    })
  }

  // Alert channel implementations
  private async sendEmailAlert(
    config: Record<string, unknown>,
    error: BaseError,
    userMessage: UserErrorMessage
  ): Promise<void> {
    // Email alert implementation would go here
    logger.info('Email alert would be sent', {
      to: config.recipients,
      subject: userMessage.title,
      errorId: error.id
    })
  }

  private async sendSlackAlert(
    config: Record<string, unknown>,
    error: BaseError,
    userMessage: UserErrorMessage
  ): Promise<void> {
    // Slack alert implementation would go here
    logger.info('Slack alert would be sent', {
      channel: config.channel,
      message: userMessage.message,
      errorId: error.id
    })
  }

  private async sendWebhookAlert(
    config: Record<string, unknown>,
    error: BaseError,
    userMessage: UserErrorMessage
  ): Promise<void> {
    try {
      const response = await fetch(config.url as string, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.headers as Record<string, string> || {})
        },
        body: JSON.stringify({
          error,
          userMessage,
          timestamp: new Date().toISOString()
        })
      })

      if (!response.ok) {
        throw new Error(`Webhook responded with ${response.status}`)
      }
    } catch (webhookError) {
      logger.error('Webhook alert failed', {
        url: config.url,
        error: webhookError instanceof Error ? webhookError.message : webhookError
      })
      throw webhookError
    }
  }

  private async sendSMSAlert(
    config: Record<string, unknown>,
    error: BaseError,
    userMessage: UserErrorMessage
  ): Promise<void> {
    // SMS alert implementation would go here
    logger.info('SMS alert would be sent', {
      to: config.phoneNumbers,
      message: userMessage.message,
      errorId: error.id
    })
  }

  // Helper methods
  private matchesSuppressionRule(error: BaseError, rule: SuppressionRule): boolean {
    const condition = rule.condition
    
    if (condition.errorCode && condition.errorCode !== error.code) return false
    if (condition.category && condition.category !== error.category) return false
    if (condition.source && condition.source !== error.source) return false
    
    return true
  }

  private matchesEscalationCondition(error: BaseError, condition: EscalationCondition): boolean {
    if (condition.severity && condition.severity !== error.severity) return false
    if (condition.category && condition.category !== error.category) return false
    
    return true
  }

  private isBusinessHours(): boolean {
    const now = new Date()
    const hour = now.getHours()
    const day = now.getDay()
    
    // Business hours: Monday-Friday, 9 AM - 5 PM
    return day >= 1 && day <= 5 && hour >= 9 && hour < 17
  }

  private isErrorRateHigh(): boolean {
    // This would check current error rate against thresholds
    // For now, return false
    return false
  }

  private async sendEscalationNotification(
    error: BaseError,
    config: Record<string, unknown>
  ): Promise<void> {
    logger.info('Escalation notification would be sent', {
      errorId: error.id,
      config
    })
  }

  private async attemptAutoResolve(
    error: BaseError,
    config: Record<string, unknown>
  ): Promise<void> {
    logger.info('Auto-resolve would be attempted', {
      errorId: error.id,
      config
    })
  }
}

/**
 * Error Reporting Service
 */
export class ErrorReportingService {
  private readonly metricsCollector: ErrorMetricsCollector
  private readonly alertManager: AlertManager

  constructor(alertConfig: AlertConfig) {
    this.metricsCollector = new ErrorMetricsCollector()
    this.alertManager = new AlertManager(alertConfig)
  }

  /**
   * Report an error to the system
   */
  async reportError(error: BaseError): Promise<void> {
    try {
      // Record error for metrics
      this.metricsCollector.recordError(error)

      // Process for alerts
      await this.alertManager.processError(error)

      // Log the error reporting
      logger.info('Error reported successfully', {
        errorId: error.id,
        code: error.code,
        severity: error.severity,
        category: error.category
      })
    } catch (reportingError) {
      logger.error('Failed to report error', {
        originalError: error.message,
        reportingError: reportingError instanceof Error ? reportingError.message : reportingError
      })
    }
  }

  /**
   * Get error metrics
   */
  getMetrics(timeWindowMinutes?: number): ErrorMetrics {
    return this.metricsCollector.getMetrics(timeWindowMinutes)
  }

  /**
   * Get error trends
   */
  getErrorTrends(hours?: number): Array<{ timestamp: Date; count: number }> {
    return this.metricsCollector.getErrorTrends(hours)
  }
}

// Default alert configuration
const defaultAlertConfig: AlertConfig = {
  enabled: process.env.NODE_ENV === 'production',
  channels: [
    {
      type: AlertChannelType.WEBHOOK,
      config: {
        url: process.env.ERROR_WEBHOOK_URL || 'https://hooks.slack.com/services/...'
      },
      enabled: !!process.env.ERROR_WEBHOOK_URL,
      severityFilter: [ErrorSeverity.HIGH, ErrorSeverity.CRITICAL]
    }
  ],
  thresholds: {
    errorRate: { threshold: 10, timeWindow: 5 },
    responseTime: { threshold: 5000, timeWindow: 5 },
    failureCount: { threshold: 50, timeWindow: 10 }
  },
  escalationRules: [
    {
      condition: { severity: ErrorSeverity.CRITICAL },
      action: { type: 'create_incident', config: {} },
      delay: 0
    }
  ],
  suppressionRules: []
}

// Global error reporting service
export const errorReportingService = new ErrorReportingService(defaultAlertConfig)