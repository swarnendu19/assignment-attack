/**
 * Comprehensive Logging System
 * 
 * Provides structured logging with different levels,
 * context enrichment, and integration with monitoring services
 */

import { ErrorSeverity, ErrorCategory, BaseError } from './errorHandling'

// Log levels
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

// Log entry interface
export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: Date
  context?: Record<string, unknown>
  error?: BaseError | Error
  userId?: string
  requestId?: string
  sessionId?: string
  source: string
  tags?: string[]
  duration?: number
  metadata?: Record<string, unknown>
}

// Logger configuration
export interface LoggerConfig {
  level: LogLevel
  enableConsole: boolean
  enableFile: boolean
  enableRemote: boolean
  remoteEndpoint?: string
  remoteApiKey?: string
  maxLogSize: number
  rotationInterval: number
  enableStructuredLogging: boolean
  enablePerformanceLogging: boolean
}

// Performance metrics
export interface PerformanceMetrics {
  operation: string
  duration: number
  success: boolean
  timestamp: Date
  context?: Record<string, unknown>
}

/**
 * Main Logger Class
 */
export class Logger {
  private readonly config: LoggerConfig
  private readonly logBuffer: LogEntry[] = []
  private readonly performanceMetrics: PerformanceMetrics[] = []

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: config.level || LogLevel.INFO,
      enableConsole: config.enableConsole ?? true,
      enableFile: config.enableFile ?? false,
      enableRemote: config.enableRemote ?? false,
      remoteEndpoint: config.remoteEndpoint,
      remoteApiKey: config.remoteApiKey,
      maxLogSize: config.maxLogSize || 1000,
      rotationInterval: config.rotationInterval || 300000, // 5 minutes
      enableStructuredLogging: config.enableStructuredLogging ?? true,
      enablePerformanceLogging: config.enablePerformanceLogging ?? true
    }

    // Set up log rotation
    if (this.config.enableFile || this.config.enableRemote) {
      setInterval(() => this.flushLogs(), this.config.rotationInterval)
    }
  }

  /**
   * Debug level logging
   */
  debug(message: string, context?: Record<string, unknown>, source: string = 'application'): void {
    this.log(LogLevel.DEBUG, message, context, undefined, source)
  }

  /**
   * Info level logging
   */
  info(message: string, context?: Record<string, unknown>, source: string = 'application'): void {
    this.log(LogLevel.INFO, message, context, undefined, source)
  }

  /**
   * Warning level logging
   */
  warn(message: string, context?: Record<string, unknown>, source: string = 'application'): void {
    this.log(LogLevel.WARN, message, context, undefined, source)
  }

  /**
   * Error level logging
   */
  error(message: string, context?: Record<string, unknown>, error?: BaseError | Error, source: string = 'application'): void {
    this.log(LogLevel.ERROR, message, context, error, source)
  }

  /**
   * Fatal level logging
   */
  fatal(message: string, context?: Record<string, unknown>, error?: BaseError | Error, source: string = 'application'): void {
    this.log(LogLevel.FATAL, message, context, error, source)
  }

  /**
   * Log performance metrics
   */
  logPerformance(operation: string, duration: number, success: boolean, context?: Record<string, unknown>): void {
    if (!this.config.enablePerformanceLogging) return

    const metrics: PerformanceMetrics = {
      operation,
      duration,
      success,
      timestamp: new Date(),
      context
    }

    this.performanceMetrics.push(metrics)

    // Also log as regular entry for immediate visibility
    this.info(`Performance: ${operation}`, {
      duration,
      success,
      ...context
    }, 'performance')

    // Keep only recent metrics
    if (this.performanceMetrics.length > this.config.maxLogSize) {
      this.performanceMetrics.splice(0, this.performanceMetrics.length - this.config.maxLogSize)
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, unknown>): Logger {
    const childLogger = new Logger(this.config)
    
    // Override log method to include parent context
    const originalLog = childLogger.log.bind(childLogger)
    childLogger.log = (level, message, childContext, error, source) => {
      const mergedContext = { ...context, ...childContext }
      return originalLog(level, message, mergedContext, error, source)
    }

    return childLogger
  }

  /**
   * Time a function execution and log performance
   */
  async timeAsync<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: Record<string, unknown>
  ): Promise<T> {
    const startTime = Date.now()
    let success = false
    
    try {
      const result = await fn()
      success = true
      return result
    } catch (error) {
      this.error(`Operation failed: ${operation}`, context, error as Error)
      throw error
    } finally {
      const duration = Date.now() - startTime
      this.logPerformance(operation, duration, success, context)
    }
  }

  /**
   * Time a synchronous function execution and log performance
   */
  time<T>(
    operation: string,
    fn: () => T,
    context?: Record<string, unknown>
  ): T {
    const startTime = Date.now()
    let success = false
    
    try {
      const result = fn()
      success = true
      return result
    } catch (error) {
      this.error(`Operation failed: ${operation}`, context, error as Error)
      throw error
    } finally {
      const duration = Date.now() - startTime
      this.logPerformance(operation, duration, success, context)
    }
  }

  /**
   * Get recent performance metrics
   */
  getPerformanceMetrics(limit: number = 100): PerformanceMetrics[] {
    return this.performanceMetrics.slice(-limit)
  }

  /**
   * Get recent log entries
   */
  getRecentLogs(limit: number = 100): LogEntry[] {
    return this.logBuffer.slice(-limit)
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: BaseError | Error,
    source: string = 'application'
  ): void {
    // Check if log level is enabled
    if (!this.shouldLog(level)) return

    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context: this.enrichContext(context),
      error,
      source,
      userId: context?.userId as string,
      requestId: context?.requestId as string,
      sessionId: context?.sessionId as string,
      tags: this.generateTags(level, source, error),
      metadata: {
        nodeVersion: process.version,
        platform: process.platform,
        environment: process.env.NODE_ENV || 'development'
      }
    }

    // Add to buffer
    this.logBuffer.push(logEntry)

    // Maintain buffer size
    if (this.logBuffer.length > this.config.maxLogSize) {
      this.logBuffer.shift()
    }

    // Output to console if enabled
    if (this.config.enableConsole) {
      this.outputToConsole(logEntry)
    }

    // Handle critical errors immediately
    if (level === LogLevel.ERROR || level === LogLevel.FATAL) {
      this.handleCriticalLog(logEntry)
    }
  }

  /**
   * Check if log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.FATAL]
    const currentLevelIndex = levels.indexOf(this.config.level)
    const logLevelIndex = levels.indexOf(level)
    
    return logLevelIndex >= currentLevelIndex
  }

  /**
   * Enrich context with additional information
   */
  private enrichContext(context?: Record<string, unknown>): Record<string, unknown> {
    const enriched = {
      ...context,
      timestamp: new Date().toISOString(),
      pid: process.pid,
      memory: process.memoryUsage(),
    }

    // Add request context if available
    if (typeof window === 'undefined') {
      // Server-side context
      enriched.server = {
        uptime: process.uptime(),
        loadAverage: process.loadavg?.() || [],
      }
    } else {
      // Client-side context
      enriched.client = {
        userAgent: navigator.userAgent,
        url: window.location.href,
        referrer: document.referrer,
      }
    }

    return enriched
  }

  /**
   * Generate tags for log entry
   */
  private generateTags(level: LogLevel, source: string, error?: BaseError | Error): string[] {
    const tags = [level, source]

    if (error) {
      tags.push('error')
      
      if ('category' in error) {
        tags.push((error as BaseError).category)
      }
      
      if ('severity' in error) {
        tags.push((error as BaseError).severity)
      }
    }

    return tags
  }

  /**
   * Output log entry to console with formatting
   */
  private outputToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString()
    const level = entry.level.toUpperCase().padEnd(5)
    const source = entry.source.padEnd(15)
    
    let output = `[${timestamp}] ${level} [${source}] ${entry.message}`

    if (this.config.enableStructuredLogging && entry.context) {
      output += `\n  Context: ${JSON.stringify(entry.context, null, 2)}`
    }

    if (entry.error) {
      output += `\n  Error: ${entry.error.message}`
      if (entry.error.stack) {
        output += `\n  Stack: ${entry.error.stack}`
      }
    }

    // Use appropriate console method based on level
    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(output)
        break
      case LogLevel.INFO:
        console.info(output)
        break
      case LogLevel.WARN:
        console.warn(output)
        break
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(output)
        break
    }
  }

  /**
   * Handle critical log entries
   */
  private handleCriticalLog(entry: LogEntry): void {
    // Immediately flush critical logs
    if (this.config.enableRemote) {
      this.sendToRemoteService([entry]).catch(err => {
        console.error('Failed to send critical log to remote service:', err)
      })
    }

    // TODO: Add alerting for critical errors
    // - Send to error tracking service (Sentry, Bugsnag)
    // - Send notifications (Slack, email)
    // - Trigger incident response
  }

  /**
   * Flush logs to persistent storage or remote service
   */
  private async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0) return

    const logsToFlush = [...this.logBuffer]
    this.logBuffer.length = 0

    try {
      if (this.config.enableRemote) {
        await this.sendToRemoteService(logsToFlush)
      }

      if (this.config.enableFile) {
        await this.writeToFile(logsToFlush)
      }
    } catch (error) {
      console.error('Failed to flush logs:', error)
      // Put logs back in buffer for retry
      this.logBuffer.unshift(...logsToFlush)
    }
  }

  /**
   * Send logs to remote logging service
   */
  private async sendToRemoteService(logs: LogEntry[]): Promise<void> {
    if (!this.config.remoteEndpoint || !this.config.remoteApiKey) {
      return
    }

    try {
      const response = await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.remoteApiKey}`,
        },
        body: JSON.stringify({
          logs: logs.map(log => ({
            ...log,
            timestamp: log.timestamp.toISOString(),
          })),
        }),
      })

      if (!response.ok) {
        throw new Error(`Remote logging service responded with ${response.status}`)
      }
    } catch (error) {
      console.error('Failed to send logs to remote service:', error)
      throw error
    }
  }

  /**
   * Write logs to file (server-side only)
   */
  private async writeToFile(logs: LogEntry[]): Promise<void> {
    // This would be implemented for server-side file logging
    // For now, we'll just log to console that file logging was requested
    console.log(`Would write ${logs.length} log entries to file`)
  }
}

// Global logger instance
export const logger = new Logger({
  level: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
  enableConsole: true,
  enableRemote: process.env.REMOTE_LOGGING_ENDPOINT ? true : false,
  remoteEndpoint: process.env.REMOTE_LOGGING_ENDPOINT,
  remoteApiKey: process.env.REMOTE_LOGGING_API_KEY,
  enableStructuredLogging: true,
  enablePerformanceLogging: true,
})

// Specialized loggers for different components
export const authLogger = logger.child({ component: 'authentication' })
export const messageLogger = logger.child({ component: 'messaging' })
export const integrationLogger = logger.child({ component: 'integration' })
export const performanceLogger = logger.child({ component: 'performance' })
export const securityLogger = logger.child({ component: 'security' })