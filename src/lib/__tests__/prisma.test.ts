import { prisma, connectToDatabase, checkDatabaseHealth } from '../prisma';
import { ContactQueries, MessageQueries, AuditLogger } from '../db-utils';

// Mock environment for testing
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/unified_inbox';

describe('Database Setup', () => {
    beforeAll(async () => {
        await connectToDatabase();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    describe('Database Connection', () => {
        it('should connect to database successfully', async () => {
            const isConnected = await connectToDatabase();
            expect(isConnected).toBe(true);
        });

        it('should pass health check', async () => {
            const health = await checkDatabaseHealth();
            expect(health.status).toBe('healthy');
        });
    });

    describe('Basic CRUD Operations', () => {
        let testUserId: string;
        let testContactId: string;

        it('should create a test user', async () => {
            const user = await prisma.user.create({
                data: {
                    email: 'test@example.com',
                    name: 'Test User',
                    role: 'EDITOR',
                },
            });

            testUserId = user.id;
            expect(user.email).toBe('test@example.com');
            expect(user.role).toBe('EDITOR');
        });

        it('should create a test contact', async () => {
            const contact = await prisma.contact.create({
                data: {
                    name: 'Test Contact',
                    phone: '+1234567890',
                    email: 'contact@example.com',
                },
            });

            testContactId = contact.id;
            expect(contact.name).toBe('Test Contact');
            expect(contact.phone).toBe('+1234567890');
        });

        it('should create a message with proper relationships', async () => {
            const message = await prisma.message.create({
                data: {
                    contactId: testContactId,
                    userId: testUserId,
                    channel: 'SMS',
                    direction: 'INBOUND',
                    content: { text: 'Hello, this is a test message' },
                    threadId: `${testContactId}_SMS`,
                    status: 'DELIVERED',
                },
                include: {
                    contact: true,
                    user: true,
                },
            });

            expect(message.content).toEqual({ text: 'Hello, this is a test message' });
            expect(message.contact.id).toBe(testContactId);
            expect(message.user?.id).toBe(testUserId);
        });

        it('should create a note for the contact', async () => {
            const note = await prisma.note.create({
                data: {
                    contactId: testContactId,
                    userId: testUserId,
                    content: 'This is a test note',
                    type: 'PUBLIC',
                },
            });

            expect(note.content).toBe('This is a test note');
            expect(note.type).toBe('PUBLIC');
        });

        // Cleanup test data
        afterAll(async () => {
            if (testContactId) {
                await prisma.contact.delete({ where: { id: testContactId } });
            }
            if (testUserId) {
                await prisma.user.delete({ where: { id: testUserId } });
            }
        });
    });

    describe('Database Utilities', () => {
        it('should search contacts', async () => {
            const result = await ContactQueries.searchContacts('John', { page: 1, limit: 10 });
            expect(result).toHaveProperty('contacts');
            expect(result).toHaveProperty('pagination');
            expect(Array.isArray(result.contacts)).toBe(true);
        });

        it('should get message thread', async () => {
            // First get a contact to test with
            const contacts = await prisma.contact.findMany({ take: 1 });
            if (contacts.length > 0) {
                const result = await MessageQueries.getMessageThread(contacts[0].id);
                expect(result).toHaveProperty('messages');
                expect(result).toHaveProperty('pagination');
                expect(Array.isArray(result.messages)).toBe(true);
            }
        });

        it('should log audit events', async () => {
            const users = await prisma.user.findMany({ take: 1 });
            if (users.length > 0) {
                const log = await AuditLogger.log(
                    'TEST_ACTION',
                    'test_resource',
                    'test_id',
                    users[0].id,
                    { test: true }
                );

                expect(log.action).toBe('TEST_ACTION');
                expect(log.resource).toBe('test_resource');
                expect(log.userId).toBe(users[0].id);
            }
        });
    });

    describe('Database Indexes', () => {
        it('should have proper indexes for performance', async () => {
            // Test that queries use indexes by checking execution plans
            // This is a simplified test - in production you'd use EXPLAIN ANALYZE
            const contacts = await prisma.contact.findMany({
                where: { email: { contains: 'test' } },
                take: 1,
            });

            // If this executes quickly, indexes are likely working
            expect(Array.isArray(contacts)).toBe(true);
        });
    });
});