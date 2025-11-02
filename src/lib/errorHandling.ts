/**
 * Comprehensive Error Handling and Recovery System
 * 
 * This module provides:
 * - Global error types and interfaces
 * - Error classification and severity levels
 * - Error recovery strategies
 * - Integration with logging and monitoring
 */

import { z } from 'zod'

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Error categories for classification
export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  NETWORK = 'network',
  DATABASE = 'database',
  INTEGRATION = 'integration',
  BUSINESS_LOGIC = 'business_logic',
  SYSTEM = 'system',
  USER_INPUT = 'user_input',
  RATE_LIMIT = 'rate_limit',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown'
}

// Recovery strategies
export enum RecoveryStrategy {
  RETRY = 'retry',
  FALLBACK = 'fallback',
  CIRCUIT_BREAKER = 'circuit_breaker',
  ESCALATE = 'escalate',
  IGNORE = 'ignore',
  MANUAL_INTERVENTION = 'manual_intervention'
}

// Base error interface
export interface BaseError {
  id: string
  code: string
  message: string
  category: ErrorCategory
  severity: ErrorSeverity
  timestamp: Date
  context?: Record<string, unknown>
  stack?: string
  userId?: string
  requestId?: string
  source: string
}

// Error with recovery information
export interface RecoverableError extends BaseError {
  recoveryStrategy: RecoveryStrategy
  retryCount?: number
  maxRetries?: number
  retryAfter?: number
  fallbackAction?: () => Promise<unknown>
  escalationThreshold?: number
  canRecover: boolean
}

// Error recovery result
export interface ErrorRecoveryResult {
  success: boolean
  strategy: RecoveryStrategy
  attempts: number
  finalError?: BaseError
  recoveredValue?: unknown
  escalated: boolean
  userMessage: string
}

// User-friendly error messages
export interface UserErrorMessage {
  title: string
  message: string
  actionable: boolean
  actions?: Array<{
    label: string
    action: string
    primary?: boolean
  }>
  severity: ErrorSeverity
}

// Error context for better debugging
export interface ErrorContext {
  userId?: string
  requestId?: string
  sessionId?: string
  userAgent?: string
  ip?: string
  route?: string
  method?: string
  params?: Record<string, unknown>
  body?: Record<string, unknown>
  headers?: Record<string, string>
  timestamp: Date
}

// Validation schemas
export const BaseErrorSchema = z.object({
  id: z.string(),
  code: z.string(),
  message: z.string(),
  category: z.nativeEnum(ErrorCategory),
  severity: z.nativeEnum(ErrorSeverity),
  timestamp: z.date(),
  context: z.record(z.unknown()).optional(),
  stack: z.string().optional(),
  userId: z.string().optional(),
  requestId: z.string().optional(),
  source: z.string(),
})

export const RecoverableErrorSchema = BaseErrorSchema.extend({
  recoveryStrategy: z.nativeEnum(RecoveryStrategy),
  retryCount: z.number().optional(),
  maxRetries: z.number().optional(),
  retryAfter: z.number().optional(),
  escalationThreshold: z.number().optional(),
  canRecover: z.boolean(),
})

// Error factory for creating standardized errors
export class ErrorFactory {
  static createError(
    code: string,
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity,
    source: string,
    context?: Record<string, unknown>
  ): BaseError {
    return {
      id: this.generateErrorId(),
      code,
      message,
      category,
      severity,
      timestamp: new Date(),
      context,
      source,
      stack: new Error().stack,
    }
  }

  static createRecoverableError(
    baseError: BaseError,
    recoveryStrategy: RecoveryStrategy,
    options: {
      maxRetries?: number
      retryAfter?: number
      fallbackAction?: () => Promise<unknown>
      escalationThreshold?: number
    } = {}
  ): RecoverableError {
    return {
      ...baseError,
      recoveryStrategy,
      retryCount: 0,
      maxRetries: options.maxRetries || 3,
      retryAfter: options.retryAfter || 1000,
      fallbackAction: options.fallbackAction,
      escalationThreshold: options.escalationThreshold || 5,
      canRecover: true,
    }
  }

  static createAuthenticationError(message: string, context?: Record<string, unknown>): RecoverableError {
    const baseError = this.createError(
      'AUTH_001',
      message,
      ErrorCategory.AUTHENTICATION,
      ErrorSeverity.HIGH,
      'authentication_service',
      context
    )

    return this.createRecoverableError(baseError, RecoveryStrategy.ESCALATE, {
      maxRetries: 1,
    })
  }

  static createValidationError(message: string, context?: Record<string, unknown>): BaseError {
    return this.createError(
      'VAL_001',
      message,
      ErrorCategory.VALIDATION,
      ErrorSeverity.MEDIUM,
      'validation_service',
      context
    )
  }

  static createNetworkError(message: string, context?: Record<string, unknown>): RecoverableError {
    const baseError = this.createError(
      'NET_001',
      message,
      ErrorCategory.NETWORK,
      ErrorSeverity.HIGH,
      'network_service',
      context
    )

    return this.createRecoverableError(baseError, RecoveryStrategy.RETRY, {
      maxRetries: 3,
      retryAfter: 2000,
    })
  }

  static createDatabaseError(message: string, context?: Record<string, unknown>): RecoverableError {
    const baseError = this.createError(
      'DB_001',
      message,
      ErrorCategory.DATABASE,
      ErrorSeverity.CRITICAL,
      'database_service',
      context
    )

    return this.createRecoverableError(baseError, RecoveryStrategy.CIRCUIT_BREAKER, {
      maxRetries: 2,
      retryAfter: 5000,
      escalationThreshold: 3,
    })
  }

  static createIntegrationError(
    service: string,
    message: string,
    context?: Record<string, unknown>
  ): RecoverableError {
    const baseError = this.createError(
      'INT_001',
      message,
      ErrorCategory.INTEGRATION,
      ErrorSeverity.HIGH,
      `${service}_integration`,
      context
    )

    return this.createRecoverableError(baseError, RecoveryStrategy.FALLBACK, {
      maxRetries: 2,
      retryAfter: 3000,
    })
  }

  static createRateLimitError(service: string, retryAfter: number): RecoverableError {
    const baseError = this.createError(
      'RATE_001',
      `Rate limit exceeded for ${service}`,
      ErrorCategory.RATE_LIMIT,
      ErrorSeverity.MEDIUM,
      service,
      { retryAfter }
    )

    return this.createRecoverableError(baseError, RecoveryStrategy.RETRY, {
      maxRetries: 1,
      retryAfter,
    })
  }

  private static generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

// User-friendly error message generator
export class UserErrorMessageGenerator {
  private static readonly ERROR_MESSAGES: Record<string, UserErrorMessage> = {
    AUTH_001: {
      title: 'Authentication Required',
      message: 'Please log in to continue accessing this feature.',
      actionable: true,
      actions: [
        { label: 'Log In', action: 'login', primary: true },
        { label: 'Contact Support', action: 'support' }
      ],
      severity: ErrorSeverity.HIGH
    },
    VAL_001: {
      title: 'Invalid Input',
      message: 'Please check your input and try again.',
      actionable: true,
      actions: [
        { label: 'Try Again', action: 'retry', primary: true }
      ],
      severity: ErrorSeverity.MEDIUM
    },
    NET_001: {
      title: 'Connection Problem',
      message: 'We\'re having trouble connecting to our servers. Please try again in a moment.',
      actionable: true,
      actions: [
        { label: 'Retry', action: 'retry', primary: true },
        { label: 'Check Status', action: 'status' }
      ],
      severity: ErrorSeverity.HIGH
    },
    DB_001: {
      title: 'Service Temporarily Unavailable',
      message: 'Our service is temporarily unavailable. We\'re working to resolve this quickly.',
      actionable: false,
      actions: [
        { label: 'Contact Support', action: 'support', primary: true }
      ],
      severity: ErrorSeverity.CRITICAL
    },
    INT_001: {
      title: 'Service Integration Issue',
      message: 'We\'re experiencing issues with an external service. Some features may be limited.',
      actionable: true,
      actions: [
        { label: 'Try Again', action: 'retry', primary: true },
        { label: 'Use Alternative', action: 'fallback' }
      ],
      severity: ErrorSeverity.HIGH
    },
    RATE_001: {
      title: 'Too Many Requests',
      message: 'You\'ve made too many requests. Please wait a moment before trying again.',
      actionable: true,
      actions: [
        { label: 'Wait and Retry', action: 'wait_retry', primary: true }
      ],
      severity: ErrorSeverity.MEDIUM
    }
  }

  static generateUserMessage(error: BaseError): UserErrorMessage {
    const template = this.ERROR_MESSAGES[error.code]
    
    if (template) {
      return {
        ...template,
        message: this.personalizeMessage(template.message, error)
      }
    }

    // Fallback for unknown errors
    return {
      title: 'Something Went Wrong',
      message: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
      actionable: true,
      actions: [
        { label: 'Try Again', action: 'retry', primary: true },
        { label: 'Contact Support', action: 'support' }
      ],
      severity: ErrorSeverity.HIGH
    }
  }

  private static personalizeMessage(template: string, error: BaseError): string {
    // Add context-specific information to the message
    if (error.context?.service) {
      return template.replace('service', error.context.service as string)
    }
    
    if (error.context?.retryAfter) {
      const seconds = Math.ceil((error.context.retryAfter as number) / 1000)
      return template.replace('a moment', `${seconds} seconds`)
    }

    return template
  }
}

// Type exports
export type ErrorInput = z.infer<typeof BaseErrorSchema>
export type RecoverableErrorInput = z.infer<typeof RecoverableErrorSchema>