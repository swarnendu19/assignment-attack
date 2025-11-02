import { MessageChannel } from '@prisma/client';
import { prisma } from '../prisma';
import {
    IntegrationConfig,
    ChannelCredentials,
    ChannelSettings,
    IntegrationError
} from '../types/integration';

export class IntegrationConfigManager {
    private static instance: IntegrationConfigManager;
    private configCache: Map<MessageChannel, IntegrationConfig> = new Map();
    private cacheExpiry: Map<MessageChannel, number> = new Map();
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    private constructor() { }

    static getInstance(): IntegrationConfigManager {
        if (!IntegrationConfigManager.instance) {
            IntegrationConfigManager.instance = new IntegrationConfigManager();
        }
        return IntegrationConfigManager.instance;
    }

    // Get integration configuration
    async getConfig(channel: MessageChannel): Promise<IntegrationConfig | null> {
        // Check cache first
        const cached = this.getCachedConfig(channel);
        if (cached) {
            return cached;
        }

        try {
            const integration = await prisma.integration.findUnique({
                where: { channel }
            });

            if (!integration) {
                return null;
            }

            const config: IntegrationConfig = {
                channel: integration.channel,
                enabled: integration.status === 'ACTIVE',
                credentials: this.decryptCredentials(integration.credentials as any),
                settings: integration.config as ChannelSettings,
                webhookUrl: (integration.config as any)?.webhookUrl,
                webhookSecret: (integration.config as any)?.webhookSecret,
                createdAt: integration.createdAt || new Date(),
                updatedAt: integration.updatedAt || new Date()
            };

            // Cache the config
            this.setCachedConfig(channel, config);

            return config;
        } catch (error) {
            throw new IntegrationError(
                `Failed to get configuration for ${channel}`,
                'CONFIG_FETCH_ERROR',
                channel,
                true,
                error
            );
        }
    }

    // Save integration configuration
    async saveConfig(config: IntegrationConfig): Promise<void> {
        try {
            const encryptedCredentials = this.encryptCredentials(config.credentials);

            const configData = {
                ...config.settings,
                webhookUrl: config.webhookUrl,
                webhookSecret: config.webhookSecret
            };

            await prisma.integration.upsert({
                where: { channel: config.channel },
                update: {
                    status: config.enabled ? 'ACTIVE' : 'INACTIVE',
                    config: configData,
                    credentials: encryptedCredentials,
                    updatedAt: new Date()
                },
                create: {
                    channel: config.channel,
                    status: config.enabled ? 'ACTIVE' : 'INACTIVE',
                    config: configData,
                    credentials: encryptedCredentials,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            });

            // Update cache
            this.setCachedConfig(config.channel, config);
        } catch (error) {
            throw new IntegrationError(
                `Failed to save configuration for ${config.channel}`,
                'CONFIG_SAVE_ERROR',
                config.channel,
                true,
                error
            );
        }
    }

    // Delete integration configuration
    async deleteConfig(channel: MessageChannel): Promise<void> {
        try {
            await prisma.integration.delete({
                where: { channel }
            });

            // Remove from cache
            this.configCache.delete(channel);
            this.cacheExpiry.delete(channel);
        } catch (error) {
            throw new IntegrationError(
                `Failed to delete configuration for ${channel}`,
                'CONFIG_DELETE_ERROR',
                channel,
                true,
                error
            );
        }
    }

    // Get all configurations
    async getAllConfigs(): Promise<IntegrationConfig[]> {
        try {
            const integrations = await prisma.integration.findMany();

            return integrations.map(integration => ({
                channel: integration.channel,
                enabled: integration.status === 'ACTIVE',
                credentials: this.decryptCredentials(integration.credentials as any),
                settings: integration.config as ChannelSettings,
                webhookUrl: (integration.config as any)?.webhookUrl,
                webhookSecret: (integration.config as any)?.webhookSecret,
                createdAt: integration.createdAt || new Date(),
                updatedAt: integration.updatedAt || new Date()
            }));
        } catch (error) {
            throw new IntegrationError(
                'Failed to get all configurations',
                'CONFIG_FETCH_ALL_ERROR',
                MessageChannel.SMS, // Default channel for error
                true,
                error
            );
        }
    }

    // Update integration status
    async updateStatus(channel: MessageChannel, enabled: boolean): Promise<void> {
        try {
            await prisma.integration.update({
                where: { channel },
                data: {
                    status: enabled ? 'ACTIVE' : 'INACTIVE',
                    updatedAt: new Date()
                }
            });

            // Update cache
            const cached = this.getCachedConfig(channel);
            if (cached) {
                cached.enabled = enabled;
                this.setCachedConfig(channel, cached);
            }
        } catch (error) {
            throw new IntegrationError(
                `Failed to update status for ${channel}`,
                'CONFIG_UPDATE_ERROR',
                channel,
                true,
                error
            );
        }
    }

    // Update credentials
    async updateCredentials(channel: MessageChannel, credentials: ChannelCredentials): Promise<void> {
        try {
            const encryptedCredentials = this.encryptCredentials(credentials);

            await prisma.integration.update({
                where: { channel },
                data: {
                    credentials: encryptedCredentials,
                    updatedAt: new Date()
                }
            });

            // Update cache
            const cached = this.getCachedConfig(channel);
            if (cached) {
                cached.credentials = credentials;
                this.setCachedConfig(channel, cached);
            }
        } catch (error) {
            throw new IntegrationError(
                `Failed to update credentials for ${channel}`,
                'CREDENTIALS_UPDATE_ERROR',
                channel,
                true,
                error
            );
        }
    }

    // Update settings
    async updateSettings(channel: MessageChannel, settings: ChannelSettings): Promise<void> {
        try {
            const currentConfig = await this.getConfig(channel);
            if (!currentConfig) {
                throw new IntegrationError(
                    `Configuration not found for ${channel}`,
                    'CONFIG_NOT_FOUND',
                    channel
                );
            }

            const updatedConfig = {
                ...currentConfig.settings,
                ...settings,
                webhookUrl: currentConfig.webhookUrl,
                webhookSecret: currentConfig.webhookSecret
            };

            await prisma.integration.update({
                where: { channel },
                data: {
                    config: updatedConfig,
                    updatedAt: new Date()
                }
            });

            // Update cache
            const cached = this.getCachedConfig(channel);
            if (cached) {
                cached.settings = { ...cached.settings, ...settings };
                this.setCachedConfig(channel, cached);
            }
        } catch (error) {
            throw new IntegrationError(
                `Failed to update settings for ${channel}`,
                'SETTINGS_UPDATE_ERROR',
                channel,
                true,
                error
            );
        }
    }

    // Clear cache for specific channel
    clearCache(channel?: MessageChannel): void {
        if (channel) {
            this.configCache.delete(channel);
            this.cacheExpiry.delete(channel);
        } else {
            this.configCache.clear();
            this.cacheExpiry.clear();
        }
    }

    // Private helper methods
    private getCachedConfig(channel: MessageChannel): IntegrationConfig | null {
        const expiry = this.cacheExpiry.get(channel);
        if (!expiry || Date.now() > expiry) {
            this.configCache.delete(channel);
            this.cacheExpiry.delete(channel);
            return null;
        }

        return this.configCache.get(channel) || null;
    }

    private setCachedConfig(channel: MessageChannel, config: IntegrationConfig): void {
        this.configCache.set(channel, config);
        this.cacheExpiry.set(channel, Date.now() + this.CACHE_TTL);
    }

    private encryptCredentials(credentials: ChannelCredentials): any {
        // In a real implementation, you would encrypt sensitive data
        // For now, we'll just return the credentials as-is
        // TODO: Implement proper encryption using a library like crypto
        return credentials;
    }

    private decryptCredentials(encryptedCredentials: any): ChannelCredentials {
        // In a real implementation, you would decrypt the data
        // For now, we'll just return the credentials as-is
        // TODO: Implement proper decryption
        return encryptedCredentials as ChannelCredentials;
    }

    // Validation methods
    validateCredentials(channel: MessageChannel, credentials: ChannelCredentials): boolean {
        switch (channel) {
            case MessageChannel.SMS:
            case MessageChannel.WHATSAPP:
                return this.validateTwilioCredentials(credentials);

            case MessageChannel.EMAIL:
                return this.validateEmailCredentials(credentials);

            case MessageChannel.TWITTER:
                return this.validateTwitterCredentials(credentials);

            case MessageChannel.FACEBOOK:
                return this.validateFacebookCredentials(credentials);

            default:
                return false;
        }
    }

    private validateTwilioCredentials(credentials: ChannelCredentials): boolean {
        return !!(credentials.accountSid && credentials.authToken);
    }

    private validateEmailCredentials(credentials: ChannelCredentials): boolean {
        return !!(credentials.apiKey || (credentials.username && credentials.password));
    }

    private validateTwitterCredentials(credentials: ChannelCredentials): boolean {
        return !!(credentials.apiKey && credentials.apiSecret && credentials.accessToken && credentials.accessTokenSecret);
    }

    private validateFacebookCredentials(credentials: ChannelCredentials): boolean {
        return !!(credentials.accessToken && credentials.appSecret);
    }
}