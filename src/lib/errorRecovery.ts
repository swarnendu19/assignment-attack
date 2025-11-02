/**
 * Error Recovery System
 * 
 * Implements automatic retry logic with exponential backoff,
 * circuit breaker pattern, and fallback mechanisms
 */

import { 
  RecoverableError, 
  ErrorRecoveryResult, 
  RecoveryStrategy, 
  ErrorSeverity,
  ErrorFactory 
} from './errorHandling'
import { logger } from './logger'

// Retry configuration
export interface RetryConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
  jitterFactor: number
  retryableErrors: string[]
}

// Circuit breaker state
export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

// Circuit breaker configuration
export interface CircuitBreakerConfig {
  failureThreshold: number
  recoveryTimeout: number
  monitoringPeriod: number
  minimumThroughput: number
}

// Fallback configuration
export interface FallbackConfig {
  enabled: boolean
  fallbackFunction?: () => Promise<unknown>
  fallbackValue?: unknown
  timeoutMs: number
}

/**
 * Exponential Backoff Retry Handler
 */
export class RetryHandler {
  private readonly config: RetryConfig

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxRetries: config.maxRetries || 3,
      baseDelay: config.baseDelay || 1000,
      maxDelay: config.maxDelay || 30000,
      backoffMultiplier: config.backoffMultiplier || 2,
      jitterFactor: config.jitterFactor || 0.1,
      retryableErrors: config.retryableErrors || [
        'NET_001', 'TIMEOUT_001', 'RATE_001', 'INT_001'
      ]
    }
  }

  /**
   * Execute function with exponential backoff retry
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    error: RecoverableError,
    context?: string
  ): Promise<ErrorRecoveryResult> {
    let lastError: Error | RecoverableError = error
    let attempts = 0

    // Check if error is retryable
    if (!this.isRetryableError(error)) {
      return {
        success: false,
        strategy: RecoveryStrategy.RETRY,
        attempts: 0,
        finalError: error,
        escalated: false,
        userMessage: 'This error cannot be automatically retried'
      }
    }

    while (attempts < this.config.maxRetries) {
      attempts++
      
      try {
        logger.info('Attempting retry', {
          context,
          attempt: attempts,
          maxRetries: this.config.maxRetries,
          errorCode: error.code
        })

        const result = await fn()
        
        logger.info('Retry successful', {
          context,
          attempt: attempts,
          errorCode: error.code
        })

        return {
          success: true,
          strategy: RecoveryStrategy.RETRY,
          attempts,
          recoveredValue: result,
          escalated: false,
          userMessage: 'Operation completed successfully after retry'
        }
      } catch (err) {
        lastError = err as Error
        
        logger.warn('Retry attempt failed', {
          context,
          attempt: attempts,
          maxRetries: this.config.maxRetries,
          error: err instanceof Error ? err.message : err
        })

        // Don't wait after the last attempt
        if (attempts < this.config.maxRetries) {
          const delay = this.calculateDelay(attempts)
          await this.sleep(delay)
        }
      }
    }

    // All retries exhausted
    logger.error('All retry attempts exhausted', {
      context,
      attempts,
      finalError: lastError instanceof Error ? lastError.message : lastError
    })

    return {
      success: false,
      strategy: RecoveryStrategy.RETRY,
      attempts,
      finalError: lastError instanceof Error 
        ? ErrorFactory.createNetworkError(lastError.message, { context })
        : lastError,
      escalated: attempts >= this.config.maxRetries,
      userMessage: 'Operation failed after multiple attempts'
    }
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(attempt: number): number {
    const exponentialDelay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1)
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelay)
    
    // Add jitter to prevent thundering herd
    const jitter = cappedDelay * this.config.jitterFactor * Math.random()
    
    return cappedDelay + jitter
  }

  private isRetryableError(error: RecoverableError): boolean {
    return this.config.retryableErrors.includes(error.code)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Circuit Breaker Implementation
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED
  private failures: number = 0
  private lastFailureTime: number = 0
  private successCount: number = 0
  private requestCount: number = 0
  private readonly config: CircuitBreakerConfig
  private readonly name: string

  constructor(name: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.name = name
    this.config = {
      failureThreshold: config.failureThreshold || 5,
      recoveryTimeout: config.recoveryTimeout || 60000,
      monitoringPeriod: config.monitoringPeriod || 300000, // 5 minutes
      minimumThroughput: config.minimumThroughput || 10
    }

    // Reset metrics periodically
    setInterval(() => this.resetMetrics(), this.config.monitoringPeriod)
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN
        logger.info('Circuit breaker transitioning to half-open', { name: this.name })
      } else {
        const error = ErrorFactory.createIntegrationError(
          this.name,
          'Circuit breaker is open - service unavailable',
          { 
            state: this.state,
            failures: this.failures,
            lastFailureTime: this.lastFailureTime
          }
        )
        throw error
      }
    }

    this.requestCount++

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  /**
   * Get current circuit breaker metrics
   */
  getMetrics() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      successCount: this.successCount,
      requestCount: this.requestCount,
      failureRate: this.requestCount > 0 ? this.failures / this.requestCount : 0,
      lastFailureTime: this.lastFailureTime
    }
  }

  private onSuccess(): void {
    this.successCount++
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.CLOSED
      this.failures = 0
      logger.info('Circuit breaker closed after successful request', { name: this.name })
    }
  }

  private onFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()

    if (this.shouldOpenCircuit()) {
      this.state = CircuitBreakerState.OPEN
      logger.warn('Circuit breaker opened due to failures', {
        name: this.name,
        failures: this.failures,
        threshold: this.config.failureThreshold
      })
    }
  }

  private shouldOpenCircuit(): boolean {
    return (
      this.failures >= this.config.failureThreshold &&
      this.requestCount >= this.config.minimumThroughput
    )
  }

  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime > this.config.recoveryTimeout
  }

  private resetMetrics(): void {
    if (this.state === CircuitBreakerState.CLOSED) {
      this.failures = 0
      this.successCount = 0
      this.requestCount = 0
    }
  }
}

/**
 * Fallback Handler
 */
export class FallbackHandler {
  private readonly config: FallbackConfig

  constructor(config: FallbackConfig) {
    this.config = config
  }

  /**
   * Execute function with fallback support
   */
  async executeWithFallback<T>(
    primaryFn: () => Promise<T>,
    context?: string
  ): Promise<ErrorRecoveryResult> {
    if (!this.config.enabled) {
      try {
        const result = await primaryFn()
        return {
          success: true,
          strategy: RecoveryStrategy.FALLBACK,
          attempts: 1,
          recoveredValue: result,
          escalated: false,
          userMessage: 'Operation completed successfully'
        }
      } catch (error) {
        return {
          success: false,
          strategy: RecoveryStrategy.FALLBACK,
          attempts: 1,
          finalError: error as RecoverableError,
          escalated: true,
          userMessage: 'Operation failed and no fallback available'
        }
      }
    }

    try {
      // Try primary function with timeout
      const result = await Promise.race([
        primaryFn(),
        this.createTimeoutPromise()
      ])

      logger.info('Primary function succeeded', { context })
      
      return {
        success: true,
        strategy: RecoveryStrategy.FALLBACK,
        attempts: 1,
        recoveredValue: result,
        escalated: false,
        userMessage: 'Operation completed successfully'
      }
    } catch (primaryError) {
      logger.warn('Primary function failed, attempting fallback', {
        context,
        error: primaryError instanceof Error ? primaryError.message : primaryError
      })

      try {
        let fallbackResult: unknown

        if (this.config.fallbackFunction) {
          fallbackResult = await this.config.fallbackFunction()
        } else if (this.config.fallbackValue !== undefined) {
          fallbackResult = this.config.fallbackValue
        } else {
          throw new Error('No fallback function or value configured')
        }

        logger.info('Fallback succeeded', { context })

        return {
          success: true,
          strategy: RecoveryStrategy.FALLBACK,
          attempts: 2,
          recoveredValue: fallbackResult,
          escalated: false,
          userMessage: 'Operation completed using alternative method'
        }
      } catch (fallbackError) {
        logger.error('Both primary and fallback failed', {
          context,
          primaryError: primaryError instanceof Error ? primaryError.message : primaryError,
          fallbackError: fallbackError instanceof Error ? fallbackError.message : fallbackError
        })

        return {
          success: false,
          strategy: RecoveryStrategy.FALLBACK,
          attempts: 2,
          finalError: primaryError as RecoverableError,
          escalated: true,
          userMessage: 'Operation failed and fallback was unsuccessful'
        }
      }
    }
  }

  private createTimeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${this.config.timeoutMs}ms`))
      }, this.config.timeoutMs)
    })
  }
}

/**
 * Comprehensive Error Recovery Manager
 */
export class ErrorRecoveryManager {
  private readonly retryHandler: RetryHandler
  private readonly circuitBreakers: Map<string, CircuitBreaker> = new Map()
  private readonly fallbackHandlers: Map<string, FallbackHandler> = new Map()

  constructor(retryConfig?: Partial<RetryConfig>) {
    this.retryHandler = new RetryHandler(retryConfig)
  }

  /**
   * Register a circuit breaker for a service
   */
  registerCircuitBreaker(
    serviceName: string, 
    config?: Partial<CircuitBreakerConfig>
  ): CircuitBreaker {
    const circuitBreaker = new CircuitBreaker(serviceName, config)
    this.circuitBreakers.set(serviceName, circuitBreaker)
    return circuitBreaker
  }

  /**
   * Register a fallback handler for a service
   */
  registerFallbackHandler(serviceName: string, config: FallbackConfig): FallbackHandler {
    const fallbackHandler = new FallbackHandler(config)
    this.fallbackHandlers.set(serviceName, fallbackHandler)
    return fallbackHandler
  }

  /**
   * Execute function with comprehensive error recovery
   */
  async executeWithRecovery<T>(
    fn: () => Promise<T>,
    error: RecoverableError,
    serviceName?: string,
    context?: string
  ): Promise<ErrorRecoveryResult> {
    const strategy = error.recoveryStrategy

    try {
      switch (strategy) {
        case RecoveryStrategy.RETRY:
          return await this.retryHandler.executeWithRetry(fn, error, context)

        case RecoveryStrategy.CIRCUIT_BREAKER:
          if (serviceName && this.circuitBreakers.has(serviceName)) {
            const circuitBreaker = this.circuitBreakers.get(serviceName)!
            const result = await circuitBreaker.execute(fn)
            return {
              success: true,
              strategy: RecoveryStrategy.CIRCUIT_BREAKER,
              attempts: 1,
              recoveredValue: result,
              escalated: false,
              userMessage: 'Operation completed successfully'
            }
          }
          // Fallback to retry if no circuit breaker configured
          return await this.retryHandler.executeWithRetry(fn, error, context)

        case RecoveryStrategy.FALLBACK:
          if (serviceName && this.fallbackHandlers.has(serviceName)) {
            const fallbackHandler = this.fallbackHandlers.get(serviceName)!
            return await fallbackHandler.executeWithFallback(fn, context)
          }
          // Fallback to retry if no fallback handler configured
          return await this.retryHandler.executeWithRetry(fn, error, context)

        case RecoveryStrategy.ESCALATE:
          logger.error('Error escalated for manual intervention', {
            error: error.message,
            code: error.code,
            context
          })
          return {
            success: false,
            strategy: RecoveryStrategy.ESCALATE,
            attempts: 0,
            finalError: error,
            escalated: true,
            userMessage: 'This issue requires manual attention'
          }

        case RecoveryStrategy.IGNORE:
          logger.warn('Error ignored per recovery strategy', {
            error: error.message,
            code: error.code,
            context
          })
          return {
            success: true,
            strategy: RecoveryStrategy.IGNORE,
            attempts: 0,
            escalated: false,
            userMessage: 'Operation completed with warnings'
          }

        default:
          return await this.retryHandler.executeWithRetry(fn, error, context)
      }
    } catch (recoveryError) {
      logger.error('Error recovery failed', {
        originalError: error.message,
        recoveryError: recoveryError instanceof Error ? recoveryError.message : recoveryError,
        strategy,
        context
      })

      return {
        success: false,
        strategy,
        attempts: 1,
        finalError: error,
        escalated: true,
        userMessage: 'Recovery attempt failed'
      }
    }
  }

  /**
   * Get metrics for all circuit breakers
   */
  getCircuitBreakerMetrics() {
    const metrics: Record<string, any> = {}
    
    for (const [name, circuitBreaker] of this.circuitBreakers) {
      metrics[name] = circuitBreaker.getMetrics()
    }
    
    return metrics
  }
}

// Global error recovery manager instance
export const errorRecoveryManager = new ErrorRecoveryManager()

// Pre-configured circuit breakers for common services
errorRecoveryManager.registerCircuitBreaker('twilio', {
  failureThreshold: 3,
  recoveryTimeout: 30000
})

errorRecoveryManager.registerCircuitBreaker('database', {
  failureThreshold: 5,
  recoveryTimeout: 60000
})

errorRecoveryManager.registerCircuitBreaker('email', {
  failureThreshold: 3,
  recoveryTimeout: 45000
})

errorRecoveryManager.registerCircuitBreaker('social_media', {
  failureThreshold: 4,
  recoveryTimeout: 120000
})