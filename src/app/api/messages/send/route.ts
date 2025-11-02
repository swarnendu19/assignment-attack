import { NextRequest, NextResponse } from 'next/server'
import { ChannelType, Direction } from '@prisma/client'
import { twilioService } from '@/services/twilioService'
import { messageService } from '@/services/messageService'
import { z } from 'zod'

// Validation schema for send message request
const SendMessageSchema = z.object({
  to: z.string().min(1, 'Recipient is required'),
  message: z.string().min(1, 'Message content is required'),
  channel: z.nativeEnum(ChannelType),
  mediaUrls: z.array(z.string().url()).optional(),
  contactId: z.string().optional(),
})

type SendMessageRequest = z.infer<typeof SendMessageSchema>

/**
 * Send message through specified channel
 * POST /api/messages/send
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate request body
    const validatedData = SendMessageSchema.parse(body)
    const { to, message, channel, mediaUrls, contactId } = validatedData

    let sendResult
    let externalId: string

    // Send message based on channel type
    switch (channel) {
      case ChannelType.SMS:
        sendResult = await twilioService.sendSMS({
          to,
          body: message,
          mediaUrl: mediaUrls,
        })
        break

      case ChannelType.WHATSAPP:
        sendResult = await twilioService.sendWhatsApp({
          to,
          body: message,
          mediaUrl: mediaUrls,
        })
        break

      default:
        return NextResponse.json(
          { error: `Channel ${channel} not supported yet` },
          { status: 400 }
        )
    }

    // Check if message was sent successfully
    if (!sendResult.success) {
      return NextResponse.json(
        { 
          error: 'Failed to send message',
          details: sendResult.error,
        },
        { status: 500 }
      )
    }

    externalId = sendResult.messageId!

    // Create unified message for storage
    const unifiedMessage = await messageService.normalizeMessage({
      channel,
      externalId,
      direction: Direction.OUTBOUND,
      timestamp: new Date(),
      rawData: {
        MessageSid: externalId,
        From: process.env.TWILIO_PHONE_NUMBER!,
        To: to,
        Body: message,
        NumMedia: mediaUrls?.length?.toString() || '0',
        MediaUrl0: mediaUrls?.[0],
        MessageStatus: sendResult.status,
      },
    })

    // Store the message
    const storedMessage = await messageService.storeMessage(unifiedMessage)

    // TODO: Broadcast real-time update to connected clients
    // await broadcastMessageUpdate(storedMessage)

    return NextResponse.json({
      success: true,
      messageId: storedMessage.id,
      externalId,
      status: sendResult.status,
      message: {
        id: storedMessage.id,
        content: storedMessage.content,
        channel: storedMessage.channel,
        direction: storedMessage.direction,
        timestamp: storedMessage.timestamp,
        status: storedMessage.status,
      },
    })
  } catch (error) {
    console.error('Send message error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: error.errors,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}