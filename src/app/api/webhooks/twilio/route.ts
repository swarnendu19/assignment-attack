import { NextRequest, NextResponse } from 'next/server'
import { twilioService, TwilioWebhookPayload } from '@/services/twilioService'
import { 
  validateTwilioWebhook, 
  parseTwilioWebhookPayload, 
  validateTwilioWebhookFields,
  sanitizeWebhookPayload,
  webhookRateLimiter 
} from '@/lib/webhookValidation'
import { 
  twilioErrorHandler, 
  webhookRetryHandler, 
  webhookCircuitBreaker,
  WebhookErrorCode 
} from '@/lib/webhookErrorHandler'

/**
 * Twilio webhook handler for incoming messages
 * POST /api/webhooks/twilio
 */
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  
  try {
    // Rate limiting check
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown'
    if (!webhookRateLimiter.isAllowed(clientIp)) {
      return twilioErrorHandler.handleRateLimitError(
        { clientIp, remaining: webhookRateLimiter.getRemainingRequests(clientIp) },
        requestId
      )
    }

    // Validate webhook signature and get payload
    const validation = await validateTwilioWebhook(request)
    if (!validation.isValid) {
      return twilioErrorHandler.handleSignatureError(
        { error: validation.error },
        requestId
      )
    }

    // Parse the form data
    const parsedPayload = parseTwilioWebhookPayload(validation.payload!)
    
    // Validate required fields
    const requiredFields = ['MessageSid', 'AccountSid', 'From', 'To']
    const fieldValidation = validateTwilioWebhookFields(parsedPayload, requiredFields)
    if (!fieldValidation.isValid) {
      return twilioErrorHandler.handlePayloadError(
        `Missing required fields: ${fieldValidation.missingFields?.join(', ')}`,
        { missingFields: fieldValidation.missingFields },
        requestId
      )
    }

    const payload: TwilioWebhookPayload = {
      MessageSid: parsedPayload.MessageSid,
      AccountSid: parsedPayload.AccountSid,
      From: parsedPayload.From,
      To: parsedPayload.To,
      Body: parsedPayload.Body || '',
      NumMedia: parsedPayload.NumMedia || '0',
      MediaUrl0: parsedPayload.MediaUrl0,
      MediaContentType0: parsedPayload.MediaContentType0,
      MessageStatus: parsedPayload.MessageStatus,
      SmsStatus: parsedPayload.SmsStatus,
      SmsSid: parsedPayload.SmsSid,
      SmsMessageSid: parsedPayload.SmsMessageSid,
      ErrorCode: parsedPayload.ErrorCode,
      ErrorMessage: parsedPayload.ErrorMessage,
    }

    // Log the incoming webhook for debugging (sanitized)
    console.log('Twilio webhook received:', sanitizeWebhookPayload({
      requestId,
      MessageSid: payload.MessageSid,
      From: payload.From,
      To: payload.To,
      Body: payload.Body,
      MessageStatus: payload.MessageStatus,
    }))

    // Process the webhook with circuit breaker and retry logic
    const result = await webhookCircuitBreaker.execute(async () => {
      return await webhookRetryHandler.executeWithRetry(async () => {
        // Process the webhook based on type
        if (payload.MessageSid && payload.Body) {
          // This is an incoming message
          const message = await twilioService.processInboundWebhook(payload)
          
          if (!message) {
            throw new Error('Failed to process inbound message')
          }

          console.log('Successfully processed inbound message:', message.id)
          
          // TODO: Broadcast real-time update to connected clients
          // await broadcastMessageUpdate(message)
          
          return { 
            success: true, 
            messageId: message.id,
            type: 'inbound_message',
          }
        } else if (payload.MessageStatus || payload.SmsStatus) {
          // This is a status update
          await twilioService.processStatusUpdate(payload)
          
          console.log('Successfully processed status update:', {
            MessageSid: payload.MessageSid,
            Status: payload.MessageStatus || payload.SmsStatus,
          })
          
          return { 
            success: true,
            type: 'status_update',
            messageSid: payload.MessageSid,
          }
        } else {
          throw new Error('Unknown webhook payload type')
        }
      }, `twilio-webhook-${requestId}`)
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Twilio webhook processing error:', error)
    return twilioErrorHandler.handleProcessingError(
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
  // Some webhook services send GET requests for verification
  return NextResponse.json({ 
    message: 'Twilio webhook endpoint is active',
    timestamp: new Date().toISOString(),
  })
}