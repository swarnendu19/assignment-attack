import { NextRequest, NextResponse } from 'next/server';
import { MessageChannel } from '@prisma/client';
import { IntegrationFactory } from '@/lib/integrations/integration-factory';
import { EmailIntegration } from '@/lib/integrations/email';
import { MessageService } from '@/lib/services/message-service';
import { WebhookPayload } from '@/lib/types/message';

export async function POST(request: NextRequest) {
    try {
        // Get the raw payload
        const rawPayload = await request.json();

        // Get signature from headers (Resend uses different header names)
        const signature = request.headers.get('resend-signature') ||
            request.headers.get('x-resend-signature') ||
            request.headers.get('signature');

        // Get email integration
        const integration = IntegrationFactory.create(MessageChannel.EMAIL) as EmailIntegration;

        // Validate webhook signature
        if (!integration.validateWebhook(rawPayload, signature || undefined)) {
            console.warn('Invalid email webhook signature');
            return NextResponse.json(
                { error: 'Invalid signature' },
                { status: 401 }
            );
        }

        // Create webhook payload
        const webhookPayload: WebhookPayload = {
            source: 'resend',
            timestamp: new Date(),
            rawPayload,
            headers: Object.fromEntries(request.headers.entries())
        };

        // Process the webhook based on type
        const eventType = rawPayload.type;

        switch (eventType) {
            case 'email.sent':
                // This could be an inbound email or status update
                try {
                    const unifiedMessage = await integration.receive(webhookPayload);

                    // Save message using MessageService
                    const messageService = new MessageService();
                    const savedMessage = await messageService.createMessage(unifiedMessage);

                    console.log('Processed inbound email:', savedMessage.id);

                    return NextResponse.json({
                        success: true,
                        messageId: savedMessage.id
                    });
                } catch (error: any) {
                    if (error.code === 'NOT_INBOUND_MESSAGE') {
                        // This is expected for outbound emails or status updates
                        console.log('Received outbound email webhook, ignoring');
                        return NextResponse.json({ success: true, ignored: true });
                    }
                    throw error;
                }

            case 'email.delivered':
            case 'email.bounced':
            case 'email.complained':
            case 'email.opened':
            case 'email.clicked':
                // Handle status updates
                await handleEmailStatusUpdate(rawPayload);
                return NextResponse.json({ success: true, type: 'status_update' });

            default:
                console.warn(`Unknown email webhook type: ${eventType}`);
                return NextResponse.json(
                    { error: 'Unknown webhook type' },
                    { status: 400 }
                );
        }

    } catch (error: any) {
        console.error('Email webhook processing error:', error);

        // Return appropriate error response
        if (error.code === 'INVALID_WEBHOOK_PAYLOAD') {
            return NextResponse.json(
                { error: 'Invalid payload' },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

async function handleEmailStatusUpdate(payload: any) {
    try {
        const messageService = new MessageService();
        const emailId = payload.data?.email_id;

        if (!emailId) {
            console.warn('Email status update missing email_id');
            return;
        }

        // Find the message by external ID
        const message = await messageService.findByExternalId(emailId, MessageChannel.EMAIL);

        if (!message) {
            console.warn(`Message not found for email ID: ${emailId}`);
            return;
        }

        // Update message status based on event type
        let newStatus;
        switch (payload.type) {
            case 'email.delivered':
                newStatus = 'DELIVERED';
                break;
            case 'email.bounced':
                newStatus = 'FAILED';
                break;
            case 'email.complained':
                newStatus = 'FAILED';
                break;
            case 'email.opened':
                // Update metadata to track opens
                await messageService.updateMessageMetadata(message.id, {
                    ...message.metadata,
                    channelSpecific: {
                        ...message.metadata.channelSpecific,
                        opened: true,
                        openedAt: new Date().toISOString()
                    }
                });
                return;
            case 'email.clicked':
                // Update metadata to track clicks
                await messageService.updateMessageMetadata(message.id, {
                    ...message.metadata,
                    channelSpecific: {
                        ...message.metadata.channelSpecific,
                        clicked: true,
                        clickedAt: new Date().toISOString()
                    }
                });
                return;
            default:
                return;
        }

        if (newStatus) {
            await messageService.updateMessageStatus(message.id, newStatus as any);
        }

        console.log(`Updated email status for ${emailId}: ${newStatus || 'metadata'}`);

    } catch (error) {
        console.error('Error handling email status update:', error);
    }
}

// Handle GET requests for webhook verification (if needed)
export async function GET(request: NextRequest) {
    // Some email services require webhook verification
    const challenge = request.nextUrl.searchParams.get('challenge');

    if (challenge) {
        return NextResponse.json({ challenge });
    }

    return NextResponse.json(
        { error: 'Method not allowed' },
        { status: 405 }
    );
}