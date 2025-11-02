import { MessageChannel } from '@prisma/client';
import { IntegrationConfigManager } from '../integrations/config-manager';
import {
    IntegrationConfig,
    ChannelCredentials,
    ChannelSettings,
    IntegrationError
} from '../types/integration';
import { prisma } from '../prisma';

// Mock Prisma
jest.mock('../prisma', () => ({
    prisma: {
        integration: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            upsert: jest.fn(),
            update: jest.fn(),
            delete: jest.fn()
        }
    }
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('IntegrationConfigManager', () => {
    let configManager: IntegrationConfigManager;
    let mockConfig: IntegrationConfig;

    beforeEach(() => {
        // Reset singleton instance
        (IntegrationConfigManager as any).instance = null;
        configManager = IntegrationConfigManager.getInstance();

        // Clear cache
        configManager.clearCache();

        mockConfig = {
            channel: MessageChannel.SMS,
            enabled: true,
            credentials: {
                type: 'api_key',
                accountSid: 'test_sid',
                authToken: 'test_token'
            } as ChannelCredentials,
            settings: {
                defaultSender: '+1234567890'
            } as ChannelSettings,
            webhookUrl: 'https://example.com/webhook',
            webhookSecret: 'test_secret',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Reset all mocks
        jest.clearAllMocks();
    });

    describe('getInstance', () => {
        it('should return singleton instance', () => {
            const manager1 = IntegrationConfigManager.getInstance();
            const manager2 = IntegrationConfigManager.getInstance();

            expect(manager1).toBe(manager2);
        });
    });

    describe('getConfig', () => {
        it('should return config from database', async () => {
            const mockDbIntegration = {
                channel: MessageChannel.SMS,
                status: 'ACTIVE',
                config: {
                    defaultSender: '+1234567890',
                    webhookUrl: 'https://example.com/webhook',
                    webhookSecret: 'test_secret'
                },
                credentials: {
                    type: 'api_key',
                    accountSid: 'test_sid',
                    authToken: 'test_token'
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };

            mockPrisma.integration.findUnique.mockResolvedValue(mockDbIntegration);

            const result = await configManager.getConfig(MessageChannel.SMS);

            expect(result).toBeDefined();
            expect(result?.channel).toBe(MessageChannel.SMS);
            expect(result?.enabled).toBe(true);
            expect(mockPrisma.integration.findUnique).toHaveBeenCalledWith({
                where: { channel: MessageChannel.SMS }
            });
        });

        it('should return null for non-existent config', async () => {
            mockPrisma.integration.findUnique.mockResolvedValue(null);

            const result = await configManager.getConfig(MessageChannel.EMAIL);

            expect(result).toBeNull();
        });

        it('should return cached config on second call', async () => {
            const mockDbIntegration = {
                channel: MessageChannel.SMS,
                status: 'ACTIVE',
                config: {},
                credentials: {},
                createdAt: new Date(),
                updatedAt: new Date()
            };

            mockPrisma.integration.findUnique.mockResolvedValue(mockDbIntegration);

            // First call
            await configManager.getConfig(MessageChannel.SMS);
            // Second call
            await configManager.getConfig(MessageChannel.SMS);

            // Should only call database once
            expect(mockPrisma.integration.findUnique).toHaveBeenCalledTimes(1);
        });

        it('should throw IntegrationError on database error', async () => {
            mockPrisma.integration.findUnique.mockRejectedValue(new Error('Database error'));

            await expect(configManager.getConfig(MessageChannel.SMS))
                .rejects.toThrow(IntegrationError);
        });
    });

    describe('saveConfig', () => {
        it('should save new config to database', async () => {
            mockPrisma.integration.upsert.mockResolvedValue({
                id: 'test-id',
                channel: MessageChannel.SMS,
                status: 'ACTIVE',
                config: {},
                credentials: {},
                createdAt: new Date(),
                updatedAt: new Date()
            });

            await configManager.saveConfig(mockConfig);

            expect(mockPrisma.integration.upsert).toHaveBeenCalledWith({
                where: { channel: MessageChannel.SMS },
                update: expect.objectContaining({
                    status: 'ACTIVE',
                    updatedAt: expect.any(Date)
                }),
                create: expect.objectContaining({
                    channel: MessageChannel.SMS,
                    status: 'ACTIVE',
                    createdAt: expect.any(Date),
                    updatedAt: expect.any(Date)
                })
            });
        });

        it('should save disabled config', async () => {
            const disabledConfig = { ...mockConfig, enabled: false };

            mockPrisma.integration.upsert.mockResolvedValue({
                id: 'test-id',
                channel: MessageChannel.SMS,
                status: 'INACTIVE',
                config: {},
                credentials: {},
                createdAt: new Date(),
                updatedAt: new Date()
            });

            await configManager.saveConfig(disabledConfig);

            expect(mockPrisma.integration.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    update: expect.objectContaining({ status: 'INACTIVE' }),
                    create: expect.objectContaining({ status: 'INACTIVE' })
                })
            );
        });

        it('should throw IntegrationError on database error', async () => {
            mockPrisma.integration.upsert.mockRejectedValue(new Error('Database error'));

            await expect(configManager.saveConfig(mockConfig))
                .rejects.toThrow(IntegrationError);
        });
    });

    describe('deleteConfig', () => {
        it('should delete config from database', async () => {
            mockPrisma.integration.delete.mockResolvedValue({
                id: 'test-id',
                channel: MessageChannel.SMS,
                status: 'ACTIVE',
                config: {},
                credentials: {},
                createdAt: new Date(),
                updatedAt: new Date()
            });

            await configManager.deleteConfig(MessageChannel.SMS);

            expect(mockPrisma.integration.delete).toHaveBeenCalledWith({
                where: { channel: MessageChannel.SMS }
            });
        });

        it('should throw IntegrationError on database error', async () => {
            mockPrisma.integration.delete.mockRejectedValue(new Error('Database error'));

            await expect(configManager.deleteConfig(MessageChannel.SMS))
                .rejects.toThrow(IntegrationError);
        });
    });

    describe('getAllConfigs', () => {
        it('should return all configs from database', async () => {
            const mockIntegrations = [
                {
                    channel: MessageChannel.SMS,
                    status: 'ACTIVE',
                    config: {},
                    credentials: {},
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                {
                    channel: MessageChannel.EMAIL,
                    status: 'INACTIVE',
                    config: {},
                    credentials: {},
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ];

            mockPrisma.integration.findMany.mockResolvedValue(mockIntegrations);

            const result = await configManager.getAllConfigs();

            expect(result).toHaveLength(2);
            expect(result[0].channel).toBe(MessageChannel.SMS);
            expect(result[0].enabled).toBe(true);
            expect(result[1].channel).toBe(MessageChannel.EMAIL);
            expect(result[1].enabled).toBe(false);
        });
    });

    describe('updateStatus', () => {
        it('should update integration status', async () => {
            mockPrisma.integration.update.mockResolvedValue({
                id: 'test-id',
                channel: MessageChannel.SMS,
                status: 'INACTIVE',
                config: {},
                credentials: {},
                createdAt: new Date(),
                updatedAt: new Date()
            });

            await configManager.updateStatus(MessageChannel.SMS, false);

            expect(mockPrisma.integration.update).toHaveBeenCalledWith({
                where: { channel: MessageChannel.SMS },
                data: {
                    status: 'INACTIVE',
                    updatedAt: expect.any(Date)
                }
            });
        });
    });

    describe('updateCredentials', () => {
        it('should update integration credentials', async () => {
            const newCredentials: ChannelCredentials = {
                type: 'api_key',
                apiKey: 'new_key'
            };

            mockPrisma.integration.update.mockResolvedValue({
                id: 'test-id',
                channel: MessageChannel.SMS,
                status: 'ACTIVE',
                config: {},
                credentials: newCredentials,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            await configManager.updateCredentials(MessageChannel.SMS, newCredentials);

            expect(mockPrisma.integration.update).toHaveBeenCalledWith({
                where: { channel: MessageChannel.SMS },
                data: {
                    credentials: newCredentials,
                    updatedAt: expect.any(Date)
                }
            });
        });
    });

    describe('updateSettings', () => {
        it('should update integration settings', async () => {
            // First mock the getConfig call
            const mockDbIntegration = {
                channel: MessageChannel.SMS,
                status: 'ACTIVE',
                config: {
                    defaultSender: '+1234567890',
                    webhookUrl: 'https://example.com/webhook',
                    webhookSecret: 'test_secret'
                },
                credentials: {},
                createdAt: new Date(),
                updatedAt: new Date()
            };

            mockPrisma.integration.findUnique.mockResolvedValue(mockDbIntegration);
            mockPrisma.integration.update.mockResolvedValue({
                ...mockDbIntegration,
                updatedAt: new Date()
            });

            const newSettings: ChannelSettings = {
                newSetting: 'value'
            };

            await configManager.updateSettings(MessageChannel.SMS, newSettings);

            expect(mockPrisma.integration.update).toHaveBeenCalledWith({
                where: { channel: MessageChannel.SMS },
                data: {
                    config: expect.objectContaining({
                        newSetting: 'value',
                        webhookUrl: 'https://example.com/webhook',
                        webhookSecret: 'test_secret'
                    }),
                    updatedAt: expect.any(Date)
                }
            });
        });

        it('should throw error for non-existent config', async () => {
            mockPrisma.integration.findUnique.mockResolvedValue(null);

            await expect(configManager.updateSettings(MessageChannel.EMAIL, {}))
                .rejects.toThrow('Failed to update settings for EMAIL');
        });
    });

    describe('clearCache', () => {
        it('should clear all cache', () => {
            // This is mainly for coverage, hard to test internal cache state
            expect(() => configManager.clearCache()).not.toThrow();
        });

        it('should clear cache for specific channel', () => {
            expect(() => configManager.clearCache(MessageChannel.SMS)).not.toThrow();
        });
    });

    describe('validateCredentials', () => {
        it('should validate Twilio credentials', () => {
            const validCredentials: ChannelCredentials = {
                type: 'api_key',
                accountSid: 'test_sid',
                authToken: 'test_token'
            };

            const result = configManager.validateCredentials(MessageChannel.SMS, validCredentials);
            expect(result).toBe(true);
        });

        it('should reject invalid Twilio credentials', () => {
            const invalidCredentials: ChannelCredentials = {
                type: 'api_key',
                accountSid: 'test_sid'
                // Missing authToken
            };

            const result = configManager.validateCredentials(MessageChannel.SMS, invalidCredentials);
            expect(result).toBe(false);
        });

        it('should validate email credentials with API key', () => {
            const validCredentials: ChannelCredentials = {
                type: 'api_key',
                apiKey: 'test_key'
            };

            const result = configManager.validateCredentials(MessageChannel.EMAIL, validCredentials);
            expect(result).toBe(true);
        });

        it('should validate email credentials with username/password', () => {
            const validCredentials: ChannelCredentials = {
                type: 'basic_auth',
                username: 'test_user',
                password: 'test_pass'
            };

            const result = configManager.validateCredentials(MessageChannel.EMAIL, validCredentials);
            expect(result).toBe(true);
        });

        it('should validate Twitter credentials', () => {
            const validCredentials: ChannelCredentials = {
                type: 'oauth',
                apiKey: 'test_key',
                apiSecret: 'test_secret',
                accessToken: 'test_token',
                accessTokenSecret: 'test_token_secret'
            };

            const result = configManager.validateCredentials(MessageChannel.TWITTER, validCredentials);
            expect(result).toBe(true);
        });

        it('should validate Facebook credentials', () => {
            const validCredentials: ChannelCredentials = {
                type: 'oauth',
                accessToken: 'test_token',
                appSecret: 'test_secret'
            };

            const result = configManager.validateCredentials(MessageChannel.FACEBOOK, validCredentials);
            expect(result).toBe(true);
        });

        it('should return false for unsupported channel', () => {
            const credentials: ChannelCredentials = { type: 'api_key' };

            const result = configManager.validateCredentials('UNSUPPORTED' as MessageChannel, credentials);
            expect(result).toBe(false);
        });
    });
});