import { ContactService } from '../services/contact-service';
import { prisma } from '../prisma';
import {
    CreateContactInput,
    UpdateContactInput,
    ContactFilters,
    ContactQueryOptions,
    ContactMergeOptions,
    ContactImportData
} from '../types/contact';

// Mock Prisma
jest.mock('../prisma', () => ({
    prisma: {
        contact: {
            create: jest.fn(),
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            count: jest.fn(),
            updateMany: jest.fn(),
            groupBy: jest.fn()
        },
        message: {
            count: jest.fn(),
            findFirst: jest.fn(),
            updateMany: jest.fn(),
            groupBy: jest.fn()
        },
        note: {
            updateMany: jest.fn()
        }
    }
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('ContactService', () => {
    let contactService: ContactService;

    beforeEach(() => {
        contactService = new ContactService();
        jest.clearAllMocks();
    });

    describe('createContact', () => {
        it('should create a new contact successfully', async () => {
            const input: CreateContactInput = {
                name: 'John Doe',
                phone: '+1234567890',
                email: 'john@example.com',
                metadata: {
                    company: 'Acme Corp',
                    jobTitle: 'Developer'
                }
            };

            const mockContact = {
                id: 'contact-123',
                name: 'John Doe',
                phone: '+1234567890',
                email: 'john@example.com',
                socialHandles: null,
                metadata: JSON.stringify(input.metadata),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Mock no existing contacts (no duplicates)
            mockPrisma.contact.findMany.mockResolvedValue([]);
            mockPrisma.contact.create.mockResolvedValue(mockContact);

            const result = await contactService.createContact(input);

            expect(result.id).toBe('contact-123');
            expect(result.name).toBe('John Doe');
            expect(result.phone).toBe('+1234567890');
            expect(result.email).toBe('john@example.com');
            expect(mockPrisma.contact.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    name: 'John Doe',
                    phone: '+1234567890',
                    email: 'john@example.com'
                })
            });
        });

        it('should throw error for duplicate contact', async () => {
            const input: CreateContactInput = {
                name: 'John Doe',
                email: 'john@example.com'
            };

            const existingContact = {
                id: 'existing-123',
                name: 'John Doe',
                phone: null,
                email: 'john@example.com',
                socialHandles: null,
                metadata: null,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Mock existing contact found
            mockPrisma.contact.findMany.mockResolvedValue([existingContact]);

            await expect(contactService.createContact(input)).rejects.toThrow('Contact already exists');
        });

        it('should normalize phone and email', async () => {
            const input: CreateContactInput = {
                name: 'Jane Doe',
                phone: '(555) 123-4567',
                email: 'JANE@EXAMPLE.COM'
            };

            const mockContact = {
                id: 'contact-456',
                name: 'Jane Doe',
                phone: '+15551234567',
                email: 'jane@example.com',
                socialHandles: null,
                metadata: null,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            mockPrisma.contact.findMany.mockResolvedValue([]);
            mockPrisma.contact.create.mockResolvedValue(mockContact);

            const result = await contactService.createContact(input);

            expect(mockPrisma.contact.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    phone: '+15551234567',
                    email: 'jane@example.com'
                })
            });
        });
    });

    describe('getContactById', () => {
        it('should return contact with basic data', async () => {
            const mockContact = {
                id: 'contact-123',
                name: 'John Doe',
                phone: '+1234567890',
                email: 'john@example.com',
                socialHandles: null,
                metadata: null,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            mockPrisma.contact.findUnique.mockResolvedValue(mockContact);

            const result = await contactService.getContactById('contact-123');

            expect(result).toBeDefined();
            expect(result!.id).toBe('contact-123');
            expect(result!.name).toBe('John Doe');
            expect(mockPrisma.contact.findUnique).toHaveBeenCalledWith({
                where: { id: 'contact-123' },
                include: {
                    messages: false,
                    notes: false,
                    assignments: false
                }
            });
        });

        it('should return null for non-existent contact', async () => {
            mockPrisma.contact.findUnique.mockResolvedValue(null);

            const result = await contactService.getContactById('non-existent');

            expect(result).toBeNull();
        });

        it('should include stats when requested', async () => {
            const mockContact = {
                id: 'contact-123',
                name: 'John Doe',
                phone: '+1234567890',
                email: 'john@example.com',
                socialHandles: null,
                metadata: null,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const mockLastMessage = {
                id: 'message-123',
                createdAt: new Date()
            };

            mockPrisma.contact.findUnique.mockResolvedValue(mockContact);
            mockPrisma.message.count.mockResolvedValue(5);
            mockPrisma.message.findFirst.mockResolvedValue(mockLastMessage);

            const options: ContactQueryOptions = { includeStats: true };
            const result = await contactService.getContactById('contact-123', options);

            expect(result!.messageCount).toBe(5);
            expect(result!.lastMessageAt).toBe(mockLastMessage.createdAt);
        });
    });

    describe('updateContact', () => {
        it('should update contact successfully', async () => {
            const existingContact = {
                id: 'contact-123',
                name: 'John Doe',
                phone: '+1234567890',
                email: 'john@example.com',
                socialHandles: null,
                metadata: null,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const updatedContact = {
                ...existingContact,
                name: 'John Smith',
                updatedAt: new Date()
            };

            const updateInput: UpdateContactInput = {
                name: 'John Smith'
            };

            mockPrisma.contact.findUnique.mockResolvedValue(existingContact);
            mockPrisma.contact.update.mockResolvedValue(updatedContact);

            const result = await contactService.updateContact('contact-123', updateInput);

            expect(result.name).toBe('John Smith');
            expect(mockPrisma.contact.update).toHaveBeenCalledWith({
                where: { id: 'contact-123' },
                data: expect.objectContaining({
                    name: 'John Smith',
                    updatedAt: expect.any(Date)
                })
            });
        });

        it('should throw error for non-existent contact', async () => {
            mockPrisma.contact.findUnique.mockResolvedValue(null);

            const updateInput: UpdateContactInput = {
                name: 'John Smith'
            };

            await expect(contactService.updateContact('non-existent', updateInput))
                .rejects.toThrow('Contact not found');
        });
    });

    describe('searchContacts', () => {
        it('should search contacts by text', async () => {
            const mockContacts = [
                {
                    id: 'contact-1',
                    name: 'John Doe',
                    phone: '+1234567890',
                    email: 'john@example.com',
                    socialHandles: null,
                    metadata: null,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ];

            mockPrisma.contact.findMany.mockResolvedValue(mockContacts);
            mockPrisma.contact.count.mockResolvedValue(1);

            const filters: ContactFilters = {
                searchText: 'John'
            };

            const result = await contactService.searchContacts(filters);

            expect(result.contacts).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(result.hasMore).toBe(false);
            expect(mockPrisma.contact.findMany).toHaveBeenCalledWith({
                where: {
                    OR: [
                        { name: { contains: 'John', mode: 'insensitive' } },
                        { email: { contains: 'John', mode: 'insensitive' } },
                        { phone: { contains: 'John' } }
                    ]
                },
                orderBy: { updatedAt: 'desc' },
                skip: 0,
                take: 50,
                include: {
                    messages: false,
                    notes: false,
                    assignments: false
                }
            });
        });

        it('should filter by phone number', async () => {
            const filters: ContactFilters = {
                phone: '(555) 123-4567'
            };

            mockPrisma.contact.findMany.mockResolvedValue([]);
            mockPrisma.contact.count.mockResolvedValue(0);

            await contactService.searchContacts(filters);

            expect(mockPrisma.contact.findMany).toHaveBeenCalledWith({
                where: {
                    phone: '+15551234567' // Normalized phone
                },
                orderBy: { updatedAt: 'desc' },
                skip: 0,
                take: 50,
                include: {
                    messages: false,
                    notes: false,
                    assignments: false
                }
            });
        });

        it('should handle pagination', async () => {
            const options: ContactQueryOptions = {
                limit: 10,
                offset: 20,
                orderBy: 'name',
                orderDirection: 'asc'
            };

            mockPrisma.contact.findMany.mockResolvedValue([]);
            mockPrisma.contact.count.mockResolvedValue(0);

            await contactService.searchContacts({}, options);

            expect(mockPrisma.contact.findMany).toHaveBeenCalledWith({
                where: {},
                orderBy: { name: 'asc' },
                skip: 20,
                take: 10,
                include: {
                    messages: false,
                    notes: false,
                    assignments: false
                }
            });
        });
    });

    describe('findOrCreateFromMessage', () => {
        it('should find existing contact by phone', async () => {
            const existingContact = {
                id: 'contact-123',
                name: 'John Doe',
                phone: '+1234567890',
                email: null,
                socialHandles: null,
                metadata: null,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            mockPrisma.contact.findFirst.mockResolvedValue(existingContact);

            const result = await contactService.findOrCreateFromMessage('+1234567890', 'sms');

            expect(result.id).toBe('contact-123');
            expect(mockPrisma.contact.findFirst).toHaveBeenCalledWith({
                where: { phone: '+1234567890' }
            });
        });

        it('should create new contact if not found', async () => {
            const newContact = {
                id: 'contact-new',
                name: null,
                phone: '+1234567890',
                email: null,
                socialHandles: null,
                metadata: JSON.stringify({ source: 'sms_message' }),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // No existing contact found
            mockPrisma.contact.findFirst.mockResolvedValue(null);
            // No duplicates found
            mockPrisma.contact.findMany.mockResolvedValue([]);
            // Create new contact
            mockPrisma.contact.create.mockResolvedValue(newContact);

            const result = await contactService.findOrCreateFromMessage('+1234567890', 'sms');

            expect(result.id).toBe('contact-new');
            expect(result.phone).toBe('+1234567890');
            expect(mockPrisma.contact.create).toHaveBeenCalled();
        });

        it('should handle email identifier', async () => {
            mockPrisma.contact.findFirst
                .mockResolvedValueOnce(null) // No phone match
                .mockResolvedValueOnce(null); // No email match
            mockPrisma.contact.findMany.mockResolvedValue([]);

            const newContact = {
                id: 'contact-email',
                name: null,
                phone: null,
                email: 'user@example.com',
                socialHandles: null,
                metadata: JSON.stringify({ source: 'email_message' }),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            mockPrisma.contact.create.mockResolvedValue(newContact);

            const result = await contactService.findOrCreateFromMessage('user@example.com', 'email');

            expect(result.email).toBe('user@example.com');
        });
    });

    describe('mergeContacts', () => {
        it('should merge contacts successfully', async () => {
            const primaryContact = {
                id: 'primary-123',
                name: 'John Doe',
                phone: '+1234567890',
                email: 'john@example.com',
                socialHandles: null,
                metadata: null,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const secondaryContact = {
                id: 'secondary-456',
                name: 'J. Doe',
                phone: null,
                email: 'john.doe@example.com',
                socialHandles: JSON.stringify({ twitter: '@johndoe' }),
                metadata: JSON.stringify({ company: 'Acme Corp' }),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            mockPrisma.contact.findUnique
                .mockResolvedValueOnce(primaryContact)
                .mockResolvedValueOnce(secondaryContact);

            mockPrisma.contact.update.mockResolvedValue({
                ...primaryContact,
                socialHandles: JSON.stringify({ twitter: '@johndoe' }),
                metadata: JSON.stringify({ company: 'Acme Corp' }),
                updatedAt: new Date()
            });

            const options: ContactMergeOptions = {
                primaryContactId: 'primary-123',
                secondaryContactId: 'secondary-456',
                mergeMessages: true,
                mergeNotes: true,
                deleteSecondary: true
            };

            const result = await contactService.mergeContacts(options);

            expect(result.success).toBe(true);
            expect(result.mergedContact).toBeDefined();
            expect(mockPrisma.contact.update).toHaveBeenCalled();
            expect(mockPrisma.message.updateMany).toHaveBeenCalledWith({
                where: { contactId: 'secondary-456' },
                data: { contactId: 'primary-123' }
            });
            expect(mockPrisma.contact.delete).toHaveBeenCalledWith({
                where: { id: 'secondary-456' }
            });
        });

        it('should handle merge errors', async () => {
            mockPrisma.contact.findUnique.mockResolvedValue(null);

            const options: ContactMergeOptions = {
                primaryContactId: 'non-existent',
                secondaryContactId: 'also-non-existent'
            };

            const result = await contactService.mergeContacts(options);

            expect(result.success).toBe(false);
            expect(result.error).toBe('One or both contacts not found');
        });
    });

    describe('importContacts', () => {
        it('should import valid contacts', async () => {
            const importData: ContactImportData[] = [
                {
                    name: 'Alice Johnson',
                    email: 'alice@example.com',
                    company: 'Tech Corp'
                },
                {
                    name: 'Bob Smith',
                    phone: '+1555123456',
                    jobTitle: 'Manager'
                }
            ];

            // Mock no duplicates found
            mockPrisma.contact.findMany.mockResolvedValue([]);

            // Mock successful contact creation
            mockPrisma.contact.create
                .mockResolvedValueOnce({
                    id: 'contact-1',
                    name: 'Alice Johnson',
                    phone: null,
                    email: 'alice@example.com',
                    socialHandles: null,
                    metadata: JSON.stringify({ company: 'Tech Corp', source: 'import' }),
                    createdAt: new Date(),
                    updatedAt: new Date()
                })
                .mockResolvedValueOnce({
                    id: 'contact-2',
                    name: 'Bob Smith',
                    phone: '+1555123456',
                    email: null,
                    socialHandles: null,
                    metadata: JSON.stringify({ jobTitle: 'Manager', source: 'import' }),
                    createdAt: new Date(),
                    updatedAt: new Date()
                });

            const result = await contactService.importContacts(importData);

            expect(result.success).toBe(true);
            expect(result.imported).toBe(2);
            expect(result.skipped).toBe(0);
            expect(result.errors).toHaveLength(0);
        });

        it('should handle validation errors', async () => {
            const importData: ContactImportData[] = [
                {
                    // Missing required fields
                },
                {
                    name: 'Valid Contact',
                    email: 'valid@example.com'
                }
            ];

            // Mock no duplicates for valid contact
            mockPrisma.contact.findMany.mockResolvedValue([]);
            mockPrisma.contact.create.mockResolvedValue({
                id: 'contact-valid',
                name: 'Valid Contact',
                phone: null,
                email: 'valid@example.com',
                socialHandles: null,
                metadata: JSON.stringify({ source: 'import' }),
                createdAt: new Date(),
                updatedAt: new Date()
            });

            const result = await contactService.importContacts(importData);

            expect(result.success).toBe(false);
            expect(result.imported).toBe(1);
            expect(result.skipped).toBe(1);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].row).toBe(1);
        });

        it('should detect duplicates', async () => {
            const importData: ContactImportData[] = [
                {
                    name: 'John Doe',
                    email: 'john@example.com'
                }
            ];

            // Mock existing contact (duplicate)
            const existingContact = {
                id: 'existing-123',
                name: 'John Doe',
                phone: null,
                email: 'john@example.com',
                socialHandles: null,
                metadata: null,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            mockPrisma.contact.findMany.mockResolvedValue([existingContact]);

            const result = await contactService.importContacts(importData);

            expect(result.imported).toBe(0);
            expect(result.skipped).toBe(1);
            expect(result.duplicates).toHaveLength(1);
        });
    });

    describe('getContactStats', () => {
        it('should return contact statistics', async () => {
            mockPrisma.contact.count
                .mockResolvedValueOnce(100) // total
                .mockResolvedValueOnce(15)  // new this month
                .mockResolvedValueOnce(75); // active

            mockPrisma.message.groupBy.mockResolvedValue([
                { channel: 'SMS', _count: { contactId: 30 } },
                { channel: 'EMAIL', _count: { contactId: 25 } },
                { channel: 'WHATSAPP', _count: { contactId: 20 } }
            ]);

            const stats = await contactService.getContactStats();

            expect(stats.totalContacts).toBe(100);
            expect(stats.newContactsThisMonth).toBe(15);
            expect(stats.activeContacts).toBe(75);
            expect(stats.channelDistribution).toHaveLength(3);
            expect(stats.channelDistribution[0]).toEqual({
                channel: 'SMS',
                count: 30
            });
        });
    });
});