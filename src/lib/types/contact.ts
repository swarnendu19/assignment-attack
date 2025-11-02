import { Contact, Message, Note, Assignment } from '@prisma/client';

// Core contact interface
export interface UnifiedContact {
    id: string;
    name?: string;
    phone?: string;
    email?: string;
    socialHandles?: SocialHandles;
    metadata?: ContactMetadata;
    createdAt: Date;
    updatedAt: Date;

    // Computed fields
    messageCount?: number;
    lastMessageAt?: Date;
    lastInteractionAt?: Date;
    tags?: string[];
}

// Social media handles
export interface SocialHandles {
    twitter?: string;
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    whatsapp?: string;
    telegram?: string;
}

// Contact metadata
export interface ContactMetadata {
    source?: string; // How the contact was acquired
    company?: string;
    jobTitle?: string;
    timezone?: string;
    language?: string;
    customFields?: Record<string, any>;
    tags?: string[];
    priority?: ContactPriority;
    status?: ContactStatus;
}

export type ContactPriority = 'low' | 'normal' | 'high' | 'urgent';
export type ContactStatus = 'active' | 'inactive' | 'blocked' | 'archived';

// Contact creation input
export interface CreateContactInput {
    name?: string;
    phone?: string;
    email?: string;
    socialHandles?: Partial<SocialHandles>;
    metadata?: Partial<ContactMetadata>;
}

// Contact update input
export interface UpdateContactInput {
    name?: string;
    phone?: string;
    email?: string;
    socialHandles?: Partial<SocialHandles>;
    metadata?: Partial<ContactMetadata>;
}

// Contact search and filtering
export interface ContactFilters {
    searchText?: string;
    phone?: string;
    email?: string;
    tags?: string[];
    status?: ContactStatus;
    priority?: ContactPriority;
    source?: string;
    company?: string;
    hasMessages?: boolean;
    lastInteractionFrom?: Date;
    lastInteractionTo?: Date;
    createdFrom?: Date;
    createdTo?: Date;
}

// Contact query options
export interface ContactQueryOptions {
    limit?: number;
    offset?: number;
    orderBy?: 'name' | 'createdAt' | 'updatedAt' | 'lastInteractionAt';
    orderDirection?: 'asc' | 'desc';
    includeMessages?: boolean;
    includeNotes?: boolean;
    includeAssignments?: boolean;
    includeStats?: boolean;
}

// Contact with relations
export interface ContactWithRelations extends UnifiedContact {
    messages?: Message[];
    notes?: Note[];
    assignments?: Assignment[];
}

// Contact interaction history
export interface ContactInteraction {
    id: string;
    type: InteractionType;
    channel?: string;
    content?: string;
    userId?: string;
    userName?: string;
    timestamp: Date;
    metadata?: Record<string, any>;
}

export type InteractionType = 'message_sent' | 'message_received' | 'note_added' | 'contact_updated' | 'assignment_changed';

// Contact merge candidate
export interface ContactMergeCandidate {
    contact: UnifiedContact;
    similarity: number;
    matchingFields: ContactMatchField[];
    confidence: MergeConfidence;
}

export type ContactMatchField = 'name' | 'phone' | 'email' | 'socialHandles';
export type MergeConfidence = 'low' | 'medium' | 'high' | 'exact';

// Contact merge options
export interface ContactMergeOptions {
    primaryContactId: string;
    secondaryContactId: string;
    fieldPreferences?: Partial<Record<ContactMatchField, 'primary' | 'secondary' | 'merge'>>;
    mergeMessages?: boolean;
    mergeNotes?: boolean;
    deleteSecondary?: boolean;
}

// Contact merge result
export interface ContactMergeResult {
    success: boolean;
    mergedContact?: UnifiedContact;
    error?: string;
    warnings?: string[];
    mergedFields: string[];
    conflictResolutions: Record<string, any>;
}

// Contact import/export
export interface ContactImportData {
    name?: string;
    phone?: string;
    email?: string;
    company?: string;
    jobTitle?: string;
    tags?: string[];
    customFields?: Record<string, any>;
}

export interface ContactExportOptions {
    format: 'csv' | 'json' | 'xlsx';
    fields?: string[];
    filters?: ContactFilters;
    includeMessages?: boolean;
    includeNotes?: boolean;
}

export interface ContactImportResult {
    success: boolean;
    imported: number;
    skipped: number;
    errors: ContactImportError[];
    duplicates: ContactMergeCandidate[];
}

export interface ContactImportError {
    row: number;
    data: ContactImportData;
    error: string;
}

// Contact statistics
export interface ContactStats {
    totalContacts: number;
    activeContacts: number;
    newContactsThisMonth: number;
    topSources: Array<{ source: string; count: number }>;
    topCompanies: Array<{ company: string; count: number }>;
    channelDistribution: Array<{ channel: string; count: number }>;
}

// Fuzzy matching configuration
export interface FuzzyMatchConfig {
    nameThreshold: number;
    phoneThreshold: number;
    emailThreshold: number;
    enablePhoneNormalization: boolean;
    enableNameNormalization: boolean;
}

// Contact search result
export interface ContactSearchResult {
    contacts: UnifiedContact[];
    total: number;
    hasMore: boolean;
    facets?: ContactSearchFacets;
}

export interface ContactSearchFacets {
    sources: Array<{ value: string; count: number }>;
    companies: Array<{ value: string; count: number }>;
    tags: Array<{ value: string; count: number }>;
    statuses: Array<{ value: ContactStatus; count: number }>;
}