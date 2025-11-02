import { NextRequest, NextResponse } from 'next/server'
import { socialMediaService } from '@/services/socialMediaService'
import { twitterService } from '@/services/twitterService'
import { 
  validateTwitterWebhook, 
  parseTwitterWebhookPayload, 
  validateTwitterWebhookFields,
  sanitizeTwitterWebhookPayload,
  webhookRateLimiter 
} from '@/lib/webhookValidation'
import { 
  webhookRetryHandler, 
  webhookCircuitBreaker 
} from '@/lib/webhookErrorHandler'

/**
 * Twitter webhook handler for Account Activity API
 * POST /api/webhooks/twitter
 */
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  
  try {
    // Rate limiting check
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown'
    if (!webhookRateLimiter.isAllowed(clientIp)) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          remaining: webhookRateLimiter.getRemainingRequests(clientIp),
          resetTime: webhookRateLimiter.getResetTime(clientIp)
        },
        { status: 429 }
      )
    }

    // Get raw payload for signature validation
    const payload = await request.text()
    const signature = request.headers.get('x-twitter-webhooks-signature')

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing Twitter webhook signature' },
        { status: 401 }
      )
    }

    // Validate webhook signature using Twitter service
    if (!socialMediaService.validateWebhook('twitter', payload, signature)) {
      return NextResponse.json(
        { error: 'Invalid Twitter webhook signature' },
        { status: 401 }
      )
    }

    // Parse the JSON payload
    let parsedPayload: any
    try {
      parsedPayload = parseTwitterWebhookPayload(payload)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      )
    }

    // Log the incoming webhook for debugging (sanitized)
    console.log('Twitter webhook received:', sanitizeTwitterWebhookPayload({
      requestId,
      for_user_id: parsedPayload.for_user_id,
      event_count: parsedPayload.direct_message_events?.length || 0,
      timestamp: new Date().toISOString(),
    }))

    // Process the webhook with circuit breaker and retry logic
    const result = await webhookCircuitBreaker.execute(async () => {
      return await webhookRetryHandler.executeWithRetry(async () => {
        // Check if this is a direct message event
        if (parsedPayload.direct_message_events && parsedPayload.direct_message_events.length > 0) {
          // Process the inbound message
          const message = await socialMediaService.processInboundWebhook('twitter', parsedPayload)
          
          if (!message) {
            throw new Error('Failed to process Twitter direct message')
          }

          console.log('Successfully processed Twitter DM:', message.id)
          
          // TODO: Broadcast real-time update to connected clients
          // await broadcastMessageUpdate(message)
          
          return { 
            success: true, 
            messageId: message.id,
            type: 'direct_message',
            platform: 'twitter',
          }
        } else if (parsedPayload.direct_message_indicate_typing_events) {
          // Handle typing indicators
          console.log('Twitter typing indicator received')
          
          // TODO: Broadcast typing indicator to connected clients
          
          return { 
            success: true,
            type: 'typing_indicator',
            platform: 'twitter',
          }
        } else {
          // Unknown event type
          console.log('Unknown Twitter webhook event:', Object.keys(parsedPayload))
          
          return { 
            success: true,
            type: 'unknown',
            platform: 'twitter',
          }
        }
      }, `twitter-webhook-${requestId}`)
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Twitter webhook processing error:', error)
    return NextResponse.json(
      { 
        error: 'Webhook processing failed',
        requestId,
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Handle GET requests for webhook verification (CRC)
 * Twitter sends a CRC challenge to verify the webhook endpoint
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const crcToken = searchParams.get('crc_token')

    if (!crcToken) {
      return NextResponse.json(
        { error: 'Missing crc_token parameter' },
        { status: 400 }
      )
    }

    // Handle the CRC challenge using Twitter service
    const response = socialMediaService.handleWebhookChallenge('twitter', { crc_token: crcToken })
    
    if (!response) {
      return NextResponse.json(
        { error: 'Failed to generate CRC response' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      response_token: response
    })
  } catch (error) {
    console.error('Twitter CRC challenge error:', error)
    return NextResponse.json(
      { error: 'CRC challenge failed' },
      { status: 500 }
    )
  }
}