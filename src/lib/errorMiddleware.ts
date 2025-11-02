/**
 * Error Handling Middleware for API Routes
 * 
 * Provides comprehensive error handling for Next.js API routes
 * with automatic error recovery, logging, and user-friendly responses
 */

import { NextRequest, NextResponse } from 'next/server'
import { 
  BaseError, 
  ErrorFactory, 
  ErrorCategory, 
  ErrorSeverity,
  UserErrorMessageGenerator 
} from './errorHandling'
import { errorRecoveryManager } from './errorRecovery'
import { errorReportingService } from './errorReporting'
import { logger } from './logger'

// API Error response interface
export interface ApiErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
    userMessage: string
    timestamp: string
    requestId: string
  }
  recovery?: {
    canRetry: boolean
    retryAfter?: number
    suggestions: string[]
  }
}

// API Success response interface
export interface ApiSuccessResponse<T = unknown> {
  success: true
  data: T
  metadata?: {
    timestamp: string
    requestId: string
    processingTime: number
  }
}

// Middleware configuration
export interface ErrorMiddlewareConfig {
  enableRecovery: boolean
  enableMetrics: boolean
  enableUserFriendlyMessages: boolean
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  includeStackTrace: boolean
}

// Request context for error handling
export interface RequestContext {
  requestId: string
  userId?: string
  sessionId?: string
  userAgent?: string
  ip?: string
  method: string
  url: string
  startTime: number
}

/**
 * API Route Handler Type
 */
export type ApiRouteHandler<T = unknown> = (
  request: NextRequest,
  context: RequestContext
) => Promise<T>

/**
 * Error Handling Middleware
 */
export class ErrorMiddleware {
  private readonly config: ErrorMiddlewareConfig

  constructor(config: Partial<ErrorMiddlewareConfig> = {}) {
    this.config = {
      enableRecovery: config.enableRecovery ?? true,
      enableMetrics: config.enableMetrics ?? true,
      enableUserFriendlyMessages: config.enableUserFriendlyMessages ?? true,
      logLevel: config.logLevel || 'error',
      includeStackTrace: config.includeStackTrace ?? (process.env.NODE_ENV === 'development')
    }
  }

  /**
   * Wrap an API route handler with error handling
   */
  wrap<T>(handler: ApiRouteHandler<T>) {
    return async (request: NextRequest): Promise<NextResponse> => {
      const context = this.createRequestContext(request)
      
      try {
        // Log request start
        logger.info('API request started', {
          requestId: context.requestId,
          method: context.method,
          url: context.url,
          userAgent: context.userAgent,
          ip: context.ip
        })

        // Execute the handler
        const result = await this.executeWithErrorHandling(handler, request, context)
        
        // Create success response
        const response = this.createSuccessResponse(result, context)
        
        // Log successful completion
        logger.info('API request completed successfully', {
          requestId: context.requestId,
          processingTime: Date.now() - context.startTime,
          method: context.method,
          url: context.url
        })

        return NextResponse.json(response)
      } catch (error) {
        return this.handleError(error, context)
      }
    }
  }

  /**
   * Execute handler with error recovery
   */
  private async executeWithErrorHandling<T>(
    handler: ApiRouteHandler<T>,
    request: NextRequest,
    context: RequestContext
  ): Promise<T> {
    if (!this.config.enableRecovery) {
      return handler(request, context)
    }

    const operation = () => handler(request, context)
    
    try {
      return await operation()
    } catch (error) {
      // Create recoverable error
      const recoverableError = this.createRecoverableError(error, context)
      
      // Attempt recovery
      const recoveryResult = await errorRecoveryManager.executeWithRecovery(
        operation,
        recoverableError,
        this.getServiceName(context.url),
        `api_${context.method.toLowerCase()}_${context.url}`
      )

      if (recoveryResult.success) {
        logger.info('API request recovered successfully', {
          requestId: context.requestId,
          strategy: recoveryResult.strategy,
          attempts: recoveryResult.attempts
        })
        
        return recoveryResult.recoveredValue as T
      } else {
        // Recovery failed, throw the original error
        throw recoveryResult.finalError || error
      }
    }
  }

  /**
   * Handle errors and create error responses
   */
  private async handleError(error: unknown, context: RequestContext): Promise<NextResponse> {
    const structuredError = this.createStructuredError(error, context)
    
    // Report error to monitoring systems
    await errorReportingService.reportError(structuredError)
    
    // Log error
    logger.error('API request failed', {
      requestId: context.requestId,
      errorId: structuredError.id,
      code: structuredError.code,
      message: structuredError.message,
      processingTime: Date.now() - context.startTime,
      method: context.method,
      url: context.url
    }, structuredError)

    // Create error response
    const errorResponse = this.createErrorResponse(structuredError, context)
    
    // Determine HTTP status code
    const statusCode = this.getHttpStatusCode(structuredError)
    
    return NextResponse.json(errorResponse, { status: statusCode })
  }

  /**
   * Create structured error from unknown error
   */
  private createStructuredError(error: unknown, context: RequestContext): BaseError {
    if (error instanceof Error && 'code' in error && 'category' in error) {
      // Already a structured error
      return error as BaseError
    }

    if (error instanceof Error) {
      // Convert regular Error to structured error
      return ErrorFactory.createError(
        'API_001',
        error.message || 'An unexpected error occurred',
        this.categorizeError(error),
        this.determineSeverity(error),
        'api_route',
        {
          stack: error.stack,
          name: error.name,
          requestId: context.requestId,
          method: context.method,
          url: context.url,
          userId: context.userId
        }
      )
    }

    // Unknown error type
    return ErrorFactory.createError(
      'API_002',
      'An unknown error occurred',
      ErrorCategory.UNKNOWN,
      ErrorSeverity.HIGH,
      'api_route',
      {
        error: String(error),
        requestId: context.requestId,
        method: context.method,
        url: context.url
      }
    )
  }

  /**
   * Create recoverable error for recovery attempts
   */
  private createRecoverableError(error: unknown, context: RequestContext) {
    const baseError = this.createStructuredError(error, context)
    
    return ErrorFactory.createRecoverableError(
      baseError,
      this.determineRecoveryStrategy(baseError),
      {
        maxRetries: this.getMaxRetries(baseError),
        retryAfter: this.getRetryDelay(baseError)
      }
    )
  }

  /**
   * Create success response
   */
  private createSuccessResponse<T>(data: T, context: RequestContext): ApiSuccessResponse<T> {
    const response: ApiSuccessResponse<T> = {
      success: true,
      data
    }

    if (this.config.enableMetrics) {
      response.metadata = {
        timestamp: new Date().toISOString(),
        requestId: context.requestId,
        processingTime: Date.now() - context.startTime
      }
    }

    return response
  }

  /**
   * Create error response
   */
  private createErrorResponse(error: BaseError, context: RequestContext): ApiErrorResponse {
    const userMessage = this.config.enableUserFriendlyMessages
      ? UserErrorMessageGenerator.generateUserMessage(error)
      : { title: 'Error', message: error.message, actionable: false, severity: error.severity }

    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        userMessage: userMessage.message,
        timestamp: error.timestamp.toISOString(),
        requestId: context.requestId
      }
    }

    // Add details in development mode
    if (this.config.includeStackTrace && error.stack) {
      response.error.details = {
        stack: error.stack,
        context: error.context
      }
    }

    // Add recovery suggestions
    if (userMessage.actionable && userMessage.actions) {
      response.recovery = {
        canRetry: userMessage.actions.some(action => action.action === 'retry'),
        suggestions: userMessage.actions.map(action => action.label)
      }
    }

    return response
  }

  /**
   * Create request context
   */
  private createRequestContext(request: NextRequest): RequestContext {
    const requestId = this.generateRequestId()
    
    return {
      requestId,
      method: request.method,
      url: request.url,
      userAgent: request.headers.get('user-agent') || undefined,
      ip: this.getClientIP(request),
      startTime: Date.now()
    }
  }

  /**
   * Categorize error based on error properties
   */
  private categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase()
    
    if (message.includes('unauthorized') || message.includes('authentication')) {
      return ErrorCategory.AUTHENTICATION
    }
    
    if (message.includes('forbidden') || message.includes('permission')) {
      return ErrorCategory.AUTHORIZATION
    }
    
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorCategory.VALIDATION
    }
    
    if (message.includes('network') || message.includes('connection')) {
      return ErrorCategory.NETWORK
    }
    
    if (message.includes('database') || message.includes('prisma')) {
      return ErrorCategory.DATABASE
    }
    
    if (message.includes('timeout')) {
      return ErrorCategory.TIMEOUT
    }
    
    return ErrorCategory.SYSTEM
  }

  /**
   * Determine error severity
   */
  private determineSeverity(error: Error): ErrorSeverity {
    const message = error.message.toLowerCase()
    
    if (message.includes('critical') || message.includes('fatal')) {
      return ErrorSeverity.CRITICAL
    }
    
    if (message.includes('database') || message.includes('connection')) {
      return ErrorSeverity.HIGH
    }
    
    if (message.includes('validation') || message.includes('unauthorized')) {
      return ErrorSeverity.MEDIUM
    }
    
    return ErrorSeverity.HIGH // Default to high for API errors
  }

  /**
   * Determine recovery strategy
   */
  private determineRecoveryStrategy(error: BaseError) {
    switch (error.category) {
      case ErrorCategory.NETWORK:
      case ErrorCategory.TIMEOUT:
        return 'retry'
      case ErrorCategory.DATABASE:
        return 'circuit_breaker'
      case ErrorCategory.INTEGRATION:
        return 'fallback'
      case ErrorCategory.AUTHENTICATION:
      case ErrorCategory.AUTHORIZATION:
        return 'escalate'
      default:
        return 'retry'
    }
  }

  /**
   * Get max retries based on error type
   */
  private getMaxRetries(error: BaseError): number {
    switch (error.category) {
      case ErrorCategory.NETWORK:
        return 3
      case ErrorCategory.DATABASE:
        return 2
      case ErrorCategory.INTEGRATION:
        return 2
      default:
        return 1
    }
  }

  /**
   * Get retry delay based on error type
   */
  private getRetryDelay(error: BaseError): number {
    switch (error.category) {
      case ErrorCategory.NETWORK:
        return 2000
      case ErrorCategory.DATABASE:
        return 5000
      case ErrorCategory.INTEGRATION:
        return 3000
      default:
        return 1000
    }
  }

  /**
   * Get HTTP status code for error
   */
  private getHttpStatusCode(error: BaseError): number {
    switch (error.category) {
      case ErrorCategory.AUTHENTICATION:
        return 401
      case ErrorCategory.AUTHORIZATION:
        return 403
      case ErrorCategory.VALIDATION:
        return 400
      case ErrorCategory.RATE_LIMIT:
        return 429
      case ErrorCategory.TIMEOUT:
        return 408
      case ErrorCategory.DATABASE:
      case ErrorCategory.INTEGRATION:
        return 503
      default:
        return 500
    }
  }

  /**
   * Extract service name from URL
   */
  private getServiceName(url: string): string {
    const pathSegments = new URL(url).pathname.split('/').filter(Boolean)
    return pathSegments[1] || 'api'
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get client IP address
   */
  private getClientIP(request: NextRequest): string | undefined {
    return (
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      request.headers.get('cf-connecting-ip') ||
      undefined
    )
  }
}

// Global error middleware instance
export const errorMiddleware = new ErrorMiddleware({
  enableRecovery: true,
  enableMetrics: true,
  enableUserFriendlyMessages: true,
  logLevel: 'error',
  includeStackTrace: process.env.NODE_ENV === 'development'
})

/**
 * Convenience function to wrap API route handlers
 */
export function withErrorHandling<T>(handler: ApiRouteHandler<T>) {
  return errorMiddleware.wrap(handler)
}

/**
 * Async error handler for use in try-catch blocks
 */
export async function handleAsyncError<T>(
  operation: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    const structuredError = ErrorFactory.createError(
      'ASYNC_001',
      error instanceof Error ? error.message : 'Async operation failed',
      ErrorCategory.SYSTEM,
      ErrorSeverity.MEDIUM,
      'async_operation',
      {
        ...context,
        stack: error instanceof Error ? error.stack : undefined
      }
    )

    await errorReportingService.reportError(structuredError)
    throw structuredError
  }
}