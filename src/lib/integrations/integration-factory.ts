import { MessageChannel } from '@prisma/client';
import {
    ChannelIntegration,
    IntegrationConfig,
    IntegrationError,
    FactoryConfig,
    IntegrationHealth
} from '../types/integration';
import { BaseIntegration } from './base-integration';

// Import concrete integrations
import { TwilioSMSIntegration } from './twilio-sms';
import { TwilioWhatsAppIntegration } from './twilio-whatsapp';
import { EmailIntegration } from './email';
// import { TwitterIntegration } from './twitter';
// import { FacebookIntegration } from './facebook';

export class IntegrationFactory {
    private static instance: IntegrationFactory;
    private integrations: Map<MessageChannel, ChannelIntegration> = new Map();
    private configs: Map<MessageChannel, IntegrationConfig> = new Map();
    private config: FactoryConfig;

    private constructor(config: FactoryConfig) {
        this.config = config;
        this.initializeIntegrations();
    }

    // Singleton pattern
    static getInstance(config?: FactoryConfig): IntegrationFactory {
        if (!IntegrationFactory.instance) {
            if (!config) {
                throw new Error('Factory configuration is required for first initialization');
            }
            IntegrationFactory.instance = new IntegrationFactory(config);
        }
        return IntegrationFactory.instance;
    }

    // Create integration for specific channel
    static create(channel: MessageChannel, config?: IntegrationConfig): ChannelIntegration {
        const factory = IntegrationFactory.getInstance();

        if (config) {
            factory.registerIntegration(channel, config);
        }

        const integration = factory.getIntegration(channel);
        if (!integration) {
            throw new IntegrationError(
                `No integration available for channel: ${channel}`,
                'INTEGRATION_NOT_FOUND',
                channel
            );
        }

        return integration;
    }

    // Get integration for channel
    getIntegration(channel: MessageChannel): ChannelIntegration | null {
        return this.integrations.get(channel) || null;
    }

    // Register new integration
    registerIntegration(channel: MessageChannel, config: IntegrationConfig): void {
        this.configs.set(channel, config);

        if (config.enabled) {
            const integration = this.createIntegrationInstance(channel, config);
            this.integrations.set(channel, integration);
        }
    }

    // Unregister integration
    unregisterIntegration(channel: MessageChannel): void {
        this.integrations.delete(channel);
        this.configs.delete(channel);
    }

    // Get all available channels
    getAvailableChannels(): MessageChannel[] {
        return Array.from(this.integrations.keys());
    }

    // Get all enabled channels
    getEnabledChannels(): MessageChannel[] {
        return Array.from(this.configs.entries())
            .filter(([_, config]) => config.enabled)
            .map(([channel, _]) => channel);
    }

    // Check if channel is supported
    isChannelSupported(channel: MessageChannel): boolean {
        return this.getSupportedChannels().includes(channel);
    }

    // Get all supported channels (even if not configured)
    getSupportedChannels(): MessageChannel[] {
        return [
            MessageChannel.SMS,
            MessageChannel.WHATSAPP,
            MessageChannel.EMAIL,
            MessageChannel.TWITTER,
            MessageChannel.FACEBOOK
        ];
    }

    // Health check for all integrations
    async healthCheck(): Promise<Map<MessageChannel, IntegrationHealth>> {
        const healthResults = new Map<MessageChannel, IntegrationHealth>();

        for (const [channel, integration] of this.integrations) {
            const startTime = Date.now();

            try {
                const isHealthy = await Promise.race([
                    integration.healthCheck(),
                    new Promise<boolean>((_, reject) =>
                        setTimeout(() => reject(new Error('Health check timeout')), 5000)
                    )
                ]);

                const responseTime = Date.now() - startTime;

                healthResults.set(channel, {
                    channel,
                    status: isHealthy ? 'healthy' : 'degraded',
                    lastCheck: new Date(),
                    responseTime
                });
            } catch (error) {
                const responseTime = Date.now() - startTime;

                healthResults.set(channel, {
                    channel,
                    status: 'down',
                    lastCheck: new Date(),
                    responseTime,
                    details: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        return healthResults;
    }

    // Update integration configuration
    updateIntegrationConfig(channel: MessageChannel, config: Partial<IntegrationConfig>): void {
        const existingConfig = this.configs.get(channel);
        if (!existingConfig) {
            throw new IntegrationError(
                `No configuration found for channel: ${channel}`,
                'CONFIG_NOT_FOUND',
                channel
            );
        }

        const updatedConfig = { ...existingConfig, ...config, updatedAt: new Date() };
        this.configs.set(channel, updatedConfig);

        // Recreate integration if enabled
        if (updatedConfig.enabled) {
            const integration = this.createIntegrationInstance(channel, updatedConfig);
            this.integrations.set(channel, integration);
        } else {
            this.integrations.delete(channel);
        }
    }

    // Get integration configuration
    getIntegrationConfig(channel: MessageChannel): IntegrationConfig | null {
        return this.configs.get(channel) || null;
    }

    // Private methods
    private initializeIntegrations(): void {
        for (const [channel, config] of this.config.integrations) {
            if (config.enabled) {
                try {
                    const integration = this.createIntegrationInstance(channel, config);
                    this.integrations.set(channel, integration);
                    this.configs.set(channel, config);
                } catch (error) {
                    console.error(`Failed to initialize integration for ${channel}:`, error);
                }
            }
        }
    }

    private createIntegrationInstance(channel: MessageChannel, config: IntegrationConfig): ChannelIntegration {
        switch (channel) {
            case MessageChannel.SMS:
                return new TwilioSMSIntegration(config);

            case MessageChannel.WHATSAPP:
                return new TwilioWhatsAppIntegration(config);

            case MessageChannel.EMAIL:
                return new EmailIntegration(config);

            case MessageChannel.TWITTER:
                // return new TwitterIntegration(config);
                throw new IntegrationError('Twitter integration not yet implemented', 'NOT_IMPLEMENTED', channel);

            case MessageChannel.FACEBOOK:
                // return new FacebookIntegration(config);
                throw new IntegrationError('Facebook integration not yet implemented', 'NOT_IMPLEMENTED', channel);

            default:
                throw new IntegrationError(
                    `Unsupported channel: ${channel}`,
                    'UNSUPPORTED_CHANNEL',
                    channel
                );
        }
    }

    // Static helper methods
    static createFactoryConfig(integrations: Map<MessageChannel, IntegrationConfig>): FactoryConfig {
        return {
            integrations,
            defaultRetryAttempts: 3,
            defaultTimeout: 30000,
            webhookValidationEnabled: true
        };
    }

    static createDefaultConfig(): FactoryConfig {
        return {
            integrations: new Map(),
            defaultRetryAttempts: 3,
            defaultTimeout: 30000,
            webhookValidationEnabled: true
        };
    }
}