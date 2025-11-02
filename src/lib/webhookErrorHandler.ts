import { NextResponse } from 'next/server'
import { 
  BaseError, 
  ErrorFactory, 
  ErrorCategory, 
  ErrorSeverity,
  RecoverableError,
  RecoveryStrategy 
} from './errorHandling'
import { errorRecoveryManager } from './errorRecovery'
import { errorReportingService } from './errorReporting'
import { logger } from './logger'

export interface WebhookError extends BaseError {
  source: 'twilio' | 'email' | 'social' | 'internal'
}

export interface WebhookErrorResponse {
  error: string
  code?: string
  timestamp: string
  requestId?: string
}

/**
 * Webhook error types
 */
export enum WebhookErrorCode {
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  MISSING_PAYLOAD = 'MISSING_PAYLOAD',
  INVALID_PAYLOAD = 'INVALID_PAYLOAD',
  PROCESSING_FAILED = 'PROCESSING_FAILED',
  RATE_LIMITED = 'RATE_LIMITED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
}

/**
 * Create standardized webhook error response
 */
export function createWebhookErrorResponse(
  error: WebhookError,
  requestId?: string
): NextResponse {
  const response: WebhookErrorResponse = {
    error: error.message,
    code: error.code,
    timestamp: error.timestamp.toISOString(),
    requestId,
  }

  // Report error to monitoring system
  errorReportingService.reportError(error)

  // Determine HTTP status code based on error type
  let statusCode = 500

  switch (error.code) {
    case WebhookErrorCode.INVALID_SIGNATURE:
    case WebhookErrorCode.AUTHENTICATION_FAILED:
      statusCode = 401
      break
    case WebhookErrorCode.MISSING_PAYLOAD:
    case WebhookErrorCode.INVALID_PAYLOAD:
    case WebhookErrorCode.VALIDATION_FAILED:
      statusCode = 400
      break
    case WebhookErrorCode.RATE_LIMITED:
      statusCode = 429
      break
    case WebhookErrorCode.SERVICE_UNAVAILABLE:
      statusCode = 503
      break
    case WebhookErrorCode.PROCESSING_FAILED:
    default:
      statusCode = 500
      break
  }

  return NextResponse.json(response, { status: statusCode })
}

/**
 * Log webhook errors with structured format
 */
export function logWebhookError(error: WebhookError, context?: any): void {
  // Use the comprehensive logging system
  logger.error('Webhook error occurred', {
    ...context,
    source: error.source,
    code: error.code,
    details: error.context,
    requestId: context?.requestId
  }, error)
}

/**
 * Webhook error handler class
 */
export class WebhookErrorHandler {
  private readonly source: WebhookError['source']

  constructor(source: WebhookError['source']) {
    this.source = source
  }

  /**
   * Handle and format webhook errors
   */
  handleError(
    code: WebhookErrorCode,
    message: string,
    details?: any,
    requestId?: string
  ): NextResponse {
    const error: WebhookError = ErrorFactory.createError(
      code,
      message,
      this.mapCodeToCategory(code),
      this.mapCodeToSeverity(code),
      this.source,
      { details, requestId }
    ) as WebhookError

    // Log the error
    logWebhookError(error, { requestId })

    // Return formatted response
    return createWebhookErrorResponse(error, requestId)
  }

  /**
   * Handle webhook errors with recovery
   */
  async handleErrorWithRecovery<T>(
    code: WebhookErrorCode,
    message: string,
    operation: () => Promise<T>,
    details?: any,
    requestId?: string
  ): Promise<T | NextResponse> {
    const recoverableError = ErrorFactory.createRecoverableError(
      ErrorFactory.createError(
        code,
        message,
        this.mapCodeToCategory(code),
        this.mapCodeToSeverity(code),
        this.source,
        { details, requestId }
      ),
      this.mapCodeToRecoveryStrategy(code),
      {
        maxRetries: this.getMaxRetries(code),
        retryAfter: this.getRetryDelay(code)
      }
    )

    try {
      const result = await errorRecoveryManager.executeWithRecovery(
        operation,
        recoverableError,
        this.source,
        `webhook_${code}`
      )

      if (result.success) {
        return result.recoveredValue as T
      } else {
        return this.handleError(code, message, details, requestId)
      }
    } catch (error) {
      return this.handleError(code, message, details, requestId)
    }
  }

  private mapCodeToCategory(code: WebhookErrorCode): ErrorCategory {
    switch (code) {
      case WebhookErrorCode.INVALID_SIGNATURE:
      case WebhookErrorCode.AUTHENTICATION_FAILED:
        return ErrorCategory.AUTHENTICATION
      case WebhookErrorCode.MISSING_PAYLOAD:
      case WebhookErrorCode.INVALID_PAYLOAD:
      case WebhookErrorCode.VALIDATION_FAILED:
        return ErrorCategory.VALIDATION
      case WebhookErrorCode.RATE_LIMITED:
        return ErrorCategory.RATE_LIMIT
      case WebhookErrorCode.SERVICE_UNAVAILABLE:
        return ErrorCategory.INTEGRATION
      case WebhookErrorCode.PROCESSING_FAILED:
      default:
        return ErrorCategory.SYSTEM
    }
  }

  private mapCodeToSeverity(code: WebhookErrorCode): ErrorSeverity {
    switch (code) {
      case WebhookErrorCode.INVALID_SIGNATURE:
      case WebhookErrorCode.AUTHENTICATION_FAILED:
        return ErrorSeverity.HIGH
      case WebhookErrorCode.SERVICE_UNAVAILABLE:
        return ErrorSeverity.CRITICAL
      case WebhookErrorCode.PROCESSING_FAILED:
        return ErrorSeverity.HIGH
      case WebhookErrorCode.RATE_LIMITED:
        return ErrorSeverity.MEDIUM
      default:
        return ErrorSeverity.MEDIUM
    }
  }

  private mapCodeToRecoveryStrategy(code: WebhookErrorCode): RecoveryStrategy {
    switch (code) {
      case WebhookErrorCode.RATE_LIMITED:
      case WebhookErrorCode.SERVICE_UNAVAILABLE:
        return RecoveryStrategy.RETRY
      case WebhookErrorCode.PROCESSING_FAILED:
        return RecoveryStrategy.CIRCUIT_BREAKER
      case WebhookErrorCode.INVALID_SIGNATURE:
      case WebhookErrorCode.AUTHENTICATION_FAILED:
        return RecoveryStrategy.ESCALATE
      default:
        return RecoveryStrategy.RETRY
    }
  }

  private getMaxRetries(code: WebhookErrorCode): number {
    switch (code) {
      case WebhookErrorCode.RATE_LIMITED:
        return 1
      case WebhookErrorCode.SERVICE_UNAVAILABLE:
      case WebhookErrorCode.PROCESSING_FAILED:
        return 3
      default:
        return 2
    }
  }

  private getRetryDelay(code: WebhookErrorCode): number {
    switch (code) {
      case WebhookErrorCode.RATE_LIMITED:
        return 60000 // 1 minute
      case WebhookErrorCode.SERVICE_UNAVAILABLE:
        return 30000 // 30 seconds
      default:
        return 5000 // 5 seconds
    }
  }

  /**
   * Handle signature validation errors
   */
  handleSignatureError(details?: any, requestId?: string): NextResponse {
    return this.handleError(
      WebhookErrorCode.INVALID_SIGNATURE,
      'Webhook signature validation failed',
      details,
      requestId
    )
  }

  /**
   * Handle payload validation errors
   */
  handlePayloadError(message: string, details?: any, requestId?: string): NextResponse {
    return this.handleError(
      WebhookErrorCode.INVALID_PAYLOAD,
      message,
      details,
      requestId
    )
  }

  /**
   * Handle processing errors
   */
  handleProcessingError(message: string, details?: any, requestId?: string): NextResponse {
    return this.handleError(
      WebhookErrorCode.PROCESSING_FAILED,
      message,
      details,
      requestId
    )
  }

  /**
   * Handle rate limiting errors
   */
  handleRateLimitError(details?: any, requestId?: string): NextResponse {
    const response = this.handleError(
      WebhookErrorCode.RATE_LIMITED,
      'Rate limit exceeded',
      details,
      requestId
    )

    // Add rate limit headers
    response.headers.set('Retry-After', '60')
    response.headers.set('X-RateLimit-Limit', '100')
    response.headers.set('X-RateLimit-Remaining', '0')

    return response
  }
}

/**
 * Retry mechanism for failed webhook processing
 * @deprecated Use errorRecoveryManager.executeWithRecovery instead
 */
export class WebhookRetryHandler {
  private readonly maxRetries: number
  private readonly baseDelay: number

  constructor(maxRetries: number = 3, baseDelay: number = 1000) {
    this.maxRetries = maxRetries
    this.baseDelay = baseDelay
  }

  /**
   * Execute function with exponential backoff retry
   * @deprecated Use errorRecoveryManager.executeWithRecovery instead
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    context?: string
  ): Promise<T> {
    const error = ErrorFactory.createNetworkError(
      'Webhook processing failed',
      { context, maxRetries: this.maxRetries }
    )

    const result = await errorRecoveryManager.executeWithRecovery(
      fn,
      error,
      'webhook',
      context
    )

    if (result.success) {
      return result.recoveredValue as T
    } else {
      throw result.finalError || new Error('Webhook processing failed after retries')
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Circuit breaker for webhook processing
 * @deprecated Use errorRecoveryManager circuit breakers instead
 */
export class WebhookCircuitBreaker {
  private failures: number = 0
  private lastFailureTime: number = 0
  private state: 'closed' | 'open' | 'half-open' = 'closed'

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly recoveryTimeout: number = 60000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Delegate to the global error recovery manager
    const circuitBreaker = errorRecoveryManager.registerCircuitBreaker('webhook', {
      failureThreshold: this.failureThreshold,
      recoveryTimeout: this.recoveryTimeout
    })

    return circuitBreaker.execute(fn)
  }

  private onSuccess(): void {
    this.failures = 0
    this.state = 'closed'
  }

  private onFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()

    if (this.failures >= this.failureThreshold) {
      this.state = 'open'
    }
  }

  getState(): string {
    return this.state
  }

  getFailureCount(): number {
    return this.failures
  }
}

// Global instances
export const twilioErrorHandler = new WebhookErrorHandler('twilio')
export const emailErrorHandler = new WebhookErrorHandler('email')
export const webhookRetryHandler = new WebhookRetryHandler()
export const webhookCircuitBreaker = new WebhookCircuitBreaker()