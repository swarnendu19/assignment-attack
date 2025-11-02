import { NextRequest, NextResponse } from 'next/server'
import { twilioService, TwilioWebhookPayload } from '@/services/twilioService'

/**
 * Twilio webhook handler specifically for message status updates
 * POST /api/webhooks/twilio/status
 */
export async function POST(request: NextRequest) {
  try {
    // Get the raw body for signature validation
    const body = await request.text()
    const signature = request.headers.get('x-twilio-signature')
    const url = request.url

    // Validate webhook signature
    if (!signature || !twilioService.validateWebhookSignature(body, signature, url)) {
      console.error('Invalid Twilio webhook signature for status update')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Parse the form data
    const formData = new URLSearchParams(body)
    const payload: TwilioWebhookPayload = {
      MessageSid: formData.get('MessageSid') || '',
      AccountSid: formData.get('AccountSid') || '',
      From: formData.get('From') || '',
      To: formData.get('To') || '',
      Body: formData.get('Body') || '',
      NumMedia: formData.get('NumMedia') || '0',
      MessageStatus: formData.get('MessageStatus') || undefined,
      SmsStatus: formData.get('SmsStatus') || undefined,
      SmsSid: formData.get('SmsSid') || undefined,
      SmsMessageSid: formData.get('SmsMessageSid') || undefined,
      ErrorCode: formData.get('ErrorCode') || undefined,
      ErrorMessage: formData.get('ErrorMessage') || undefined,
    }

    // Log the status update
    console.log('Twilio status update received:', {
      MessageSid: payload.MessageSid,
      Status: payload.MessageStatus || payload.SmsStatus,
      ErrorCode: payload.ErrorCode,
      ErrorMessage: payload.ErrorMessage,
    })

    // Process the status update
    await twilioService.processStatusUpdate(payload)

    // TODO: Broadcast real-time status update to connected clients
    // await broadcastStatusUpdate(payload.MessageSid, payload.MessageStatus || payload.SmsStatus)

    return NextResponse.json({ 
      success: true,
      processed: 'status_update',
      messageSid: payload.MessageSid,
    })
  } catch (error) {
    console.error('Twilio status webhook processing error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Handle GET requests for webhook verification
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Twilio status webhook endpoint is active',
    timestamp: new Date().toISOString(),
  })
}