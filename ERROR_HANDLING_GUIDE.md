# Comprehensive Error Handling System

This document describes the comprehensive error handling and logging system implemented for the Unified Multi-Channel Inbox application.

## Overview

The error handling system provides:

- **Global Error Boundaries**: React error boundaries that catch and handle component errors
- **Automatic Error Recovery**: Retry logic with exponential backoff, circuit breakers, and fallback mechanisms
- **Comprehensive Logging**: Structured logging with different levels and context enrichment
- **Error Reporting & Alerting**: Automated error reporting with configurable alerting channels
- **User-Friendly Messages**: Contextual error messages with actionable recovery options
- **Performance Monitoring**: Error metrics, trends, and system health monitoring

## Architecture

### Core Components

1. **Error Handling (`src/lib/errorHandling.ts`)**
   - Base error interfaces and types
   - Error factory for creating standardized errors
   - User-friendly message generation

2. **Error Recovery (`src/lib/errorRecovery.ts`)**
   - Retry handler with exponential backoff
   - Circuit breaker pattern implementation
   - Fallback mechanisms
   - Comprehensive recovery manager

3. **Logging System (`src/lib/logger.ts`)**
   - Structured logging with multiple levels
   - Context enrichment and performance tracking
   - Remote logging service integration

4. **Error Reporting (`src/lib/errorReporting.ts`)**
   - Error metrics collection
   - Alert management and escalation
   - Integration with monitoring services

5. **Middleware & Boundaries**
   - API route error middleware (`src/lib/errorMiddleware.ts`)
   - React error boundary (`src/components/ErrorBoundary.tsx`)
   - Service error handler (`src/lib/serviceErrorHandler.ts`)

## Usage Examples

### 1. API Route Error Handling

```typescript
import { withErrorHandling } from '@/lib/errorMiddleware'

async function myApiHandler(request: NextRequest, context: RequestContext) {
  // Your API logic here
  const result = await someOperation()
  return result
}

// Wrap with error handling
export const GET = withErrorHandling(myApiHandler)
```

### 2. Service Error Handling

```typescript
import { createServiceErrorHandler } from '@/lib/serviceErrorHandler'

class MyService {
  private errorHandler = createServiceErrorHandler('my_service')

  async performOperation(data: any) {
    return this.errorHandler.executeWithRecovery(
      async () => {
        // Your operation logic
        return await externalApiCall(data)
      },
      {
        operation: 'external_api_call',
        metadata: { dataSize: data.length }
      },
      {
        maxRetries: 3,
        retryDelay: 2000,
        fallbackFunction: async () => {
          // Fallback logic
          return await localCache.get(data.id)
        }
      }
    )
  }
}
```

### 3. React Component Error Handling

```typescript
import { useErrorHandler } from '@/components/ErrorBoundary'

function MyComponent() {
  const { handleError } = useErrorHandler()

  const handleAsyncOperation = async () => {
    try {
      await riskyOperation()
    } catch (error) {
      handleError(error, { component: 'MyComponent', operation: 'riskyOperation' })
    }
  }

  return (
    <button onClick={handleAsyncOperation}>
      Perform Operation
    </button>
  )
}
```

### 4. Manual Error Creation and Reporting

```typescript
import { ErrorFactory, ErrorCategory, ErrorSeverity } from '@/lib/errorHandling'
import { errorReportingService } from '@/lib/errorReporting'

// Create a structured error
const error = ErrorFactory.createIntegrationError(
  'twilio',
  'Failed to send SMS message',
  { phoneNumber: '+1234567890', messageId: 'msg_123' }
)

// Report the error
await errorReportingService.reportError(error)
```

## Error Categories and Severity Levels

### Categories

- `AUTHENTICATION`: Authentication and login errors
- `AUTHORIZATION`: Permission and access control errors
- `VALIDATION`: Input validation and data format errors
- `NETWORK`: Network connectivity and timeout errors
- `DATABASE`: Database connection and query errors
- `INTEGRATION`: External service integration errors
- `BUSINESS_LOGIC`: Application business logic errors
- `SYSTEM`: System-level and infrastructure errors
- `USER_INPUT`: User input and interaction errors
- `RATE_LIMIT`: Rate limiting and quota errors
- `TIMEOUT`: Operation timeout errors
- `UNKNOWN`: Unclassified errors

### Severity Levels

- `LOW`: Minor issues that don't affect functionality
- `MEDIUM`: Issues that may impact some functionality
- `HIGH`: Significant issues that affect core functionality
- `CRITICAL`: Severe issues that may cause system failure

## Recovery Strategies

### 1. Retry Strategy

Automatically retries failed operations with exponential backoff:

```typescript
// Configuration
{
  maxRetries: 3,
  baseDelay: 1000,
  backoffMultiplier: 2,
  jitterFactor: 0.1
}
```

### 2. Circuit Breaker Pattern

Prevents cascading failures by temporarily stopping requests to failing services:

```typescript
// Configuration
{
  failureThreshold: 5,
  recoveryTimeout: 60000,
  monitoringPeriod: 300000
}
```

### 3. Fallback Mechanisms

Provides alternative responses when primary operations fail:

```typescript
{
  fallbackFunction: async () => {
    return await getCachedData()
  }
}
```

## Logging Configuration

### Log Levels

- `DEBUG`: Detailed debugging information
- `INFO`: General information about application flow
- `WARN`: Warning messages for potential issues
- `ERROR`: Error messages for handled exceptions
- `FATAL`: Critical errors that may cause application failure

### Context Enrichment

All log entries include:

- Timestamp and request ID
- User and session information
- Performance metrics
- Environment details
- Error stack traces (in development)

### Remote Logging

Configure remote logging by setting environment variables:

```bash
REMOTE_LOGGING_ENDPOINT=https://your-logging-service.com/api/logs
REMOTE_LOGGING_API_KEY=your-api-key
```

## Alert Configuration

### Alert Channels

- **Email**: Send alerts via email
- **Slack**: Post alerts to Slack channels
- **Webhook**: Send alerts to custom webhooks
- **SMS**: Send critical alerts via SMS

### Example Configuration

```typescript
const alertConfig = {
  enabled: true,
  channels: [
    {
      type: 'slack',
      config: { webhook: 'https://hooks.slack.com/...' },
      enabled: true,
      severityFilter: ['high', 'critical']
    }
  ],
  thresholds: {
    errorRate: { threshold: 10, timeWindow: 5 },
    failureCount: { threshold: 50, timeWindow: 10 }
  }
}
```

## Monitoring and Metrics

### Error Metrics

The system tracks:

- Total error count by time window
- Error rate (errors per minute)
- Errors by category and severity
- Error trends over time
- Circuit breaker states
- Recovery success rates

### Health Checks

Access system health at `/api/health`:

```json
{
  "status": "healthy",
  "services": {
    "database": { "status": "up", "response_time": 45 },
    "external_apis": {
      "twilio": { "status": "up", "response_time": 120 }
    }
  },
  "error_metrics": {
    "total_errors_24h": 12,
    "error_rate": 0.5,
    "circuit_breakers": {}
  }
}
```

### Error Dashboard

Use the `ErrorMonitoringDashboard` component to visualize:

- Real-time error metrics
- Error trends and patterns
- Circuit breaker status
- System health overview

## Best Practices

### 1. Error Handling in Services

- Always use the service error handler for external API calls
- Provide meaningful error messages and context
- Implement appropriate fallback mechanisms
- Configure retry policies based on operation criticality

### 2. API Route Error Handling

- Wrap all API routes with error middleware
- Return user-friendly error messages
- Include recovery suggestions when possible
- Log sufficient context for debugging

### 3. React Component Error Handling

- Use error boundaries for component trees
- Handle async operations with try-catch
- Provide user feedback for error states
- Implement retry mechanisms for user actions

### 4. Logging Best Practices

- Use appropriate log levels
- Include relevant context in log messages
- Avoid logging sensitive information
- Use structured logging for better searchability

### 5. Monitoring and Alerting

- Set up alerts for critical errors
- Monitor error trends and patterns
- Review circuit breaker metrics regularly
- Implement escalation procedures for critical issues

## Environment Variables

```bash
# Logging Configuration
LOG_LEVEL=info
REMOTE_LOGGING_ENDPOINT=https://your-logging-service.com
REMOTE_LOGGING_API_KEY=your-api-key

# Error Reporting
ERROR_WEBHOOK_URL=https://hooks.slack.com/services/...
SENTRY_DSN=https://your-sentry-dsn

# Service Configuration
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
RESEND_API_KEY=your-resend-key
```

## Testing Error Handling

### Unit Tests

Test error scenarios in your services:

```typescript
describe('TwilioService', () => {
  it('should handle network errors with retry', async () => {
    // Mock network failure
    mockTwilioClient.messages.create.mockRejectedValueOnce(new Error('Network error'))
    mockTwilioClient.messages.create.mockResolvedValueOnce({ sid: 'msg_123' })

    const result = await twilioService.sendSMS({ to: '+1234567890', body: 'Test' })
    
    expect(result.success).toBe(true)
    expect(mockTwilioClient.messages.create).toHaveBeenCalledTimes(2)
  })
})
```

### Integration Tests

Test error handling in API routes:

```typescript
describe('/api/messages', () => {
  it('should return user-friendly error for invalid input', async () => {
    const response = await request(app)
      .post('/api/messages')
      .send({ invalid: 'data' })

    expect(response.status).toBe(400)
    expect(response.body.success).toBe(false)
    expect(response.body.error.userMessage).toBeDefined()
  })
})
```

## Troubleshooting

### Common Issues

1. **High Error Rates**
   - Check external service status
   - Review circuit breaker states
   - Analyze error patterns by category

2. **Circuit Breakers Opening**
   - Investigate underlying service issues
   - Adjust failure thresholds if needed
   - Implement better fallback mechanisms

3. **Missing Error Context**
   - Ensure proper error handler usage
   - Add more context to error creation
   - Review logging configuration

### Debug Mode

Enable debug logging in development:

```bash
NODE_ENV=development
LOG_LEVEL=debug
```

This will include stack traces and detailed error information in responses.

## Migration Guide

### From Basic Error Handling

1. Replace try-catch blocks with service error handlers
2. Wrap API routes with error middleware
3. Add error boundaries to React components
4. Configure logging and monitoring

### Gradual Adoption

The error handling system is designed for gradual adoption:

1. Start with API route middleware
2. Add service error handlers to critical services
3. Implement error boundaries in key components
4. Set up monitoring and alerting

## Support and Maintenance

### Regular Tasks

- Review error metrics weekly
- Update alert thresholds based on patterns
- Test recovery mechanisms monthly
- Update error message templates as needed

### Performance Impact

The error handling system is designed to have minimal performance impact:

- Logging is asynchronous
- Metrics collection is lightweight
- Circuit breakers prevent resource waste
- Error boundaries isolate failures

For questions or issues, refer to the error logs and monitoring dashboard for insights into system behavior.