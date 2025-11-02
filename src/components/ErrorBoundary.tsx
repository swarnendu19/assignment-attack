/**
 * Global Error Boundary Component
 * 
 * Catches React errors and provides user-friendly error messages
 * with recovery options
 */

'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { 
  BaseError, 
  ErrorFactory, 
  ErrorCategory, 
  ErrorSeverity,
  UserErrorMessage,
  UserErrorMessageGenerator 
} from '@/lib/errorHandling'
import { errorReportingService } from '@/lib/errorReporting'
import { logger } from '@/lib/logger'

interface Props {
  children: ReactNode
  fallback?: (error: BaseError, retry: () => void) => ReactNode
  onError?: (error: BaseError, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: BaseError | null
  errorId: string | null
  userMessage: UserErrorMessage | null
}

/**
 * Global Error Boundary
 */
export class ErrorBoundary extends Component<Props, State> {
  private retryCount: number = 0
  private readonly maxRetries: number = 3

  constructor(props: Props) {
    super(props)
    
    this.state = {
      hasError: false,
      error: null,
      errorId: null,
      userMessage: null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Create a structured error from the React error
    const structuredError = ErrorFactory.createError(
      'REACT_001',
      error.message || 'An unexpected error occurred in the application',
      ErrorCategory.SYSTEM,
      ErrorSeverity.HIGH,
      'react_error_boundary',
      {
        stack: error.stack,
        name: error.name,
        componentStack: (error as any).componentStack
      }
    )

    const userMessage = UserErrorMessageGenerator.generateUserMessage(structuredError)

    return {
      hasError: true,
      error: structuredError,
      errorId: structuredError.id,
      userMessage
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { error: structuredError } = this.state

    if (structuredError) {
      // Enhance error with React-specific information
      const enhancedError: BaseError = {
        ...structuredError,
        context: {
          ...structuredError.context,
          componentStack: errorInfo.componentStack,
          errorBoundary: true,
          retryCount: this.retryCount
        }
      }

      // Report error to monitoring systems
      errorReportingService.reportError(enhancedError)

      // Log error details
      logger.error('React Error Boundary caught error', {
        errorId: enhancedError.id,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        retryCount: this.retryCount
      }, enhancedError)

      // Call custom error handler if provided
      if (this.props.onError) {
        this.props.onError(enhancedError, errorInfo)
      }
    }
  }

  /**
   * Retry the failed component
   */
  private handleRetry = (): void => {
    if (this.retryCount >= this.maxRetries) {
      logger.warn('Maximum retry attempts reached', {
        errorId: this.state.errorId,
        retryCount: this.retryCount,
        maxRetries: this.maxRetries
      })
      return
    }

    this.retryCount++
    
    logger.info('Retrying after error boundary catch', {
      errorId: this.state.errorId,
      retryCount: this.retryCount
    })

    this.setState({
      hasError: false,
      error: null,
      errorId: null,
      userMessage: null
    })
  }

  /**
   * Reload the entire page
   */
  private handleReload = (): void => {
    logger.info('Reloading page after error', {
      errorId: this.state.errorId
    })
    
    window.location.reload()
  }

  /**
   * Report the error to support
   */
  private handleReportError = (): void => {
    const { error } = this.state
    
    if (error) {
      logger.info('User reported error to support', {
        errorId: error.id
      })

      // Here you would integrate with your support system
      // For example, open a support ticket or send an email
      alert(`Error reported. Reference ID: ${error.id}`)
    }
  }

  render() {
    if (this.state.hasError && this.state.error && this.state.userMessage) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry)
      }

      // Default error UI
      return (
        <ErrorFallbackUI
          error={this.state.error}
          userMessage={this.state.userMessage}
          canRetry={this.retryCount < this.maxRetries}
          onRetry={this.handleRetry}
          onReload={this.handleReload}
          onReportError={this.handleReportError}
        />
      )
    }

    return this.props.children
  }
}

/**
 * Default Error Fallback UI Component
 */
interface ErrorFallbackUIProps {
  error: BaseError
  userMessage: UserErrorMessage
  canRetry: boolean
  onRetry: () => void
  onReload: () => void
  onReportError: () => void
}

function ErrorFallbackUI({
  error,
  userMessage,
  canRetry,
  onRetry,
  onReload,
  onReportError
}: ErrorFallbackUIProps) {
  const getSeverityColor = (severity: ErrorSeverity): string => {
    switch (severity) {
      case ErrorSeverity.LOW:
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case ErrorSeverity.MEDIUM:
        return 'text-orange-600 bg-orange-50 border-orange-200'
      case ErrorSeverity.HIGH:
        return 'text-red-600 bg-red-50 border-red-200'
      case ErrorSeverity.CRITICAL:
        return 'text-red-800 bg-red-100 border-red-300'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          {/* Error Icon */}
          <div className="mx-auto h-12 w-12 text-red-500">
            <svg
              className="h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>

          {/* Error Title */}
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            {userMessage.title}
          </h2>

          {/* Error Message */}
          <p className="mt-2 text-sm text-gray-600">
            {userMessage.message}
          </p>

          {/* Error Details (Development Mode) */}
          {process.env.NODE_ENV === 'development' && (
            <div className={`mt-4 p-4 border rounded-md ${getSeverityColor(userMessage.severity)}`}>
              <div className="text-left">
                <p className="text-xs font-medium">Error Details (Development)</p>
                <p className="text-xs mt-1">ID: {error.id}</p>
                <p className="text-xs">Code: {error.code}</p>
                <p className="text-xs">Category: {error.category}</p>
                <p className="text-xs">Source: {error.source}</p>
                {error.stack && (
                  <details className="mt-2">
                    <summary className="text-xs cursor-pointer">Stack Trace</summary>
                    <pre className="text-xs mt-1 whitespace-pre-wrap overflow-auto max-h-32">
                      {error.stack}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-8 space-y-3">
          {/* Primary Actions from User Message */}
          {userMessage.actions?.map((action, index) => (
            <button
              key={index}
              onClick={() => {
                switch (action.action) {
                  case 'retry':
                    onRetry()
                    break
                  case 'reload':
                    onReload()
                    break
                  case 'support':
                    onReportError()
                    break
                  default:
                    console.warn('Unknown action:', action.action)
                }
              }}
              className={`
                group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white
                ${action.primary 
                  ? 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500' 
                  : 'bg-gray-600 hover:bg-gray-700 focus:ring-gray-500'
                }
                focus:outline-none focus:ring-2 focus:ring-offset-2
              `}
              disabled={action.action === 'retry' && !canRetry}
            >
              {action.label}
              {action.action === 'retry' && !canRetry && (
                <span className="ml-2 text-xs">(Max retries reached)</span>
              )}
            </button>
          ))}

          {/* Additional Actions */}
          <div className="flex space-x-3">
            <button
              onClick={onReload}
              className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Reload Page
            </button>
            
            <button
              onClick={() => window.history.back()}
              className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Go Back
            </button>
          </div>

          {/* Error Reference */}
          <div className="text-center">
            <p className="text-xs text-gray-500">
              Error Reference: {error.id}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Time: {error.timestamp.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Hook for handling errors in functional components
 */
export function useErrorHandler() {
  const handleError = React.useCallback((error: Error, context?: Record<string, unknown>) => {
    const structuredError = ErrorFactory.createError(
      'REACT_002',
      error.message || 'An error occurred in a React component',
      ErrorCategory.SYSTEM,
      ErrorSeverity.MEDIUM,
      'react_component',
      {
        ...context,
        stack: error.stack,
        name: error.name
      }
    )

    // Report error
    errorReportingService.reportError(structuredError)

    // Log error
    logger.error('Component error handled', {
      errorId: structuredError.id,
      message: error.message,
      context
    }, structuredError)

    // Re-throw to trigger error boundary
    throw error
  }, [])

  return { handleError }
}

/**
 * Higher-order component for error handling
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: (error: BaseError, retry: () => void) => ReactNode
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}