import { NextRequest, NextResponse } from 'next/server'
import { emailService, EmailWebhookPayload, InboundEmailWebhookPayload } from '@/services/emailService'
import { 
  validateEmailWebhook, 
  parseEmailWebhookPayload, 
  validateEmailWebhookFields,
  sanitizeEmailWebhookPayload,
  webhookRateLimiter 
} from '@/lib/webhookValidation'
import { 
  emailErrorHandler, 
  webhookRetryHandler, 
  webhookCircuitBreaker,
  WebhookErrorCode 
} from '@/lib/webhookErrorHandler'

/**
 * Email webhook handler for Resend events
 * POST /api/webhooks/email
 */
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  
  try {
    // Rate limiting check
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown'
    if (!webhookRateLimiter.isAllowed(clientIp)) {
      return emailErrorHandler.handleRateLimitError(
        { clientIp, remaining: webhookRateLimiter.getRemainingRequests(clientIp) },
        requestId
      )
    }

    // Validate webhook signature and get payload
    const validation = await validateEmailWebhook(request)
    if (!validation.isValid) {
      return emailErrorHandler.handleSignatureError(
        { error: validation.error },
        requestId
      )
    }

    // Parse the JSON payload
    let payload: EmailWebhookPayload | InboundEmailWebhookPayload
    try {
      payload = parseEmailWebhookPayload(validation.payload!)
    } catch (error) {
      return emailErrorHandler.handlePayloadError(
        'Invalid JSON payload',
        { error: error instanceof Error ? error.message : error },
        requestId
      )
    }

    // Validate required fields based on payload type
    if (payload.type === 'email.received') {
      const requiredFields = ['type', 'data.message_id', 'data.from']
      const fieldValidation = validateEmailWebhookFields(payload, requiredFields)
      if (!fieldValidation.isValid) {
        return emailErrorHandler.handlePayloadError(
          `Missing required fields: ${fieldValidation.missingFields?.join(', ')}`,
          { missingFields: fieldValidation.missingFields },
          requestId
        )
      }
    } else {
      const requiredFields = ['type', 'data.email_id']
      const fieldValidation = validateEmailWebhookFields(payload, requiredFields)
      if (!fieldValidation.isValid) {
        return emailErrorHandler.handlePayloadError(
          `Missing required fields: ${fieldValidation.missingFields?.join(', ')}`,
          { missingFields: fieldValidation.missingFields },
          requestId
        )
      }
    }

    // Log the incoming webhook for debugging (sanitized)
    console.log('Email webhook received:', sanitizeEmailWebhookPayload({
      requestId,
      type: payload.type,
      timestamp: payload.created_at,
      emailId: 'data' in payload ? (
        'email_id' in payload.data ? payload.data.email_id : 
        'message_id' in payload.data ? payload.data.message_id : 
        undefined
      ) : undefined,
    }))

    // Process the webhook with circuit breaker and retry logic
    const result = await webhookCircuitBreaker.execute(async () => {
      return await webhookRetryHandler.executeWithRetry(async () => {
        if (payload.type === 'email.received') {
          // Handle inbound email
          const inboundPayload = payload as InboundEmailWebhookPayload
          const message = await emailService.processInboundWebhook(inboundPayload)
          
          if (!message) {
            throw new Error('Failed to process inbound email')
          }

          console.log('Successfully processed inbound email:', message.id)
          
          // TODO: Broadcast real-time update to connected clients
          // await broadcastMessageUpdate(message)
          
          return { 
            success: true, 
            messageId: message.id,
            type: 'inbound_email',
          }
        } else {
          // Handle status update events
          const statusPayload = payload as EmailWebhookPayload
          await emailService.processStatusUpdate(statusPayload)
          
          console.log('Successfully processed email status update:', {
            emailId: statusPayload.data.email_id,
            eventType: statusPayload.type,
          })
          
          return { 
            success: true,
            type: 'status_update',
            emailId: statusPayload.data.email_id,
            eventType: statusPayload.type,
          }
        }
      }, `email-webhook-${requestId}`)
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Email webhook processing error:', error)
    return emailErrorHandler.handleProcessingError(
      error instanceof Error ? error.message : 'Unknown processing error',
      { error: error instanceof Error ? error.stack : error },
      requestId
    )
  }
}

/**
 * Handle GET requests for webhook verification
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Email webhook endpoint is active',
    timestamp: new Date().toISOString(),
    service: 'resend',
  })
}