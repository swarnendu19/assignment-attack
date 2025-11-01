// lib/integrations/factory.ts

import { TwilioSender } from './twilio';
import { EmailSender } from './email';
import { TwitterSender } from './twitter';
import { FacebookSender } from './facebook';

/**
 * Unified message payload interface for all channels
 */
export interface MessagePayload {
  to: string;
  body: string;
  subject?: string;
  mediaUrls?: string[];
  metadata?: Record<string, any>;
}

/**
 * Standard response from all channel senders
 */
export interface SendResult {
  success: boolean;
  messageId?: string;
  externalId?: string;
  error?: string;
  timestamp: Date;
}

/**
 * Base interface that all channel senders must implement
 */
export interface ChannelSender {
  send(payload: MessagePayload): Promise<SendResult>;
  validateRecipient(recipient: string): boolean;
  getChannelName(): string;
}

/**
 * Supported channel types
 */
export type ChannelType = 'sms' | 'mms' | 'whatsapp' | 'email' | 'twitter' | 'facebook';

/**
 * Factory class for creating channel-specific senders
 * Implements the Factory Pattern for extensible channel management
 * 
 * @example
 * ```typescript
 * const sender = createSender('whatsapp');
 * const result = await sender.send({
 *   to: '+1234567890',
 *   body: 'Hello from WhatsApp!'
 * });
 * ```
 */
export class ChannelFactory {
  private static instances: Map<ChannelType, ChannelSender> = new Map();

  /**
   * Create or retrieve a cached sender instance for the specified channel
   * 
   * @param channel - The channel type to create a sender for
   * @returns A ChannelSender instance for the specified channel
   * @throws Error if the channel type is not supported
   */
  static createSender(channel: ChannelType): ChannelSender {
    // Return cached instance if available
    if (this.instances.has(channel)) {
      return this.instances.get(channel)!;
    }

    let sender: ChannelSender;

    switch (channel) {
      case 'sms':
      case 'mms':
        sender = new TwilioSender('sms');
        break;
      
      case 'whatsapp':
        sender = new TwilioSender('whatsapp');
        break;
      
      case 'email':
        sender = new EmailSender();
        break;
      
      case 'twitter':
        sender = new TwitterSender();
        break;
      
      case 'facebook':
        sender = new FacebookSender();
        break;
      
      default:
        throw new Error(`Unsupported channel type: ${channel}`);
    }

    // Cache the instance
    this.instances.set(channel, sender);
    return sender;
  }

  /**
   * Clear all cached sender instances
   * Useful for testing or configuration changes
   */
  static clearCache(): void {
    this.instances.clear();
  }

  /**
   * Check if a channel type is supported
   */
  static isSupported(channel: string): channel is ChannelType {
    return ['sms', 'mms', 'whatsapp', 'email', 'twitter', 'facebook'].includes(channel);
  }

  /**
   * Get list of all supported channels
   */
  static getSupportedChannels(): ChannelType[] {
    return ['sms', 'mms', 'whatsapp', 'email', 'twitter', 'facebook'];
  }
}

/**
 * Convenience function for creating a sender
 * 
 * @param channel - The channel type
 * @returns A ChannelSender instance
 */
export function createSender(channel: ChannelType): ChannelSender {
  return ChannelFactory.createSender(channel);
}

/**
 * Send a message through the specified channel with automatic error handling
 * 
 * @param channel - The channel to send through
 * @param payload - The message payload
 * @returns The send result
 */
export async function sendMessage(
  channel: ChannelType,
  payload: MessagePayload
): Promise<SendResult> {
  try {
    const sender = createSender(channel);
    return await sender.send(payload);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date()
    };
  }
}

/**
 * Validate a recipient for a specific channel
 * 
 * @param channel - The channel type
 * @param recipient - The recipient identifier (phone, email, handle, etc.)
 * @returns true if valid, false otherwise
 */
export function validateRecipient(channel: ChannelType, recipient: string): boolean {
  try {
    const sender = createSender(channel);
    return sender.validateRecipient(recipient);
  } catch {
    return false;
  }
}

/**
 * Batch send messages to multiple recipients on the same channel
 * Includes rate limiting and error handling per recipient
 * 
 * @param channel - The channel to send through
 * @param recipients - Array of recipients
 * @param getMessage - Function to generate message for each recipient
 * @param delayMs - Delay between sends in milliseconds (for rate limiting)
 * @returns Array of send results
 */
export async function batchSend(
  channel: ChannelType,
  recipients: string[],
  getMessage: (recipient: string) => MessagePayload,
  delayMs: number = 100
): Promise<SendResult[]> {
  const sender = createSender(channel);
  const results: SendResult[] = [];

  for (const recipient of recipients) {
    try {
      const payload = getMessage(recipient);
      const result = await sender.send(payload);
      results.push(result);

      // Rate limiting delay
      if (delayMs > 0 && recipient !== recipients[recipients.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      results.push({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      });
    }
  }

  return results;
}

/**
 * Channel configuration and metadata
 */
export interface ChannelConfig {
  name: string;
  displayName: string;
  icon: string;
  supportsMedia: boolean;
  maxMessageLength: number;
  costPerMessage: number; // in USD
  avgLatency: number; // in seconds
}

/**
 * Get configuration for a specific channel
 */
export function getChannelConfig(channel: ChannelType): ChannelConfig {
  const configs: Record<ChannelType, ChannelConfig> = {
    sms: {
      name: 'sms',
      displayName: 'SMS',
      icon: 'MessageSquare',
      supportsMedia: false,
      maxMessageLength: 160,
      costPerMessage: 0.0075,
      avgLatency: 2
    },
    mms: {
      name: 'mms',
      displayName: 'MMS',
      icon: 'Image',
      supportsMedia: true,
      maxMessageLength: 1600,
      costPerMessage: 0.02,
      avgLatency: 3
    },
    whatsapp: {
      name: 'whatsapp',
      displayName: 'WhatsApp',
      icon: 'MessageCircle',
      supportsMedia: true,
      maxMessageLength: 4096,
      costPerMessage: 0.005,
      avgLatency: 2
    },
    email: {
      name: 'email',
      displayName: 'Email',
      icon: 'Mail',
      supportsMedia: true,
      maxMessageLength: 100000,
      costPerMessage: 0.0001,
      avgLatency: 15
    },
    twitter: {
      name: 'twitter',
      displayName: 'Twitter DM',
      icon: 'Twitter',
      supportsMedia: true,
      maxMessageLength: 10000,
      costPerMessage: 0,
      avgLatency: 4
    },
    facebook: {
      name: 'facebook',
      displayName: 'Facebook Messenger',
      icon: 'Facebook',
      supportsMedia: true,
      maxMessageLength: 2000,
      costPerMessage: 0,
      avgLatency: 3
    }
  };

  return configs[channel];
}