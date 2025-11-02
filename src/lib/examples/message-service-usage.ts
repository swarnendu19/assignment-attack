/**
 * Example usage of MessageService and related utilities
 * This file demonstrates how to use the core message functionality
 */

import { MessageService } from '../services/message-service';
import { MessageNormalizer } from '../services/message-normalizer';
import { generateThreadId } from '../utils/thread-utils';
import { CreateMessageInput, WebhookPayload } from '../types/message';

// Example: Creating a new outbound message
async function createOutboundMessage() {
    const messageService = new MessageService();

    const messageInput: CreateMessageInput = {
        contactId: 'contact_123',
        userId: 'user_456',
        channel: 'SMS',
        direction: 'OUTBOUND',
        content: {
            text: 'Hello! How can I help you today?',
            type: 'text'
        },
        metadata: {
            channelId: 'twilio-sms',
            externalId: 'pending',
            channelSpecific: {
                from: '+1234567890',
                to: '+0987654321'
            }
        }
    };

    const message = await messageService.createMessage(messageInput);
    console.log('Created message:', message.id);
    return message;
}

// Example: Processing an incoming webhook
async function processIncomingWebhook() {
    const messageService = new MessageService();

    // Example Twilio SMS webhook payload
    const webhookPayload: WebhookPayload = {
        channel: 'SMS',
        rawPayload: {
            MessageSid: 'SM123456789',
            AccountSid: 'AC123456789',
            From: '+0987654321',
            To: '+1234567890',
            Body: 'Thanks for your help!',
            NumMedia: '0'
        },
        timestamp: new Date()
    };

    const result = await messageService.processWebhook(webhookPayload);

    if (result.success && result.message) {
        console.log('Processed incoming message:', result.message.id);
        console.log('Thread ID:', result.message.threadId);
    } else {
        console.error('Failed to process webhook:', result.error);
    }

    return result;
}

// Example: Getting messages for a conversation thread
async function getConversationMessages() {
    const messageService = new MessageService();

    // Generate thread ID for a contact and channel
    const threadId = generateThreadId({
        contactId: 'contact_123',
        channel: 'SMS'
    });

    // Get all messages in the thread
    const messages = await messageService.getMessagesByThread(threadId, {
        limit: 50,
        orderDirection: 'asc' // Chronological order
    });

    console.log(`Found ${messages.length} messages in thread ${threadId}`);

    // Get thread information
    const threadInfo = await messageService.getThreadInfo(threadId);
    if (threadInfo) {
        console.log(`Thread has ${threadInfo.messageCount} total messages`);
        console.log(`${threadInfo.unreadCount} unread messages`);
    }

    return messages;
}

// Example: Searching messages with filters
async function searchMessages() {
    const messageService = new MessageService();

    const result = await messageService.getMessages(
        {
            channel: 'SMS',
            status: 'DELIVERED',
            searchText: 'help',
            dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        },
        {
            limit: 20,
            orderBy: 'createdAt',
            orderDirection: 'desc'
        }
    );

    console.log(`Found ${result.messages.length} messages matching search`);
    console.log(`Total: ${result.total}, Has more: ${result.hasMore}`);

    return result;
}

// Example: Scheduling a message
async function scheduleMessage() {
    const messageService = new MessageService();

    const scheduledTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    const messageInput: CreateMessageInput = {
        contactId: 'contact_123',
        userId: 'user_456',
        channel: 'EMAIL',
        direction: 'OUTBOUND',
        content: {
            text: 'This is a scheduled follow-up message.',
            subject: 'Follow-up: Your inquiry',
            type: 'text'
        },
        scheduledAt: scheduledTime
    };

    const message = await messageService.createMessage(messageInput);
    console.log('Scheduled message:', message.id, 'for', scheduledTime);

    return message;
}

// Example: Marking messages as read
async function markConversationAsRead() {
    const messageService = new MessageService();

    const threadId = generateThreadId({
        contactId: 'contact_123',
        channel: 'SMS'
    });

    const updatedCount = await messageService.markThreadAsRead(threadId, 'user_456');
    console.log(`Marked ${updatedCount} messages as read in thread ${threadId}`);

    return updatedCount;
}

// Example: Getting scheduled messages ready to send
async function getMessagesReadyToSend() {
    const messageService = new MessageService();

    const readyMessages = await messageService.getMessagesReadyForSending();
    console.log(`Found ${readyMessages.length} messages ready to send`);

    // Process each ready message
    for (const message of readyMessages) {
        console.log(`Processing scheduled message ${message.id} for ${message.channel}`);

        // Update status to indicate processing
        await messageService.updateMessageStatus(message.id, 'PENDING');

        // Here you would integrate with the actual sending service
        // For example: await twilioService.sendSMS(message);

        // Update status after successful send
        await messageService.updateMessageStatus(message.id, 'SENT');
    }

    return readyMessages;
}

// Export example functions for testing or demonstration
export {
    createOutboundMessage,
    processIncomingWebhook,
    getConversationMessages,
    searchMessages,
    scheduleMessage,
    markConversationAsRead,
    getMessagesReadyToSend
};