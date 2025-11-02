// Message services and utilities
export { MessageService } from './message-service';
export { MessageNormalizer } from './message-normalizer';
export { ContactService } from './contact-service';

// Types
export type {
    UnifiedMessage,
    MessageContent,
    MessageContentType,
    MediaAttachment,
    MediaType,
    ChannelMetadata,
    DeliveryInfo,
    CreateMessageInput,
    UpdateMessageInput,
    MessageFilters,
    MessageQueryOptions,
    MessageThread,
    NormalizationResult,
    WebhookPayload,
    ThreadIdOptions
} from '../types/message';

// Thread utilities
export {
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