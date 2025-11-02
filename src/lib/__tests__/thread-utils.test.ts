import {
    generateThreadId,
    parseThreadId,
    isSameConversation,
    getPrimaryThreadId,
    getContactIdFromThreadId,
    getChannelFromThreadId,
    isValidThreadId,
    generateGroupThreadId,
    isGroupThread,
    mergeThreadIds,
    generateThreadMetadata,
    generateConversationHash
} from '../utils/thread-utils';
import { MessageChannel } from '@prisma/client';

describe('Thread Utils', () => {
    describe('generateThreadId', () => {
        it('should generate thread ID for direct conversation', () => {
            const threadId = generateThreadId({
                contactId: 'contact_123',
                channel: 'SMS'
            });

            expect(threadId).toBe('contact_123_sms');
        });

        it('should generate thread ID for group conversation', () => {
            const threadId = generateThreadId({
                contactId: 'contact_123',
                channel: 'WHATSAPP',
                groupId: 'group_456'
            });

            expect(threadId).toBe('contact_123_whatsapp_group_456');
        });

        it('should handle complex group IDs', () => {
            const threadId = generateThreadId({
                contactId: 'contact_123',
                channel: 'EMAIL',
                groupId: 'complex_group_id_with_underscores'
            });

            expect(threadId).toBe('contact_123_email_complex_group_id_with_underscores');
        });
    });

    describe('parseThreadId', () => {
        it('should parse direct conversation thread ID', () => {
            const parsed = parseThreadId('contact_123_sms');

            expect(parsed).toEqual({
                contactId: 'contact_123',
                channel: 'SMS',
                groupId: undefined
            });
        });

        it('should parse group conversation thread ID', () => {
            const parsed = parseThreadId('contact_123_whatsapp_group_456');

            expect(parsed).toEqual({
                contactId: 'contact_123',
                channel: 'WHATSAPP',
                groupId: 'group_456'
            });
        });

        it('should parse complex group ID', () => {
            const parsed = parseThreadId('contact_123_email_complex_group_id_with_underscores');

            expect(parsed).toEqual({
                contactId: 'contact_123',
                channel: 'EMAIL',
                groupId: 'complex_group_id_with_underscores'
            });
        });

        it('should throw error for invalid thread ID', () => {
            expect(() => parseThreadId('invalid')).toThrow('Invalid thread ID format: invalid');
            expect(() => parseThreadId('')).toThrow('Invalid thread ID format: ');
        });
    });

    describe('isSameConversation', () => {
        it('should return true for same direct conversations', () => {
            const threadId1 = 'contact_123_sms';
            const threadId2 = 'contact_123_sms';

            expect(isSameConversation(threadId1, threadId2)).toBe(true);
        });

        it('should return true for same group conversations', () => {
            const threadId1 = 'contact_123_whatsapp_group_456';
            const threadId2 = 'contact_123_whatsapp_group_456';

            expect(isSameConversation(threadId1, threadId2)).toBe(true);
        });

        it('should return false for different contacts', () => {
            const threadId1 = 'contact_123_sms';
            const threadId2 = 'contact_456_sms';

            expect(isSameConversation(threadId1, threadId2)).toBe(false);
        });

        it('should return false for different channels', () => {
            const threadId1 = 'contact_123_sms';
            const threadId2 = 'contact_123_whatsapp';

            expect(isSameConversation(threadId1, threadId2)).toBe(false);
        });

        it('should return false for different group IDs', () => {
            const threadId1 = 'contact_123_whatsapp_group_456';
            const threadId2 = 'contact_123_whatsapp_group_789';

            expect(isSameConversation(threadId1, threadId2)).toBe(false);
        });

        it('should return false for invalid thread IDs', () => {
            expect(isSameConversation('invalid', 'contact_123_sms')).toBe(false);
            expect(isSameConversation('contact_123_sms', 'invalid')).toBe(false);
        });
    });

    describe('getPrimaryThreadId', () => {
        it('should generate primary thread ID', () => {
            const threadId = getPrimaryThreadId('contact_123', 'SMS');
            expect(threadId).toBe('contact_123_sms');
        });
    });

    describe('getContactIdFromThreadId', () => {
        it('should extract contact ID from thread ID', () => {
            const contactId = getContactIdFromThreadId('contact_123_sms');
            expect(contactId).toBe('contact_123');
        });

        it('should extract contact ID from group thread ID', () => {
            const contactId = getContactIdFromThreadId('contact_123_whatsapp_group_456');
            expect(contactId).toBe('contact_123');
        });

        it('should throw error for invalid thread ID', () => {
            expect(() => getContactIdFromThreadId('invalid')).toThrow(
                'Cannot extract contact ID from thread ID: invalid'
            );
        });
    });

    describe('getChannelFromThreadId', () => {
        it('should extract channel from thread ID', () => {
            const channel = getChannelFromThreadId('contact_123_sms');
            expect(channel).toBe('SMS');
        });

        it('should extract channel from group thread ID', () => {
            const channel = getChannelFromThreadId('contact_123_whatsapp_group_456');
            expect(channel).toBe('WHATSAPP');
        });

        it('should throw error for invalid thread ID', () => {
            expect(() => getChannelFromThreadId('invalid')).toThrow(
                'Cannot extract channel from thread ID: invalid'
            );
        });
    });

    describe('isValidThreadId', () => {
        it('should return true for valid thread IDs', () => {
            expect(isValidThreadId('contact_123_sms')).toBe(true);
            expect(isValidThreadId('contact_123_whatsapp_group_456')).toBe(true);
            expect(isValidThreadId('contact_123_email_complex_group_id')).toBe(true);
        });

        it('should return false for invalid thread IDs', () => {
            expect(isValidThreadId('invalid')).toBe(false);
            expect(isValidThreadId('')).toBe(false);
            expect(isValidThreadId('contact_only')).toBe(false);
        });
    });

    describe('generateGroupThreadId', () => {
        it('should generate group thread ID from contact list', () => {
            const contactIds = ['contact_123', 'contact_456', 'contact_789'];
            const threadId = generateGroupThreadId(contactIds, 'WHATSAPP');

            expect(threadId).toMatch(/^contact_123_whatsapp_[a-f0-9]+$/);
        });

        it('should generate group thread ID with custom identifier', () => {
            const contactIds = ['contact_123', 'contact_456'];
            const threadId = generateGroupThreadId(contactIds, 'WHATSAPP', 'custom_group');

            expect(threadId).toBe('contact_123_whatsapp_custom_group');
        });

        it('should use first contact as primary', () => {
            const contactIds = ['contact_456', 'contact_123', 'contact_789'];
            const threadId = generateGroupThreadId(contactIds, 'EMAIL');

            expect(threadId).toMatch(/^contact_456_email_[a-f0-9]+$/);
        });
    });

    describe('isGroupThread', () => {
        it('should return true for group thread IDs', () => {
            expect(isGroupThread('contact_123_whatsapp_group_456')).toBe(true);
            expect(isGroupThread('contact_123_email_complex_group_id')).toBe(true);
        });

        it('should return false for direct thread IDs', () => {
            expect(isGroupThread('contact_123_sms')).toBe(false);
            expect(isGroupThread('contact_123_email')).toBe(false);
        });

        it('should return false for invalid thread IDs', () => {
            expect(isGroupThread('invalid')).toBe(false);
        });
    });

    describe('mergeThreadIds', () => {
        it('should return canonical and obsolete thread IDs', () => {
            const result = mergeThreadIds('primary_contact', 'secondary_contact', 'SMS');

            expect(result).toEqual({
                canonicalThreadId: 'primary_contact_sms',
                obsoleteThreadId: 'secondary_contact_sms'
            });
        });
    });

    describe('generateThreadMetadata', () => {
        it('should generate metadata for direct thread', () => {
            const metadata = generateThreadMetadata('contact_123_sms');

            expect(metadata).toEqual({
                type: 'direct',
                channel: 'SMS',
                contactId: 'contact_123',
                groupId: undefined
            });
        });

        it('should generate metadata for group thread', () => {
            const metadata = generateThreadMetadata('contact_123_whatsapp_group_456');

            expect(metadata).toEqual({
                type: 'group',
                channel: 'WHATSAPP',
                contactId: 'contact_123',
                groupId: 'group_456'
            });
        });
    });

    describe('generateConversationHash', () => {
        it('should generate consistent hash for same participants', () => {
            const participants1 = ['user_123', 'user_456', 'user_789'];
            const participants2 = ['user_456', 'user_789', 'user_123']; // Different order

            const hash1 = generateConversationHash(participants1, 'WHATSAPP');
            const hash2 = generateConversationHash(participants2, 'WHATSAPP');

            expect(hash1).toBe(hash2);
            expect(hash1).toHaveLength(16);
        });

        it('should generate different hashes for different participants', () => {
            const participants1 = ['user_123', 'user_456'];
            const participants2 = ['user_123', 'user_789'];

            const hash1 = generateConversationHash(participants1, 'WHATSAPP');
            const hash2 = generateConversationHash(participants2, 'WHATSAPP');

            expect(hash1).not.toBe(hash2);
        });

        it('should generate different hashes for different channels', () => {
            const participants = ['user_123', 'user_456'];

            const hash1 = generateConversationHash(participants, 'WHATSAPP');
            const hash2 = generateConversationHash(participants, 'SMS');

            expect(hash1).not.toBe(hash2);
        });

        it('should handle single participant', () => {
            const participants = ['user_123'];
            const hash = generateConversationHash(participants, 'SMS');

            expect(hash).toHaveLength(16);
            expect(typeof hash).toBe('string');
        });

        it('should handle empty participants array', () => {
            const participants: string[] = [];
            const hash = generateConversationHash(participants, 'SMS');

            expect(hash).toHaveLength(16);
            expect(typeof hash).toBe('string');
        });
    });
});