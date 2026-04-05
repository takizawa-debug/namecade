/**
 * Generic API response types used across the application.
 */

/** Standard API response wrapper. */
export interface ApiResponse<T = unknown> {
    success: boolean;
    error?: string;
    data?: T;
}

/** Customer creation response. */
export interface CustomerCreateResponse {
    success: boolean;
    id?: number;
    duplicate?: boolean;
    message?: string;
}

/** Drive list response. */
export interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    folderName?: string;
}

export interface DriveListResponse {
    success: boolean;
    files: DriveFile[];
    error?: string;
}

/** Drive download response. */
export interface DriveDownloadResponse {
    success: boolean;
    url: string;
    mimeType: string;
    error?: string;
}

/** Parse (Gemini AI) response. */
export interface ParseResponse {
    success: boolean;
    data?: Record<string, string>;
    error?: string;
}

/** Scan item from the scans table. */
export interface ScanItem {
    id: number;
    file_name: string;
    image_url: string;
    status: 'pending' | 'completed' | 'error';
    customer_id?: number;
    created_at: string;
}

/** Merge duplicates response. */
export interface MergeDuplicatesResponse {
    success: boolean;
    mergedCount: number;
    deletedCount: number;
    error?: string;
}
