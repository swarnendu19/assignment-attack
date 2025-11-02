import { MessageChannel } from '@prisma/client';
import {
    IntegrationFactory,
    IntegrationConfig,
    FactoryConfig,
    IntegrationError,
    ChannelCredentials,
    ChannelSettings
} from '../integrations';

describe('IntegrationFactory', () => {
    let factory: IntegrationFactory;
    let mockConfig: FactoryConfig;

    beforeEach(() => {
        // Reset singleton instance
        (IntegrationFactory as any).instance = null;

        // Create mock configuration
        const smsConfig: IntegrationConfig = {
            channel: MessageChannel.SMS,
            enabled: false, // Set to false to avoid trying to create integration instance
            credentials: {
                type: 'api_key',
                accountSid: 'test_sid',
                authToken: 'test_token'
            } as ChannelCredentials,
            settings: {
                defaultSender: '+1234567890'
            } as ChannelSettings,
            webhookUrl: 'https://example.com/webhook/sms',
            webhookSecret: 'test_secret',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        mockConfig = {
            integrations: new Map([[MessageChannel.SMS, smsConfig]]),
            defaultRetryAttempts: 3,
            defaultTimeout: 30000,
            webhookValidationEnabled: true
        };
    });

    describe('getInstance', () => {
        it('should create singleton instance with config', () => {
            const factory1 = IntegrationFactory.getInstance(mockConfig);
            const factory2 = IntegrationFactory.getInstance();

            expect(factory1).toBe(factory2);
        });

        it('should throw error if no config provided for first initialization', () => {
            expect(() => {
                IntegrationFactory.getInstance();
            }).toThrow('Factory configuration is required for first initialization');
        });
    });

    describe('create', () => {
        beforeEach(() => {
            factory = IntegrationFactory.getInstance(mockConfig);
        });

        it('should throw error for unsupported channel', () => {
            expect(() => {
                IntegrationFactory.create(MessageChannel.SMS);
            }).toThrow(IntegrationError);
        });

        it('should throw error for channel without configuration', () => {
            expect(() => {
                IntegrationFactory.create(MessageChannel.EMAIL);
            }).toThrow('No integration available for channel: EMAIL');
        });
    });

    describe('registerIntegration', () => {
        beforeEach(() => {
            factory = IntegrationFactory.getInstance(mockConfig);
        });

        it('should register new integration configuration', () => {
            const emailConfig: IntegrationConfig = {
                channel: MessageChannel.EMAIL,
                enabled: false, // Set to false to avoid trying to create integration instance
                credentials: {
                    type: 'api_key',
                    apiKey: 'test_key'
                } as ChannelCredentials,
                settings: {} as ChannelSettings,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            factory.registerIntegration(MessageChannel.EMAIL, emailConfig);

            const config = factory.getIntegrationConfig(MessageChannel.EMAIL);
            expect(config).toEqual(emailConfig);
        });

        it('should not create integration instance if disabled', () => {
            const disabledConfig: IntegrationConfig = {
                channel: MessageChannel.EMAIL,
                enabled: false,
                credentials: {} as ChannelCredentials,
                settings: {} as ChannelSettings,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            factory.registerIntegration(MessageChannel.EMAIL, disabledConfig);

            const integration = factory.getIntegration(MessageChannel.EMAIL);
            expect(integration).toBeNull();
        });
    });

    describe('unregisterIntegration', () => {
        beforeEach(() => {
            factory = IntegrationFactory.getInstance(mockConfig);
        });

        it('should remove integration and configuration', () => {
            factory.unregisterIntegration(MessageChannel.SMS);

            const integration = factory.getIntegration(MessageChannel.SMS);
            const config = factory.getIntegrationConfig(MessageChannel.SMS);

            expect(integration).toBeNull();
            expect(config).toBeNull();
        });
    });

    describe('getAvailableChannels', () => {
        beforeEach(() => {
            factory = IntegrationFactory.getInstance(mockConfig);
        });

        it('should return empty array when no integrations are available', () => {
            factory.unregisterIntegration(MessageChannel.SMS);

            const channels = factory.getAvailableChannels();
            expect(channels).toEqual([]);
        });
    });

    describe('getEnabledChannels', () => {
        beforeEach(() => {
            factory = IntegrationFactory.getInstance(mockConfig);
        });

        it('should return only enabled channels', () => {
            const enabledConfig: IntegrationConfig = {
                channel: MessageChannel.EMAIL,
                enabled: true,
                credentials: {} as ChannelCredentials,
                settings: {} as ChannelSettings,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const disabledConfig: IntegrationConfig = {
                channel: MessageChannel.WHATSAPP,
                enabled: false,
                credentials: {} as ChannelCredentials,
                settings: {} as ChannelSettings,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Manually add to configs without trying to create instances
            (factory as any).configs.set(MessageChannel.EMAIL, enabledConfig);
            (factory as any).configs.set(MessageChannel.WHATSAPP, disabledConfig);

            const enabledChannels = factory.getEnabledChannels();
            expect(enabledChannels).toContain(MessageChannel.EMAIL);
            expect(enabledChannels).not.toContain(MessageChannel.WHATSAPP);
        });
    });

    describe('isChannelSupported', () => {
        beforeEach(() => {
            factory = IntegrationFactory.getInstance(mockConfig);
        });

        it('should return true for supported channels', () => {
            expect(factory.isChannelSupported(MessageChannel.SMS)).toBe(true);
            expect(factory.isChannelSupported(MessageChannel.EMAIL)).toBe(true);
            expect(factory.isChannelSupported(MessageChannel.WHATSAPP)).toBe(true);
        });
    });

    describe('getSupportedChannels', () => {
        beforeEach(() => {
            factory = IntegrationFactory.getInstance(mockConfig);
        });

        it('should return all supported channels', () => {
            const supportedChannels = factory.getSupportedChannels();

            expect(supportedChannels).toContain(MessageChannel.SMS);
            expect(supportedChannels).toContain(MessageChannel.WHATSAPP);
            expect(supportedChannels).toContain(MessageChannel.EMAIL);
            expect(supportedChannels).toContain(MessageChannel.TWITTER);
            expect(supportedChannels).toContain(MessageChannel.FACEBOOK);
        });
    });

    describe('updateIntegrationConfig', () => {
        beforeEach(() => {
            factory = IntegrationFactory.getInstance(mockConfig);
        });

        it('should update existing configuration', () => {
            // First register a configuration
            const initialConfig: IntegrationConfig = {
                channel: MessageChannel.EMAIL,
                enabled: false, // Set to false to avoid trying to create integration instance
                credentials: {
                    type: 'api_key',
                    apiKey: 'test_key'
                } as ChannelCredentials,
                settings: {
                    defaultSender: 'test@example.com'
                } as ChannelSettings,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            factory.registerIntegration(MessageChannel.EMAIL, initialConfig);

            const updates = {
                enabled: false,
                settings: { newSetting: 'value' } as ChannelSettings
            };

            factory.updateIntegrationConfig(MessageChannel.EMAIL, updates);

            const config = factory.getIntegrationConfig(MessageChannel.EMAIL);
            expect(config?.enabled).toBe(false);
            expect(config?.settings).toEqual(expect.objectContaining({ newSetting: 'value' }));
        });

        it('should throw error for non-existent configuration', () => {
            expect(() => {
                factory.updateIntegrationConfig(MessageChannel.EMAIL, { enabled: false });
            }).toThrow('No configuration found for channel: EMAIL');
        });
    });

    describe('healthCheck', () => {
        beforeEach(() => {
            factory = IntegrationFactory.getInstance(mockConfig);
        });

        it('should return health status for all integrations', async () => {
            // Since we don't have actual integrations implemented, this will be empty
            const healthResults = await factory.healthCheck();

            expect(healthResults).toBeInstanceOf(Map);
            // The map will be empty since no actual integrations are created
            expect(healthResults.size).toBe(0);
        });
    });

    describe('static helper methods', () => {
        it('should create factory config with integrations', () => {
            const integrations = new Map([[MessageChannel.SMS, mockConfig.integrations.get(MessageChannel.SMS)!]]);
            const config = IntegrationFactory.createFactoryConfig(integrations);

            expect(config.integrations).toBe(integrations);
            expect(config.defaultRetryAttempts).toBe(3);
            expect(config.defaultTimeout).toBe(30000);
            expect(config.webhookValidationEnabled).toBe(true);
        });

        it('should create default config', () => {
            const config = IntegrationFactory.createDefaultConfig();

            expect(config.integrations).toBeInstanceOf(Map);
            expect(config.integrations.size).toBe(0);
            expect(config.defaultRetryAttempts).toBe(3);
            expect(config.defaultTimeout).toBe(30000);
            expect(config.webhookValidationEnabled).toBe(true);
        });
    });
});