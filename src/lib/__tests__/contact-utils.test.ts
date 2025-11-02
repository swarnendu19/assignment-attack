import {
    normalizePhoneNumber,
    normalizeName,
    normalizeEmail,
    calculateSimilarity,
    findContactDuplicates,
    extractContactIdentifier,
    validateContactImport,
    isValidEmail,
    isValidPhone,
    getContactDisplayName,
    getContactInitials,
    mergeContactData,
    DEFAULT_FUZZY_CONFIG
} from '../utils/contact-utils';
import { UnifiedContact, ContactImportData, FuzzyMatchConfig } from '../types/contact';

describe('Contact Utils', () => {
    describe('normalizePhoneNumber', () => {
        it('should normalize US phone numbers', () => {
            expect(normalizePhoneNumber('(555) 123-4567')).toBe('+15551234567');
            expect(normalizePhoneNumber('555-123-4567')).toBe('+15551234567');
            expect(normalizePhoneNumber('555.123.4567')).toBe('+15551234567');
            expect(normalizePhoneNumber('5551234567')).toBe('+15551234567');
        });

        it('should handle international numbers', () => {
            expect(normalizePhoneNumber('+44 20 7946 0958')).toBe('+442079460958');
            expect(normalizePhoneNumber('44 20 7946 0958')).toBe('+442079460958');
            expect(normalizePhoneNumber('+1 555 123 4567')).toBe('+15551234567');
        });

        it('should handle empty or invalid input', () => {
            expect(normalizePhoneNumber('')).toBe('');
            expect(normalizePhoneNumber('abc')).toBe('+');
        });
    });

    describe('normalizeName', () => {
        it('should normalize names consistently', () => {
            expect(normalizeName('John Doe')).toBe('doe john');
            expect(normalizeName('  John   Doe  ')).toBe('doe john');
            expect(normalizeName('John-Paul Doe')).toBe('doe johnpaul');
            expect(normalizeName('JOHN DOE')).toBe('doe john');
        });

        it('should handle empty input', () => {
            expect(normalizeName('')).toBe('');
        });

        it('should sort words for consistent comparison', () => {
            expect(normalizeName('Doe John')).toBe('doe john');
            expect(normalizeName('John Doe')).toBe('doe john');
        });
    });

    describe('normalizeEmail', () => {
        it('should normalize email addresses', () => {
            expect(normalizeEmail('John@Example.COM')).toBe('john@example.com');
            expect(normalizeEmail('  user@domain.org  ')).toBe('user@domain.org');
        });

        it('should handle empty input', () => {
            expect(normalizeEmail('')).toBe('');
        });
    });

    describe('calculateSimilarity', () => {
        it('should calculate similarity correctly', () => {
            expect(calculateSimilarity('hello', 'hello')).toBe(1);
            expect(calculateSimilarity('hello', 'helo')).toBeCloseTo(0.8);
            expect(calculateSimilarity('hello', 'world')).toBeLessThan(0.5);
            expect(calculateSimilarity('', '')).toBe(1);
            expect(calculateSimilarity('hello', '')).toBe(0);
        });
    });

    describe('findContactDuplicates', () => {
        const existingContacts: UnifiedContact[] = [
            {
                id: 'contact-1',
                name: 'John Doe',
                phone: '+15551234567',
                email: 'john@example.com',
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: 'contact-2',
                name: 'Jane Smith',
                phone: '+15559876543',
                email: 'jane@example.com',
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: 'contact-3',
                name: 'Jon Doe', // Similar to John Doe
                phone: '+15551234568', // Similar phone
                email: 'jon@example.com',
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ];

        it('should find exact matches', () => {
            const newContact: UnifiedContact = {
                id: 'new-contact',
                name: 'John Doe',
                phone: '+15551234567',
                email: 'john@example.com',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const duplicates = findContactDuplicates(newContact, existingContacts);

            expect(duplicates).toHaveLength(1);
            expect(duplicates[0].contact.id).toBe('contact-1');
            expect(duplicates[0].confidence).toBe('exact');
            expect(duplicates[0].matchingFields).toContain('name');
            expect(duplicates[0].matchingFields).toContain('phone');
            expect(duplicates[0].matchingFields).toContain('email');
        });

        it('should find similar matches', () => {
            const newContact: UnifiedContact = {
                id: 'new-contact',
                name: 'Jon Doe',
                phone: '+15551234568',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const duplicates = findContactDuplicates(newContact, existingContacts);

            expect(duplicates.length).toBeGreaterThan(0);
            const match = duplicates.find(d => d.contact.id === 'contact-3');
            expect(match).toBeDefined();
            expect(match!.matchingFields).toContain('name');
            expect(match!.matchingFields).toContain('phone');
        });

        it('should respect similarity thresholds', () => {
            const strictConfig: FuzzyMatchConfig = {
                nameThreshold: 0.95,
                phoneThreshold: 0.95,
                emailThreshold: 0.95,
                enablePhoneNormalization: true,
                enableNameNormalization: true
            };

            const newContact: UnifiedContact = {
                id: 'new-contact',
                name: 'Johnny Doe', // Less similar
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const duplicates = findContactDuplicates(newContact, existingContacts, strictConfig);

            // Should find fewer matches with strict thresholds
            expect(duplicates.length).toBeLessThanOrEqual(1);
        });

        it('should handle social handles matching', () => {
            const contactWithSocial: UnifiedContact = {
                id: 'contact-social',
                name: 'Social User',
                socialHandles: {
                    twitter: '@johndoe'
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const existingWithSocial: UnifiedContact[] = [
                {
                    id: 'existing-social',
                    name: 'Different Name',
                    socialHandles: {
                        twitter: '@johndoe' // Same handle
                    },
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ];

            const duplicates = findContactDuplicates(contactWithSocial, existingWithSocial);

            expect(duplicates).toHaveLength(1);
            expect(duplicates[0].matchingFields).toContain('socialHandles');
        });
    });

    describe('extractContactIdentifier', () => {
        it('should extract phone from SMS channel', () => {
            const result = extractContactIdentifier('+15551234567', 'sms');
            expect(result.phone).toBe('+15551234567');
            expect(result.email).toBeUndefined();
        });

        it('should extract email from email channel', () => {
            const result = extractContactIdentifier('user@example.com', 'email');
            expect(result.email).toBe('user@example.com');
            expect(result.phone).toBeUndefined();
        });

        it('should extract social handle from social channels', () => {
            const result = extractContactIdentifier('@username', 'twitter');
            expect(result.socialHandle).toBe('username');
        });

        it('should auto-detect format for unknown channels', () => {
            expect(extractContactIdentifier('user@domain.com', 'unknown').email).toBe('user@domain.com');
            expect(extractContactIdentifier('+1234567890', 'unknown').phone).toBe('+1234567890');
            expect(extractContactIdentifier('username', 'unknown').socialHandle).toBe('username');
        });
    });

    describe('validateContactImport', () => {
        it('should validate correct contact data', () => {
            const validData: ContactImportData = {
                name: 'John Doe',
                email: 'john@example.com',
                phone: '+15551234567'
            };

            const result = validateContactImport(validData);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should require at least one identifier', () => {
            const invalidData: ContactImportData = {
                company: 'Acme Corp'
            };

            const result = validateContactImport(invalidData);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('At least one of name, phone, or email is required');
        });

        it('should validate email format', () => {
            const invalidData: ContactImportData = {
                name: 'John Doe',
                email: 'invalid-email'
            };

            const result = validateContactImport(invalidData);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Invalid email format');
        });

        it('should validate phone format', () => {
            const invalidData: ContactImportData = {
                name: 'John Doe',
                phone: '123' // Too short
            };

            const result = validateContactImport(invalidData);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Invalid phone format');
        });

        it('should validate name length', () => {
            const invalidData: ContactImportData = {
                name: 'a'.repeat(300), // Too long
                email: 'john@example.com'
            };

            const result = validateContactImport(invalidData);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Name is too long (max 255 characters)');
        });
    });

    describe('isValidEmail', () => {
        it('should validate correct email formats', () => {
            expect(isValidEmail('user@domain.com')).toBe(true);
            expect(isValidEmail('test.email+tag@example.org')).toBe(true);
            expect(isValidEmail('user123@sub.domain.co.uk')).toBe(true);
        });

        it('should reject invalid email formats', () => {
            expect(isValidEmail('invalid')).toBe(false);
            expect(isValidEmail('user@')).toBe(false);
            expect(isValidEmail('@domain.com')).toBe(false);
            expect(isValidEmail('user@domain')).toBe(false);
        });
    });

    describe('isValidPhone', () => {
        it('should validate correct phone formats', () => {
            expect(isValidPhone('+15551234567')).toBe(true);
            expect(isValidPhone('(555) 123-4567')).toBe(true);
            expect(isValidPhone('555.123.4567')).toBe(true);
            expect(isValidPhone('+44 20 7946 0958')).toBe(true);
        });

        it('should reject invalid phone formats', () => {
            expect(isValidPhone('123')).toBe(false); // Too short
            expect(isValidPhone('12345678901234567890')).toBe(false); // Too long
            expect(isValidPhone('abc')).toBe(false); // No digits
        });
    });

    describe('getContactDisplayName', () => {
        it('should return name if available', () => {
            const contact: UnifiedContact = {
                id: '1',
                name: 'John Doe',
                email: 'john@example.com',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            expect(getContactDisplayName(contact)).toBe('John Doe');
        });

        it('should return email username if no name', () => {
            const contact: UnifiedContact = {
                id: '1',
                email: 'john@example.com',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            expect(getContactDisplayName(contact)).toBe('john');
        });

        it('should return phone if no name or email', () => {
            const contact: UnifiedContact = {
                id: '1',
                phone: '+15551234567',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            expect(getContactDisplayName(contact)).toBe('+15551234567');
        });

        it('should return social handle if no other identifiers', () => {
            const contact: UnifiedContact = {
                id: '1',
                socialHandles: {
                    twitter: '@johndoe'
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };

            expect(getContactDisplayName(contact)).toBe('@johndoe');
        });

        it('should return Unknown Contact as fallback', () => {
            const contact: UnifiedContact = {
                id: '1',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            expect(getContactDisplayName(contact)).toBe('Unknown Contact');
        });
    });

    describe('getContactInitials', () => {
        it('should return initials for full name', () => {
            const contact: UnifiedContact = {
                id: '1',
                name: 'John Doe',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            expect(getContactInitials(contact)).toBe('JD');
        });

        it('should return single initial for single name', () => {
            const contact: UnifiedContact = {
                id: '1',
                name: 'John',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            expect(getContactInitials(contact)).toBe('J');
        });

        it('should return ? for unknown contact', () => {
            const contact: UnifiedContact = {
                id: '1',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            expect(getContactInitials(contact)).toBe('?');
        });

        it('should handle email-based display name', () => {
            const contact: UnifiedContact = {
                id: '1',
                email: 'john@example.com',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            expect(getContactInitials(contact)).toBe('J');
        });
    });

    describe('mergeContactData', () => {
        it('should merge contact data with primary preference', () => {
            const primary: UnifiedContact = {
                id: 'primary',
                name: 'John Doe',
                phone: '+15551234567',
                email: 'john@example.com',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const secondary: UnifiedContact = {
                id: 'secondary',
                name: 'J. Doe',
                phone: '+15559876543',
                email: 'j.doe@example.com',
                socialHandles: {
                    twitter: '@johndoe'
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const merged = mergeContactData(primary, secondary);

            expect(merged.name).toBe('John Doe'); // Primary preference
            expect(merged.phone).toBe('+15551234567'); // Primary preference
            expect(merged.socialHandles?.twitter).toBe('@johndoe'); // Merged from secondary
        });

        it('should use secondary preference when specified', () => {
            const primary: UnifiedContact = {
                id: 'primary',
                name: 'John Doe',
                phone: '+15551234567',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const secondary: UnifiedContact = {
                id: 'secondary',
                name: 'Jonathan Doe',
                phone: '+15559876543',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const preferences = {
                name: 'secondary' as const,
                phone: 'secondary' as const
            };

            const merged = mergeContactData(primary, secondary, preferences);

            expect(merged.name).toBe('Jonathan Doe');
            expect(merged.phone).toBe('+15559876543');
        });

        it('should merge tags when merge preference is specified', () => {
            const primary: UnifiedContact = {
                id: 'primary',
                name: 'John Doe',
                tags: ['customer', 'vip'],
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const secondary: UnifiedContact = {
                id: 'secondary',
                name: 'John Doe',
                tags: ['lead', 'vip'],
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const preferences = {
                tags: 'merge' as const
            };

            const merged = mergeContactData(primary, secondary, preferences);

            expect(merged.tags).toEqual(['customer', 'vip', 'lead']);
        });

        it('should merge metadata correctly', () => {
            const primary: UnifiedContact = {
                id: 'primary',
                name: 'John Doe',
                metadata: {
                    company: 'Acme Corp',
                    tags: ['customer'],
                    customFields: {
                        department: 'Engineering'
                    }
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const secondary: UnifiedContact = {
                id: 'secondary',
                name: 'John Doe',
                metadata: {
                    jobTitle: 'Developer',
                    tags: ['lead'],
                    customFields: {
                        skills: 'JavaScript'
                    }
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const merged = mergeContactData(primary, secondary);

            expect(merged.metadata?.company).toBe('Acme Corp');
            expect(merged.metadata?.jobTitle).toBe('Developer');
            expect(merged.metadata?.tags).toEqual(['customer', 'lead']);
            expect(merged.metadata?.customFields?.department).toBe('Engineering');
            expect(merged.metadata?.customFields?.skills).toBe('JavaScript');
        });
    });
});