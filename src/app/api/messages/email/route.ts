import { NextRequest, NextResponse } from 'next/server'
import { emailService, EmailSendRequest } from '@/services/emailService'
import { messageService } from '@/services/messageService'
import { ChannelType, Direction } from '@prisma/client'
import { EmailMessage } from '@/types/messages'
import { z } from 'zod'

// Validation schema for email send request
const EmailSendSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email())]),
  subject: z.string().min(1, 'Subject is required'),
  text: z.string().optional(),
  html: z.string().optional(),
  replyTo: z.string().email().optional(),
  contactId: z.string().optional(),
  conversationId: z.string().optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    content: z.string(), // base64 encoded
    contentType: z.string().optional(),
  })).optional(),
  tags: z.array(z.object({
    name: z.string(),
    value: z.string(),
  })).optional(),
}).refine(data => data.text || data.html, {
  message: 'Either text or html content is required',
})

/**
 * Send email message
 * POST /api/messages/email
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json()
    const validatedData = EmailSendSchema.parse(body)

    // Prepare attachments if provided
    const attachments = validatedData.attachments?.map(att => ({
      filename: att.filename,
      content: Buffer.from(att.content, 'base64'),
      contentType: att.contentType,
    }))

    // Prepare email send request
    const emailRequest: EmailSendRequest = {
      to: validatedData.to,
      subject: validatedData.subject,
      text: validatedData.text,
      html: validatedData.html,
      replyTo: validatedData.replyTo,
      attachments,
      tags: validatedData.tags,
    }

    // Send the email
    const sendResult = await emailService.sendEmail(emailRequest)

    if (!sendResult.success) {
      return NextResponse.json(
        { error: sendResult.error },
        { status: 400 }
      )
    }

    // Store the outbound message in our system
    if (sendResult.messageId) {
      try {
        const recipients = Array.isArray(validatedData.to) ? validatedData.to : [validatedData.to]
        
        // Create a raw email message for storage
        const rawMessage: EmailMessage = {
          channel: ChannelType.EMAIL,
          externalId: sendResult.messageId,
          direction: Direction.OUTBOUND,
          timestamp: new Date(),
          rawData: {
            messageId: sendResult.messageId,
            from: process.env.FROM_EMAIL || 'noreply@yourdomain.com',
            to: recipients[0], // Store primary recipient
            subject: validatedData.subject,
            text: validatedData.text,
            html: validatedData.html,
            attachments: attachments?.map(att => ({
              filename: att.filename,
              contentType: att.contentType || 'application/octet-stream',
              content: att.content as Buffer,
            })),
          },
        }

        // Normalize and store the message
        const normalizedMessage = await messageService.normalizeMessage(rawMessage)
        const storedMessage = await messageService.storeMessage(normalizedMessage)

        console.log('Email sent and stored:', {
          emailId: sendResult.messageId,
          messageId: storedMessage.id,
          recipients: recipients.length,
        })

        // TODO: Broadcast real-time update to connected clients
        // await broadcastMessageUpdate(storedMessage)

        return NextResponse.json({
          success: true,
          emailId: sendResult.messageId,
          messageId: storedMessage.id,
          recipients: recipients.length,
        })
      } catch (storageError) {
        console.error('Failed to store sent email:', storageError)
        // Email was sent successfully, but storage failed
        // Return success but log the storage error
        return NextResponse.json({
          success: true,
          emailId: sendResult.messageId,
          warning: 'Email sent but failed to store in database',
        })
      }
    }

    return NextResponse.json({
      success: true,
      emailId: sendResult.messageId,
    })
  } catch (error) {
    console.error('Email send error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation error',
          details: error.errors,
        },
        { status: 400 }
      )
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to send email'
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

/**
 * Get email sending capabilities and configuration
 * GET /api/messages/email
 */
export async function GET(request: NextRequest) {
  try {
    // Return email service capabilities
    return NextResponse.json({
      service: 'resend',
      fromEmail: process.env.FROM_EMAIL || 'noreply@yourdomain.com',
      capabilities: {
        html: true,
        attachments: true,
        multipleRecipients: true,
        replyTo: true,
        tags: true,
        templates: false, // Could be added later
      },
      limits: {
        maxRecipients: 50, // Resend limit
        maxAttachmentSize: 25 * 1024 * 1024, // 25MB
        maxAttachments: 10,
      },
    })
  } catch (error) {
    console.error('Error getting email capabilities:', error)
    
    return NextResponse.json(
      { error: 'Failed to get email capabilities' },
      { status: 500 }
    )
  }
}