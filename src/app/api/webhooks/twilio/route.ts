import { NextRequest, NextResponse } from 'next/server';
import { MessageChannel } from '@prisma/client';
import { IntegrationFactory } from '@/lib/integrations/integration-factory';
import { TwilioSMSIntegration } from '@/lib/integrations/twilio-sms';
import { TwilioWhatsAppIntegration } from '@/lib/integrations/twilio-whatsapp';
import { MessageService } from '@/lib/services/message-service';
import { WebhookPayload } from '@/lib/types/message';

export async function POST(request: NextRequest) {
    try {
        // Parse the request body
        const body = await request.text();
        const formData = new URLSearchParams(body);
        const payload: Record<string, string> = {};

        // Convert form data to object
        for (const [key, value] of formData.entries()) {
            payload[key] = value;
        }

        // Get Twilio signature for validation
        const twilioSignature = request.headers.get('X-Twilio-Signature');

        if (!twilioSignature) {
            console.error('Missing Twilio signature header');
            return NextResponse.json(
                { error: 'Missing signature header' },
                { status: 401 }
            );
        }

        // Determine if this is SMS or WhatsApp based on the 'From' field
        const from = payload.From;
        const isWhatsApp = from?.startsWith('whatsapp:');
        const channel = isWhatsApp ? MessageChannel.WHATSAPP : MessageChannel.SMS;

        // Get the appropriate integration
        let integration: TwilioSMSIntegration | TwilioWhatsAppIntegration;

        try {
            if (isWhatsApp) {
                integration = IntegrationFactory.create(MessageChannel.WHATSAPP) as TwilioWhatsAppIntegration;
            } else {
                integration = IntegrationFactory.create(MessageChannel.SMS) as TwilioSMSIntegration;
            }
        } catch (error) {
            console.error(`Integration not available for channel: ${channel}`, error);
            return NextResponse.json(
                { error: `Integration not configured for ${channel}` },
                { status: 503 }
            );
        }

        // Validate webhook signature
        const isValidSignature = integration.validateWebhook(payload, twilioSignature);

        if (!isValidSignature) {
            console.error('Invalid Twilio webhook signature');
            return NextResponse.json(
                { error: 'Invalid signature' },
                { status: 401 }
            );
        }

        // Check if this is a status update or a new message
        const isStatusUpdate = payload.MessageStatus || payload.SmsStatus;

        if (isStatusUpdate) {
            // Handle status update
            await handleStatusUpdate(payload, channel);
            return NextResponse.json({ status: 'status_update_processed' });
        }

        // Process incoming message
        const webhookPayload: WebhookPayload = {
            channel,
            rawPayload: payload,
            signature: twilioSignature,
            timestamp: new Date()
        };

        // Convert webhook to unified message
        const unifiedMessage = await integration.receive(webhookPayload);

        // Save message using MessageService
        const messageService = new MessageService();
        const savedMessage = await messageService.createFromWebhook(unifiedMessage, payload.From);

        console.log(`Processed ${channel} message:`, {
            messageId: savedMessage.id,
            externalId: unifiedMessage.metadata.externalId,
            from: payload.From,
            hasMedia: unifiedMessage.content.media?.length || 0
        });

        // Return success response (Twilio expects 200 OK)
        return NextResponse.json({
            status: 'success',
            messageId: savedMessage.id
        });

    } catch (error) {
        console.error('Error processing Twilio webhook:', error);

        // Return 200 to prevent Twilio retries for application errors
        // Log the error for debugging but don't expose internal details
        return NextResponse.json(
            {
                status: 'error',
                message: 'Internal processing error'
            },
            { status: 200 }
        );
    }
}

async function handleStatusUpdate(payload: Record<string, string>, channel: MessageChannel) {
    try {
        const messageService = new MessageService();

        // Extract status information
        const externalId = payload.MessageSid || payload.SmsSid || payload.SmsMessageSid;
        const status = payload.MessageStatus || payload.SmsStatus;

        if (!externalId || !status) {
            console.warn('Status update missing required fields:', payload);
            return;
        }

        // Map Twilio status to our MessageStatus
        const mappedStatus = mapTwilioStatus(status);

        if (mappedStatus) {
            await messageService.updateMessageStatus(externalId, mappedStatus, {
                twilioStatus: status,
                price: payload.Price,
                priceUnit: payload.PriceUnit,
                errorCode: payload.ErrorCode,
                errorMessage: payload.ErrorMessage,
                updatedAt: new Date()
            });

            console.log(`Updated message status:`, {
                externalId,
                status: mappedStatus,
                twilioStatus: status
            });
        }

    } catch (error) {
        console.error('Error handling status update:', error);
    }
}

function mapTwilioStatus(twilioStatus: string): string | null {
    const statusMap: Record<string, string> = {
        'queued': 'PENDING',
        'sending': 'PENDING',
        'sent': 'SENT',
        'delivered': 'DELIVERED',
        'undelivered': 'FAILED',
        'failed': 'FAILED',
        'read': 'READ', // WhatsApp only
        'received': 'DELIVERED',
        'accepted': 'PENDING'
    };

    return statusMap[twilioStatus.toLowerCase()] || null;
}

// Handle GET requests for webhook verification (if needed)
export async function GET(request: NextRequest) {
    return NextResponse.json({
        status: 'Twilio webhook endpoint active',
        timestamp: new Date().toISOString()
    });
}