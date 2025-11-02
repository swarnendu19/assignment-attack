import { MessageChannel } from '@prisma/client';
import { ThreadIdOptions, MessageThread } from '../types/message';
import crypto from 'crypto';

/**
 * Thread utilities for managing message threading and conversation grouping
 */

/**
 * Generate a unique thread ID for a conversation
 * Format: {contactId}_{channel}_{groupId?}
 */
export function generateThreadId(options: ThreadIdOptions): string {
    const { contactId, channel, groupId } = options;

    // Base thread ID with contact and channel
    let threadId = `${contactId}_${channel.toLowerCase()}`;

    // Add group ID for group conversations (WhatsApp groups, etc.)
    if (groupId) {
        threadId += `_${groupId}`;
    }

    return threadId;
}

/**
 * Parse a thread ID to extract its components
 */
export function parseThreadId(threadId: string): {
    contactId: string;
    channel: string;
    groupId?: string;
} {
    // Thread ID format: {contactId}_{channel}_{groupId?}
    // We need to find the channel part by looking for known channel names
    const knownChannels = ['sms', 'whatsapp', 'email', 'twitter', 'facebook', 'instagram', 'linkedin'];

    let contactId = '';
    let channel = '';
    let groupId: string | undefined;

    // Find the channel in the thread ID
    for (const knownChannel of knownChannels) {
        const channelIndex = threadId.indexOf(`_${knownChannel}`);
        if (channelIndex !== -1) {
            contactId = threadId.substring(0, channelIndex);
            const afterChannel = threadId.substring(channelIndex + knownChannel.length + 1);
            channel = knownChannel.toUpperCase();

            // Check if there's a group ID after the channel
            if (afterChannel.startsWith('_')) {
                groupId = afterChannel.substring(1);
            }
            break;
        }
    }

    if (!contactId || !channel) {
        throw new Error(`Invalid thread ID format: ${threadId}`);
    }

    return {
        contactId,
        channel,
        groupId
    };
}

/**
 * Generate a conversation hash for deduplication
 * Used to identify if a conversation already exists between participants
 */
export function generateConversationHash(participants: string[], channel: MessageChannel): string {
    // Sort participants to ensure consistent hash regardless of order
    const sortedParticipants = [...participants].sort();
    const hashInput = `${sortedParticipants.join('|')}|${channel}`;

    return crypto
        .createHash('sha256')
        .update(hashInput)
        .digest('hex')
        .substring(0, 16); // Use first 16 characters for brevity
}

/**
 * Check if two thread IDs belong to the same conversation
 */
export function isSameConversation(threadId1: string, threadId2: string): boolean {
    try {
        const thread1 = parseThreadId(threadId1);
        const thread2 = parseThreadId(threadId2);

        return (
            thread1.contactId === thread2.contactId &&
            thread1.channel === thread2.channel &&
            thread1.groupId === thread2.groupId
        );
    } catch {
        return false;
    }
}

/**
 * Get the primary thread ID for a contact and channel combination
 * This is used when we need to find the main conversation thread
 */
export function getPrimaryThreadId(contactId: string, channel: MessageChannel): string {
    return generateThreadId({ contactId, channel });
}

/**
 * Extract contact ID from thread ID
 */
export function getContactIdFromThreadId(threadId: string): string {
    try {
        const parsed = parseThreadId(threadId);
        return parsed.contactId;
    } catch {
        throw new Error(`Cannot extract contact ID from thread ID: ${threadId}`);
    }
}

/**
 * Extract channel from thread ID
 */
export function getChannelFromThreadId(threadId: string): MessageChannel {
    try {
        const parsed = parseThreadId(threadId);
        return parsed.channel as MessageChannel;
    } catch {
        throw new Error(`Cannot extract channel from thread ID: ${threadId}`);
    }
}

/**
 * Validate thread ID format
 */
export function isValidThreadId(threadId: string): boolean {
    try {
        parseThreadId(threadId);
        return true;
    } catch {
        return false;
    }
}

/**
 * Generate a group thread ID for multi-participant conversations
 */
export function generateGroupThreadId(
    contactIds: string[],
    channel: MessageChannel,
    groupIdentifier?: string
): string {
    // For group conversations, we use the first contact as the primary
    // and create a group identifier from all participants
    const primaryContactId = contactIds[0];

    let groupId: string;
    if (groupIdentifier) {
        groupId = groupIdentifier;
    } else {
        // Generate group ID from participant hash
        groupId = generateConversationHash(contactIds, channel);
    }

    return generateThreadId({
        contactId: primaryContactId,
        channel,
        groupId
    });
}

/**
 * Check if a thread ID represents a group conversation
 */
export function isGroupThread(threadId: string): boolean {
    try {
        const parsed = parseThreadId(threadId);
        return !!parsed.groupId;
    } catch {
        return false;
    }
}

/**
 * Merge thread IDs when contacts are merged
 * Returns the canonical thread ID to use after merge
 */
export function mergeThreadIds(
    primaryContactId: string,
    secondaryContactId: string,
    channel: MessageChannel
): {
    canonicalThreadId: string;
    obsoleteThreadId: string;
} {
    const canonicalThreadId = generateThreadId({
        contactId: primaryContactId,
        channel
    });

    const obsoleteThreadId = generateThreadId({
        contactId: secondaryContactId,
        channel
    });

    return {
        canonicalThreadId,
        obsoleteThreadId
    };
}

/**
 * Generate thread metadata for analytics and reporting
 */
export function generateThreadMetadata(threadId: string): {
    type: 'direct' | 'group';
    channel: string;
    contactId: string;
    groupId?: string;
} {
    const parsed = parseThreadId(threadId);

    return {
        type: parsed.groupId ? 'group' : 'direct',
        channel: parsed.channel,
        contactId: parsed.contactId,
        groupId: parsed.groupId
    };
}