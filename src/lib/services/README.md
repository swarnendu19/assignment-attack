# Message System Implementation

This directory contains the core message data models and services for the Unified Inbox platform. The implementation provides a unified interface for handling messages across multiple communication channels (SMS, WhatsApp, Email, Twitter, Facebook).

## Architecture Overview

The message system is built around three main components:

1. **Message Normalization** - Converts channel-specific webhook payloads into a unified format
2. **Message Service** - Provides CRUD operations and business logic for messages
3. **Thread Management** - Handles conversation threading and grouping

## Core Components

### MessageService (`message-service.ts`)

The main service class that provides:

- **CRUD Operations**: Create, read, update, delete messages
- **Thread Management**: Group messages by conversation threads
- **Status Tracking**: Track message delivery and read status
- **Scheduling**: Handle scheduled message sending
- **Search & Filtering**: Query messages with various filters
- **Webhook Processing**: Process incoming webhooks from channels

#### Key Methods

```typescript
// Create a new message
async createMessage(input: CreateMessageInput): Promise<UnifiedMessage>

// Get messages with filtering and pagination
async getMessages(filters?: MessageFilters, options?: MessageQueryOptions)

// Get messages by conversation thread
async getMessagesByThread(threadId: string): Promise<UnifiedMessage[]>

// Process incoming webhook
async processWebhook(payload: WebhookPayload): Promise<NormalizationResult>

// Update message status
async updateMessageStatus(id: string, status: MessageStatus): Promise<UnifiedMessage>

// Mark messages as read
async markThreadAsRead(threadId: string): Promise<number>
```

### MessageNormalizer (`message-normalizer.ts`)

Handles conversion of channel-specific webhook payloads into the unified message format:

- **Twilio SMS/WhatsApp**: Normalizes Twilio webhook payloads
- **Email**: Handles email webhook payloads (Resend, etc.)
- **Social Media**: Processes Twitter and Facebook webhook payloads
- **Media Handling**: Extracts and normalizes media attachments

#### Supported Channels

- **SMS**: Twilio SMS API
- **WhatsApp**: Twilio WhatsApp API
- **Email**: Generic email providers (Resend, etc.)
- **Twitter**: Twitter API v2 Direct Messages
- **Facebook**: Facebook Messenger API

### Thread Utilities (`../utils/thread-utils.ts`)

Provides utilities for managing conversation threads:

- **Thread ID Generation**: Create unique thread identifiers
- **Thread Parsing**: Extract components from thread IDs
- **Group Conversations**: Handle multi-participant conversations
- **Thread Merging**: Merge threads when contacts are consolidated

#### Thread ID Format

Thread IDs follow the format: `{contactId}_{channel}_{groupId?}`

Examples:
- Direct SMS: `contact_123_sms`
- WhatsApp Group: `contact_123_whatsapp_group_456`
- Email Thread: `contact_123_email`

## Data Models

### UnifiedMessage Interface

```typescript
interface UnifiedMessage {
  id: string;
  contactId: string;
  userId?: string;
  channel: MessageChannel;
  direction: Direction;
  content: MessageContent;
  metadata: ChannelMetadata;
  status: MessageStatus;
  threadId: string;
  scheduledAt?: Date;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### MessageContent Structure

```typescript
interface MessageContent {
  text?: string;
  media?: MediaAttachment[];
  type: MessageContentType;
  subject?: string; // For email
  templateId?: string; // For templated messages
  variables?: Record<string, any>; // For template variables
}
```

### Channel Metadata

```typescript
interface ChannelMetadata {
  channelId: string;
  externalId: string;
  channelSpecific: Record<string, any>;
  deliveryInfo?: DeliveryInfo;
}
```

## Usage Examples

### Creating an Outbound Message

```typescript
import { MessageService } from './message-service';

const messageService = new MessageService();

const message = await messageService.createMessage({
  contactId: 'contact_123',
  userId: 'user_456',
  channel: 'SMS',
  direction: 'OUTBOUND',
  content: {
    text: 'Hello! How can I help you today?',
    type: 'text'
  }
});
```

### Processing Incoming Webhook

```typescript
const webhookPayload = {
  channel: 'SMS',
  rawPayload: {
    MessageSid: 'SM123456789',
    From: '+1234567890',
    Body: 'Thanks for your help!'
  },
  timestamp: new Date()
};

const result = await messageService.processWebhook(webhookPayload);
```

### Getting Conversation Messages

```typescript
import { generateThreadId } from '../utils/thread-utils';

const threadId = generateThreadId({
  contactId: 'contact_123',
  channel: 'SMS'
});

const messages = await messageService.getMessagesByThread(threadId);
```

## Testing

The implementation includes comprehensive unit tests:

- **message-normalizer.test.ts**: Tests webhook normalization for all channels
- **thread-utils.test.ts**: Tests thread ID generation and parsing
- **message-service.test.ts**: Tests CRUD operations and business logic

Run tests with:
```bash
npm test -- --testPathPatterns="message-normalizer|thread-utils|message-service"
```

## Database Integration

The service integrates with Prisma ORM and expects the following database models:

- **Message**: Stores unified message data
- **Contact**: Contact information
- **User**: User accounts
- **Integration**: Channel configurations

See `prisma/schema.prisma` for the complete database schema.

## Error Handling

The system includes comprehensive error handling:

- **Validation Errors**: Invalid message content or parameters
- **Integration Errors**: API failures, rate limits, authentication issues
- **Business Logic Errors**: Permission denied, quota exceeded
- **System Errors**: Database failures, network timeouts

All errors are properly classified and include retry mechanisms where appropriate.

## Performance Considerations

- **Database Indexing**: Optimized queries with proper indexes
- **Pagination**: Efficient pagination for large message sets
- **Caching**: Redis integration for frequently accessed data
- **Async Processing**: Non-blocking webhook processing

## Security

- **Webhook Validation**: Signature verification for all channels
- **Input Sanitization**: Validate and sanitize all external data
- **Access Control**: User-based message access restrictions
- **Audit Logging**: Comprehensive activity tracking

## Future Enhancements

- **Message Templates**: Template system for automated responses
- **AI Integration**: Smart message categorization and responses
- **Advanced Search**: Full-text search with Elasticsearch
- **Real-time Sync**: WebSocket-based real-time updates
- **Message Encryption**: End-to-end encryption for sensitive data