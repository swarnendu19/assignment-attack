import { NextRequest, NextResponse } from 'next/server'
import { socialMediaService } from '@/services/socialMediaService'
import { 
  validateFacebookWebhook, 
  parseFacebookWebhookPayload, 
  validateFacebookWebhookFields,
  sanitizeFacebookWebhookPayload,
  webhookRateLimiter 
} from '@/lib/webhookValidation'
import { 
  webhookRetryHandler, 
  webhookCircuitBreaker 
} from '@/lib/webhookErrorHandler'

/**
 * Facebook webhook handler for Messenger Platform
 * POST /api/webhooks/facebook
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
    const signature = request.headers.get('x-hub-signature-256')

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing Facebook webhook signature' },
        { status: 401 }
      )
    }

    // Validate webhook signature using Facebook service
    if (!socialMediaService.validateWebhook('facebook', payload, signature)) {
      return NextResponse.json(
        { error: 'Invalid Facebook webhook signature' },
        { status: 401 }
      )
    }

    // Parse the JSON payload
    let parsedPayload: any
    try {
      parsedPayload = parseFacebookWebhookPayload(payload)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      )
    }

    // Validate that this is a page webhook
    if (parsedPayload.object !== 'page') {
      return NextResponse.json(
        { error: 'Invalid webhook object type' },
        { status: 400 }
      )
    }

    // Validate required fields
    const requiredFields = ['object', 'entry']
    const fieldValidation = validateFacebookWebhookFields(parsedPayload, requiredFields)
    if (!fieldValidation.isValid) {
      return NextResponse.json(
        { 
          error: `Missing required fields: ${fieldValidation.missingFields?.join(', ')}`,
          missingFields: fieldValidation.missingFields 
        },
        { status: 400 }
      )
    }

    // Log the incoming webhook for debugging (sanitized)
    console.log('Facebook webhook received:', sanitizeFacebookWebhookPayload({
      requestId,
      object: parsedPayload.object,
      entry_count: parsedPayload.entry?.length || 0,
      timestamp: new Date().toISOString(),
    }))

    // Process the webhook with circuit breaker and retry logic
    const result = await webhookCircuitBreaker.execute(async () => {
      return await webhookRetryHandler.executeWithRetry(async () => {
        const results = []

        // Process each entry in the webhook
        for (const entry of parsedPayload.entry) {
          if (entry.messaging && entry.messaging.length > 0) {
            // Process messaging events
            for (const messagingEvent of entry.messaging) {
              if (messagingEvent.message && messagingEvent.message.text) {
                // This is an incoming message
                const message = await socialMediaService.processInboundWebhook('facebook', {
                  object: 'page',
                  entry: [{ ...entry, messaging: [messagingEvent] }]
                })
                
                if (message) {
                  console.log('Successfully processed Facebook message:', message.id)
                  
                  // TODO: Broadcast real-time update to connected clients
                  // await broadcastMessageUpdate(message)
                  
                  results.push({
                    success: true,
                    messageId: message.id,
                    type: 'message',
                    platform: 'facebook',
                  })
                }
              } else if (messagingEvent.delivery) {
                // Handle delivery receipts
                console.log('Facebook delivery receipt received:', messagingEvent.delivery)
                
                results.push({
                  success: true,
                  type: 'delivery_receipt',
                  platform: 'facebook',
                })
              } else if (messagingEvent.read) {
                // Handle read receipts
                console.log('Facebook read receipt received:', messagingEvent.read)
                
                results.push({
                  success: true,
                  type: 'read_receipt',
                  platform: 'facebook',
                })
              } else if (messagingEvent.postback) {
                // Handle postback events
                console.log('Facebook postback received:', messagingEvent.postback)
                
                results.push({
                  success: true,
                  type: 'postback',
                  platform: 'facebook',
                })
              }
            }
          } else if (entry.changes) {
            // Handle page changes (feed posts, etc.)
            console.log('Facebook page changes received:', entry.changes.length)
            
            results.push({
              success: true,
              type: 'page_changes',
              platform: 'facebook',
            })
          }
        }

        return {
          success: true,
          processed: results.length,
          results,
        }
      }, `facebook-webhook-${requestId}`)
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Facebook webhook processing error:', error)
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
 * Handle GET requests for webhook verification
 * Facebook sends a verification challenge when setting up webhooks
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('hub.mode')
    const token = searchParams.get('hub.verify_token')
    const challenge = searchParams.get('hub.challenge')

    if (!mode || !token || !challenge) {
      return NextResponse.json(
        { error: 'Missing required verification parameters' },
        { status: 400 }
      )
    }

    // Handle the verification challenge using Facebook service
    const response = socialMediaService.handleWebhookChallenge('facebook', {
      mode,
      verify_token: token,
      challenge,
    })
    
    if (!response) {
      return NextResponse.json(
        { error: 'Invalid verification token' },
        { status: 403 }
      )
    }

    // Return the challenge as plain text (Facebook requirement)
    return new NextResponse(response, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
    })
  } catch (error) {
    console.error('Facebook webhook verification error:', error)
    return NextResponse.json(
      { error: 'Webhook verification failed' },
      { status: 500 }
    )
  }
}