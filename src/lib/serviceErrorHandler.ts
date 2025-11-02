/**
 * Service Error Handler
 * 
 * Provides error handling utilities for service classes
 * with automatic recovery and logging
 */

import { 
  BaseError, 
  ErrorFactory, 
  ErrorCategory, 
  ErrorSeverity,
  RecoverableError 
} from './errorHandling'
import { errorRecoveryManager } from './errorRecovery'
import { errorReportingService } from './errorReporting'
import { logger } from './logger'

// Service operation context
export interface ServiceContext {
  serviceName: string
  operation: string
  userId?: string
  requestId?: string
  metadata?: Record<string, unknown>
}

// Service error configuration
export interface ServiceErrorConfig {
  enableRecovery: boolean
  enableReporting: boolean
  enableLogging: boolean
  defaultRetries: number
  defaultRetryDelay: number
}

/**
 * Service Error Handler Class
 */
export class ServiceErrorHandler {
  private readonly config: ServiceErrorConfig
  private readonly serviceName: string

  constructor(serviceName: string, config: Partial<ServiceErrorConfig> = {}) {
    this.serviceName = serviceName
    this.config = {
      enableRecovery: config.enableRecovery ?? true,
      enableReporting: config.enableReporting ?? true,
      enableLogging: config.enableLogging ?? true,
      defaultRetries: config.defaultRetries || 3,
      defaultRetryDelay: config.defaultRetryDelay || 2000
    }
  }

  /**
   * Execute a service operation with error handling
   */
  async execute<T>(
    operation: () => Promise<T>,
    context: Partial<ServiceContext> = {}
  ): Promise<T> {
    const fullContext: ServiceContext = {
      serviceName: this.serviceName,
      operation: context.operation || 'unknown',
      ...context
    }

    try {
      const startTime = Date.now()
      
      if (this.config.enableLogging) {
        logger.debug('Service operation started', {
          serviceName: fullContext.serviceName,
          operation: fullContext.operation,
          userId: fullContext.userId,
          requestId: fullContext.requestId
        })
      }

      const result = await operation()
      
      if (this.config.enableLogging) {
        logger.debug('Service operation completed', {
          serviceName: fullContext.serviceName,
          operation: fullContext.operation,
          duration: Date.now() - startTime,
          userId: fullContext.userId,
          requestId: fullContext.requestId
        })
      }

      return result
    } catch (error) {
      return this.handleError(error, fullContext, operation)
    }
  }

  /**
   * Execute with explicit recovery configuration
   */
  async executeWithRecovery<T>(
    operation: () => Promise<T>,
    context: Partial<ServiceContext> = {},
    recoveryConfig: {
      maxRetries?: number
      retryDelay?: number
      enableCircuitBreaker?: boolean
      fallbackFunction?: () => Promise<T>
    } = {}
  ): Promise<T> {
    const fullContext: ServiceContext = {
      serviceName: this.serviceName,
      operation: context.operation || 'unknown',
      ...context
    }

    if (!this.config.enableRecovery) {
      return this.execute(operation, context)
    }

    try {
      return await operation()
    } catch (error) {
      const recoverableError = this.createRecoverableError(error, fullContext, recoveryConfig)
      
      const recoveryResult = await errorRecoveryManager.executeWithRecovery(
        operation,
        recoverableError,
        this.serviceName,
        `${fullContext.serviceName}_${fullContext.operation}`
      )

      if (recoveryResult.success) {
        if (this.config.enableLogging) {
          logger.info('Service operation recovered', {
            serviceName: fullContext.serviceName,
            operation: fullContext.operation,
            strategy: recoveryResult.strategy,
            attempts: recoveryResult.attempts,
            userId: fullContext.userId,
            requestId: fullContext.requestId
          })
        }
        
        return recoveryResult.recoveredValue as T
      } else {
        throw recoveryResult.finalError || error
      }
    }
  }

  /**
   * Handle service errors
   */
  private async handleError<T>(
    error: unknown,
    context: ServiceContext,
    operation?: () => Promise<T>
  ): Promise<T> {
    const structuredError = this.createStructuredError(error, context)
    
    // Report error if enabled
    if (this.config.enableReporting) {
      await errorReportingService.reportError(structuredError)
    }
    
    // Log error if enabled
    if (this.config.enableLogging) {
      logger.error('Service operation failed', {
        serviceName: context.serviceName,
        operation: context.operation,
        errorId: structuredError.id,
        errorCode: structuredError.code,
        userId: context.userId,
        requestId: context.requestId
      }, structuredError)
    }

    // Attempt recovery if enabled and operation is provided
    if (this.config.enableRecovery && operation) {
      const recoverableError = this.createRecoverableError(error, context)
      
      const recoveryResult = await errorRecoveryManager.executeWithRecovery(
        operation,
        recoverableError,
        this.serviceName,
        `${context.serviceName}_${context.operation}`
      )

      if (recoveryResult.success) {
        return recoveryResult.recoveredValue as T
      }
    }

    // Re-throw the structured error
    throw structuredError
  }

  /**
   * Create structured error from unknown error
   */
  private createStructuredError(error: unknown, context: ServiceContext): BaseError {
    if (error instanceof Error && 'code' in error && 'category' in error) {
      return error as BaseError
    }

    if (error instanceof Error) {
      return ErrorFactory.createError(
        this.generateErrorCode(error, context),
        error.message || 'Service operation failed',
        this.categorizeServiceError(error, context),
        this.determineSeverity(error, context),
        context.serviceName,
        {
          operation: context.operation,
          stack: error.stack,
          name: error.name,
          userId: context.userId,
          requestId: context.requestId,
          metadata: context.metadata
        }
      )
    }

    return ErrorFactory.createError(
      `${context.serviceName.toUpperCase()}_UNKNOWN`,
      'Unknown service error occurred',
      ErrorCategory.UNKNOWN,
      ErrorSeverity.HIGH,
      context.serviceName,
      {
        operation: context.operation,
        error: String(error),
        userId: context.userId,
        requestId: context.requestId,
        metadata: context.metadata
      }
    )
  }

  /**
   * Create recoverable error
   */
  private createRecoverableError(
    error: unknown,
    context: ServiceContext,
    recoveryConfig: {
      maxRetries?: number
      retryDelay?: number
      fallbackFunction?: () => Promise<unknown>
    } = {}
  ): RecoverableError {
    const baseError = this.createStructuredError(error, context)
    
    return ErrorFactory.createRecoverableError(
      baseError,
      this.determineRecoveryStrategy(baseError, context),
      {
        maxRetries: recoveryConfig.maxRetries || this.config.defaultRetries,
        retryAfter: recoveryConfig.retryDelay || this.config.defaultRetryDelay,
        fallbackAction: recoveryConfig.fallbackFunction
      }
    )
  }

  /**
   * Generate error code based on service and error type
   */
  private generateErrorCode(error: Error, context: ServiceContext): string {
    const servicePrefix = context.serviceName.toUpperCase().replace(/[^A-Z]/g, '')
    const errorType = this.getErrorType(error)
    return `${servicePrefix}_${errorType}`
  }

  /**
   * Categorize service error
   */
  private categorizeServiceError(error: Error, context: ServiceContext): ErrorCategory {
    const message = error.message.toLowerCase()
    const serviceName = context.serviceName.toLowerCase()
    
    // Service-specific categorization
    if (serviceName.includes('twilio') || serviceName.includes('sms') || serviceName.includes('whatsapp')) {
      if (message.includes('authentication') || message.includes('unauthorized')) {
        return ErrorCategory.AUTHENTICATION
      }
      if (message.includes('rate limit') || message.includes('too many requests')) {
        return ErrorCategory.RATE_LIMIT
      }
      return ErrorCategory.INTEGRATION
    }
    
    if (serviceName.includes('email')) {
      if (message.includes('smtp') || message.includes('connection')) {
        return ErrorCategory.NETWORK
      }
      return ErrorCategory.INTEGRATION
    }
    
    if (serviceName.includes('database') || serviceName.includes('prisma')) {
      return ErrorCategory.DATABASE
    }
    
    // General categorization
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorCategory.VALIDATION
    }
    
    if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
      return ErrorCategory.NETWORK
    }
    
    if (message.includes('unauthorized') || message.includes('authentication')) {
      return ErrorCategory.AUTHENTICATION
    }
    
    if (message.includes('forbidden') || message.includes('permission')) {
      return ErrorCategory.AUTHORIZATION
    }
    
    return ErrorCategory.BUSINESS_LOGIC
  }

  /**
   * Determine error severity
   */
  private determineSeverity(error: Error, context: ServiceContext): ErrorSeverity {
    const message = error.message.toLowerCase()
    const serviceName = context.serviceName.toLowerCase()
    
    // Critical services
    if (serviceName.includes('database') || serviceName.includes('auth')) {
      return ErrorSeverity.CRITICAL
    }
    
    // High severity conditions
    if (message.includes('critical') || message.includes('fatal') || message.includes('connection')) {
      return ErrorSeverity.HIGH
    }
    
    // Medium severity conditions
    if (message.includes('validation') || message.includes('rate limit')) {
      return ErrorSeverity.MEDIUM
    }
    
    return ErrorSeverity.HIGH // Default for service errors
  }

  /**
   * Determine recovery strategy
   */
  private determineRecoveryStrategy(error: BaseError, context: ServiceContext): 'retry' | 'circuit_breaker' | 'fallback' | 'escalate' {
    switch (error.category) {
      case ErrorCategory.NETWORK:
      case ErrorCategory.TIMEOUT:
        return 'retry'
      case ErrorCategory.DATABASE:
      case ErrorCategory.INTEGRATION:
        return 'circuit_breaker'
      case ErrorCategory.RATE_LIMIT:
        return 'retry'
      case ErrorCategory.AUTHENTICATION:
      case ErrorCategory.AUTHORIZATION:
        return 'escalate'
      default:
        return 'retry'
    }
  }

  /**
   * Get error type from error
   */
  private getErrorType(error: Error): string {
    const message = error.message.toLowerCase()
    
    if (message.includes('network') || message.includes('connection')) return 'NETWORK'
    if (message.includes('timeout')) return 'TIMEOUT'
    if (message.includes('validation')) return 'VALIDATION'
    if (message.includes('authentication')) return 'AUTH'
    if (message.includes('rate limit')) return 'RATE_LIMIT'
    if (message.includes('database')) return 'DATABASE'
    
    return 'GENERAL'
  }
}

/**
 * Create service error handler
 */
export function createServiceErrorHandler(
  serviceName: string,
  config?: Partial<ServiceErrorConfig>
): ServiceErrorHandler {
  return new ServiceErrorHandler(serviceName, config)
}

/**
 * Decorator for service methods
 */
export function withServiceErrorHandling(
  serviceName: string,
  operation: string,
  config?: Partial<ServiceErrorConfig>
) {
  const errorHandler = new ServiceErrorHandler(serviceName, config)
  
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    
    descriptor.value = async function (...args: any[]) {
      return errorHandler.execute(
        () => originalMethod.apply(this, args),
        { operation: `${propertyKey}_${operation}` }
      )
    }
    
    return descriptor
  }
}