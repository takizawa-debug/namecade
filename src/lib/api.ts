/**
 * Centralized API client for the NameCard application.
 * All HTTP calls go through this module for consistent error handling,
 * type safety, and easy extensibility (e.g., adding auth headers later).
 */

import type { Customer, CustomerUpdatePayload, BulkEditPayload } from '../types/customer';
import type {
    CustomerCreateResponse,
    DriveListResponse,
    DriveDownloadResponse,
    ParseResponse,
    MergeDuplicatesResponse,
} from '../types/api';

// ─── Base helpers ──────────────────────────────────────────────────────────

class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, options);
    if (!res.ok) {
        const text = await res.text().catch(() => 'Unknown error');
        throw new ApiError(res.status, text);
    }
    return res.json() as Promise<T>;
}

function post<T>(url: string, body: unknown): Promise<T> {
    return request<T>(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

function put<T>(url: string, body: unknown): Promise<T> {
    return request<T>(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

function del<T>(url: string): Promise<T> {
    return request<T>(url, { method: 'DELETE' });
}

// ─── Customers API ─────────────────────────────────────────────────────────

export const customersApi = {
    getAll: () => request<Customer[]>('/api/customers'),

    getById: (id: number) => request<Customer>(`/api/customers/${id}`),

    create: (data: Record<string, unknown>) => post<CustomerCreateResponse>('/api/customers', data),

    update: (id: number, data: CustomerUpdatePayload) => put<{ success: boolean }>(`/api/customers/${id}`, data),

    delete: (id: number) => del<{ success: boolean }>(`/api/customers/${id}`),

    bulkUpdate: (payload: BulkEditPayload) => put<{ success: boolean }>('/api/customers/bulk', payload),

    mergeDuplicates: () => post<MergeDuplicatesResponse>('/api/customers/merge-duplicates', {}),
};

// ─── Drive API ─────────────────────────────────────────────────────────────

export const driveApi = {
    list: () => request<DriveListResponse>('/api/drive/list'),

    download: (fileId: string, fileName: string, mimeType: string) =>
        post<DriveDownloadResponse>('/api/drive/download', { fileId, fileName, mimeType }),

    move: (fileId: string, newName: string) =>
        post<{ success: boolean; error?: string }>('/api/drive/move', { fileId, newName }),

    claim: (fileId: string) =>
        post<{ success: boolean; claimed: boolean }>('/api/drive/claim', { fileId }),

    releaseClaim: (fileId: string) =>
        del<{ success: boolean }>(`/api/drive/claim?fileId=${fileId}`),

    releaseAllClaims: () =>
        del<{ success: boolean }>('/api/drive/claim?fileId=all'),
};

// ─── Parse API ─────────────────────────────────────────────────────────────

export const parseApi = {
    parse: (prompt: string, base64Data: string, mimeType: string) =>
        post<ParseResponse>('/api/parse', { prompt, base64Data, mimeType }),
};

export { ApiError };
