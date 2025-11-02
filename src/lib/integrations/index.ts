// Core integration interfaces and types
export * from '../types/integration';

// Base integration class
export { BaseIntegration } from './base-integration';

// Integration factory
export { IntegrationFactory } from './integration-factory';

// Webhook validation
export { WebhookValidator } from './webhook-validator';

// Configuration management
export { IntegrationConfigManager } from './config-manager';

// Twilio integrations
export { TwilioSMSIntegration } from './twilio-sms';
export { TwilioWhatsAppIntegration } from './twilio-whatsapp';

// Twilio utilities
export { TwilioUtils } from './twilio-utils';

// Re-export message types for convenience
export type {
    UnifiedMessage,
    MessageContent,
    WebhookPayload,
    MessageChannel
} from '../types/message';