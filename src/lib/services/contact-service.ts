import { Contact, Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import {
    UnifiedContact,
    CreateContactInput,
    UpdateContactInput,
    ContactFilters,
    ContactQueryOptions,
    ContactWithRelations,
    ContactSearchResult,
    ContactMergeOptions,
    ContactMergeResult,
    ContactImportData,
    ContactImportResult,
    ContactStats,
    ContactMergeCandidate,
    FuzzyMatchConfig
} from '../types/contact';
import {
    findContactDuplicates,
    extractContactIdentifier,
    validateContactImport,
    mergeContactData,
    getContactDisplayName,
    normalizePhoneNumber,
    normalizeEmail,
    DEFAULT_FUZZY_CONFIG
} from '../utils/contact-utils';

export class ContactService {
    /**
     * Create a new contact
     */
    async createContact(input: CreateContactInput): Promise<UnifiedContact> {
        // Check for existing contacts to prevent duplicates
        const existingContacts = await this.findSimilarContacts(input);

        if (existingContacts.length > 0) {
            const highConfidenceMatch = existingContacts.find(c => c.confidence === 'exact' || c.confidence === 'high');
            if (highConfidenceMatch) {
                throw new Error(`Contact already exists: ${getContactDisplayName(highConfidenceMatch.contact)}`);
            }
        }

        const contactData: Prisma.ContactCreateInput = {
            name: input.name,
            phone: input.phone ? normalizePhoneNumber(input.phone) : null,
            email: input.email ? normalizeEmail(input.email) : null,
            socialHandles: input.socialHandles ? JSON.stringify(input.socialHandles) : null,
            metadata: input.metadata ? JSON.stringify(input.metadata) : null
        };

        const contact = await prisma.contact.create({
            data: contactData
        });

        return this.mapToUnifiedContact(contact);
    }

    /**
     * Get contact by ID
     */
    async getContactById(id: string, options: ContactQueryOptions = {}): Promise<ContactWithRelations | null> {
        const include = {
            messages: options.includeMessages || false,
            notes: options.includeNotes || false,
            assignments: options.includeAssignments || false
        };

        const contact = await prisma.contact.findUnique({
            where: { id },
            include
        });

        if (!contact) return null;

        const unifiedContact = this.mapToUnifiedContact(contact);

        if (options.includeStats) {
            // Add computed stats
            const messageCount = await prisma.message.count({
                where: { contactId: id }
            });

            const lastMessage = await prisma.message.findFirst({
                where: { contactId: id },
                orderBy: { createdAt: 'desc' }
            });

            unifiedContact.messageCount = messageCount;
            unifiedContact.lastMessageAt = lastMessage?.createdAt;
            unifiedContact.lastInteractionAt = lastMessage?.createdAt;
        }

        return {
            ...unifiedContact,
            messages: (contact as any).messages || undefined,
            notes: (contact as any).notes || undefined,
            assignments: (contact as any).assignments || undefined
        };
    }

    /**
     * Update contact
     */
    async updateContact(id: string, input: UpdateContactInput): Promise<UnifiedContact> {
        const existingContact = await prisma.contact.findUnique({
            where: { id }
        });

        if (!existingContact) {
            throw new Error('Contact not found');
        }

        const updateData: Prisma.ContactUpdateInput = {
            name: input.name,
            phone: input.phone ? normalizePhoneNumber(input.phone) : undefined,
            email: input.email ? normalizeEmail(input.email) : undefined,
            socialHandles: input.socialHandles ? JSON.stringify(input.socialHandles) : undefined,
            metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
            updatedAt: new Date()
        };

        const contact = await prisma.contact.update({
            where: { id },
            data: updateData
        });

        return this.mapToUnifiedContact(contact);
    }

    /**
     * Delete contact
     */
    async deleteContact(id: string): Promise<void> {
        await prisma.contact.delete({
            where: { id }
        });
    }

    /**
     * Search and filter contacts
     */
    async searchContacts(
        filters: ContactFilters = {},
        options: ContactQueryOptions = {}
    ): Promise<ContactSearchResult> {
        const where: Prisma.ContactWhereInput = {};

        // Text search across name, email, phone
        if (filters.searchText) {
            where.OR = [
                { name: { contains: filters.searchText, mode: 'insensitive' } },
                { email: { contains: filters.searchText, mode: 'insensitive' } },
                { phone: { contains: filters.searchText } }
            ];
        }

        // Specific field filters
        if (filters.phone) {
            where.phone = normalizePhoneNumber(filters.phone);
        }

        if (filters.email) {
            where.email = normalizeEmail(filters.email);
        }

        // Date range filters
        if (filters.createdFrom || filters.createdTo) {
            where.createdAt = {};
            if (filters.createdFrom) where.createdAt.gte = filters.createdFrom;
            if (filters.createdTo) where.createdAt.lte = filters.createdTo;
        }

        // Message-related filters
        if (filters.hasMessages !== undefined) {
            if (filters.hasMessages) {
                where.messages = { some: {} };
            } else {
                where.messages = { none: {} };
            }
        }

        if (filters.lastInteractionFrom || filters.lastInteractionTo) {
            const messageWhere: any = {};
            if (filters.lastInteractionFrom) messageWhere.createdAt = { gte: filters.lastInteractionFrom };
            if (filters.lastInteractionTo) {
                messageWhere.createdAt = messageWhere.createdAt || {};
                messageWhere.createdAt.lte = filters.lastInteractionTo;
            }
            where.messages = { some: messageWhere };
        }

        // Metadata filters (tags, status, priority, etc.)
        if (filters.tags && filters.tags.length > 0) {
            // This would require a more complex JSON query in production
            // For now, we'll use a simple contains check
            where.metadata = {
                path: ['tags'],
                array_contains: filters.tags
            } as any;
        }

        // Pagination and ordering
        const orderBy: Prisma.ContactOrderByWithRelationInput = {};
        if (options.orderBy) {
            orderBy[options.orderBy] = options.orderDirection || 'desc';
        } else {
            orderBy.updatedAt = 'desc';
        }

        const [contacts, total] = await Promise.all([
            prisma.contact.findMany({
                where,
                orderBy,
                skip: options.offset || 0,
                take: options.limit || 50,
                include: {
                    messages: options.includeMessages || false,
                    notes: options.includeNotes || false,
                    assignments: options.includeAssignments || false
                }
            }),
            prisma.contact.count({ where })
        ]);

        const unifiedContacts = contacts.map(contact => this.mapToUnifiedContact(contact));

        return {
            contacts: unifiedContacts,
            total,
            hasMore: (options.offset || 0) + contacts.length < total
        };
    }

    /**
     * Find or create contact from message identifier
     */
    async findOrCreateFromMessage(
        from: string,
        channel: string,
        additionalData?: Partial<CreateContactInput>
    ): Promise<UnifiedContact> {
        const identifier = extractContactIdentifier(from, channel);

        // Try to find existing contact
        let existingContact = null;

        if (identifier.phone) {
            existingContact = await prisma.contact.findFirst({
                where: { phone: identifier.phone }
            });
        }

        if (!existingContact && identifier.email) {
            existingContact = await prisma.contact.findFirst({
                where: { email: identifier.email }
            });
        }

        if (!existingContact && identifier.socialHandle) {
            // Search in social handles JSON field
            existingContact = await prisma.contact.findFirst({
                where: {
                    socialHandles: {
                        path: [channel.toLowerCase()],
                        equals: identifier.socialHandle
                    } as any
                }
            });
        }

        if (existingContact) {
            return this.mapToUnifiedContact(existingContact);
        }

        // Create new contact
        const createInput: CreateContactInput = {
            ...additionalData,
            phone: identifier.phone,
            email: identifier.email,
            socialHandles: identifier.socialHandle ? {
                [channel.toLowerCase()]: identifier.socialHandle
            } : undefined,
            metadata: {
                ...additionalData?.metadata,
                source: `${channel}_message`
            }
        };

        return this.createContact(createInput);
    }

    /**
     * Find similar contacts for duplicate detection
     */
    async findSimilarContacts(
        input: CreateContactInput,
        config: FuzzyMatchConfig = DEFAULT_FUZZY_CONFIG
    ): Promise<ContactMergeCandidate[]> {
        // Get all contacts for comparison (in production, this should be optimized)
        const allContacts = await prisma.contact.findMany({
            take: 1000 // Limit for performance
        });

        const unifiedContacts = allContacts.map(contact => this.mapToUnifiedContact(contact));

        const tempContact: UnifiedContact = {
            id: 'temp',
            name: input.name,
            phone: input.phone,
            email: input.email,
            socialHandles: input.socialHandles,
            metadata: input.metadata,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        return findContactDuplicates(tempContact, unifiedContacts, config);
    }

    /**
     * Merge two contacts
     */
    async mergeContacts(options: ContactMergeOptions): Promise<ContactMergeResult> {
        const { primaryContactId, secondaryContactId, fieldPreferences = {}, mergeMessages = true, mergeNotes = true, deleteSecondary = true } = options;

        try {
            const [primaryContact, secondaryContact] = await Promise.all([
                prisma.contact.findUnique({ where: { id: primaryContactId } }),
                prisma.contact.findUnique({ where: { id: secondaryContactId } })
            ]);

            if (!primaryContact || !secondaryContact) {
                return {
                    success: false,
                    error: 'One or both contacts not found',
                    mergedFields: [],
                    conflictResolutions: {}
                };
            }

            const primaryUnified = this.mapToUnifiedContact(primaryContact);
            const secondaryUnified = this.mapToUnifiedContact(secondaryContact);

            // Merge contact data
            const mergedData = mergeContactData(primaryUnified, secondaryUnified, fieldPreferences);

            // Update primary contact
            await prisma.contact.update({
                where: { id: primaryContactId },
                data: {
                    name: mergedData.name,
                    phone: mergedData.phone,
                    email: mergedData.email,
                    socialHandles: mergedData.socialHandles ? JSON.stringify(mergedData.socialHandles) : null,
                    metadata: mergedData.metadata ? JSON.stringify(mergedData.metadata) : null,
                    updatedAt: new Date()
                }
            });

            // Merge related data
            if (mergeMessages) {
                await prisma.message.updateMany({
                    where: { contactId: secondaryContactId },
                    data: { contactId: primaryContactId }
                });
            }

            if (mergeNotes) {
                await prisma.note.updateMany({
                    where: { contactId: secondaryContactId },
                    data: { contactId: primaryContactId }
                });
            }

            // Delete secondary contact if requested
            if (deleteSecondary) {
                await prisma.contact.delete({
                    where: { id: secondaryContactId }
                });
            }

            return {
                success: true,
                mergedContact: mergedData,
                mergedFields: Object.keys(fieldPreferences),
                conflictResolutions: fieldPreferences
            };

        } catch (error: any) {
            return {
                success: false,
                error: error.message,
                mergedFields: [],
                conflictResolutions: {}
            };
        }
    }

    /**
     * Import contacts from data array
     */
    async importContacts(data: ContactImportData[]): Promise<ContactImportResult> {
        const result: ContactImportResult = {
            success: true,
            imported: 0,
            skipped: 0,
            errors: [],
            duplicates: []
        };

        for (let i = 0; i < data.length; i++) {
            const contactData = data[i];

            try {
                // Validate data
                const validation = validateContactImport(contactData);
                if (!validation.isValid) {
                    result.errors.push({
                        row: i + 1,
                        data: contactData,
                        error: validation.errors.join(', ')
                    });
                    result.skipped++;
                    continue;
                }

                // Check for duplicates
                const createInput: CreateContactInput = {
                    name: contactData.name,
                    phone: contactData.phone,
                    email: contactData.email,
                    metadata: {
                        company: contactData.company,
                        jobTitle: contactData.jobTitle,
                        tags: contactData.tags,
                        customFields: contactData.customFields,
                        source: 'import'
                    }
                };

                const duplicates = await this.findSimilarContacts(createInput);
                const highConfidenceDuplicate = duplicates.find(d => d.confidence === 'exact' || d.confidence === 'high');

                if (highConfidenceDuplicate) {
                    result.duplicates.push(highConfidenceDuplicate);
                    result.skipped++;
                    continue;
                }

                // Create contact
                await this.createContact(createInput);
                result.imported++;

            } catch (error: any) {
                result.errors.push({
                    row: i + 1,
                    data: contactData,
                    error: error.message
                });
                result.skipped++;
            }
        }

        result.success = result.errors.length === 0;
        return result;
    }

    /**
     * Get contact statistics
     */
    async getContactStats(): Promise<ContactStats> {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [
            totalContacts,
            newContactsThisMonth,
            activeContacts
        ] = await Promise.all([
            prisma.contact.count(),
            prisma.contact.count({
                where: {
                    createdAt: { gte: startOfMonth }
                }
            }),
            prisma.contact.count({
                where: {
                    messages: { some: {} }
                }
            })
        ]);

        // Get top sources (this would need proper JSON querying in production)
        const topSources = [
            { source: 'sms_message', count: 0 },
            { source: 'email_message', count: 0 },
            { source: 'whatsapp_message', count: 0 }
        ];

        // Get top companies (this would need proper JSON querying in production)
        const topCompanies = [
            { company: 'Unknown', count: totalContacts }
        ];

        // Get channel distribution
        const channelDistribution = await prisma.message.groupBy({
            by: ['channel'],
            _count: {
                contactId: true
            },
            distinct: ['contactId']
        });

        return {
            totalContacts,
            activeContacts,
            newContactsThisMonth,
            topSources,
            topCompanies,
            channelDistribution: channelDistribution.map(item => ({
                channel: item.channel,
                count: item._count.contactId
            }))
        };
    }

    /**
     * Map Prisma Contact to UnifiedContact
     */
    private mapToUnifiedContact(contact: Contact): UnifiedContact {
        return {
            id: contact.id,
            name: contact.name || undefined,
            phone: contact.phone || undefined,
            email: contact.email || undefined,
            socialHandles: contact.socialHandles ? JSON.parse(contact.socialHandles) : undefined,
            metadata: contact.metadata ? JSON.parse(contact.metadata) : undefined,
            createdAt: contact.createdAt,
            updatedAt: contact.updatedAt
        };
    }
}