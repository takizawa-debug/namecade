/**
 * Core domain types for the NameCard application.
 * Single source of truth for all customer-related data structures.
 */

export interface Customer {
    id: number;
    name: string;
    name_romaji: string;
    company: string;
    department: string;
    role: string;
    email: string;
    phone: string;
    phone_mobile: string;
    fax: string;
    address: string;
    postal_code: string;
    prefecture: string;
    city: string;
    address_line1: string;
    address_line2: string;
    website: string;
    sns_x: string;
    sns_facebook: string;
    sns_instagram: string;
    sns_linkedin: string;
    sns_other: string;
    exchanger: string;
    business_category: string;
    tags: string;
    memo: string;
    image_url: string;
    ai_analysis: string;
    drive_file_id: string;
    added_at: string;
    /** Legacy alias — some API responses use camelCase */
    addedAt?: string;
}

/** Fields that can be set when creating a new customer. */
export type CustomerCreatePayload = Omit<Customer, 'id' | 'added_at' | 'addedAt'> & {
    imageUrl?: string;
    aiAnalysis?: string;
};

/** Fields that can be updated on an existing customer. */
export type CustomerUpdatePayload = Partial<Omit<Customer, 'id'>>;

/** Bulk edit payload for multiple customers. */
export interface BulkEditPayload {
    ids: number[];
    data: {
        business_category?: string;
        tags?: string;
        exchanger?: string;
        added_at?: string;
    };
}

/** Sort configuration for the data table. */
export interface SortConfig {
    key: keyof Customer;
    direction: 'asc' | 'desc';
}

/** Column filter state — column key → filter string. */
export type FilterState = Partial<Record<keyof Customer, string>>;
