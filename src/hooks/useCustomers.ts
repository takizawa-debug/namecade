/**
 * Custom hook for customer data management.
 * Centralizes fetch, create, update, delete logic used by Dashboard and CustomerDetail.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { customersApi } from '../lib/api';
import type { Customer, SortConfig, FilterState } from '../types/customer';

interface UseCustomersOptions {
    /** Trigger re-fetch when this value changes (e.g. latestProcessedTime). */
    refreshTrigger?: number;
}

export function useCustomers(options: UseCustomersOptions = {}) {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchCustomers = useCallback(() => {
        setLoading(true);
        customersApi.getAll()
            .then(data => setCustomers(Array.isArray(data) ? data : []))
            .catch(err => console.error('Failed to fetch customers:', err))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { fetchCustomers(); }, [fetchCustomers, options.refreshTrigger]);

    const exchangerOptions = useMemo(() =>
        Array.from(new Set(customers.map(c => c.exchanger).filter(Boolean)))
    , [customers]);

    const deleteCustomer = useCallback(async (id: number) => {
        await customersApi.delete(id);
        fetchCustomers();
    }, [fetchCustomers]);

    const updateCustomer = useCallback(async (id: number, data: Partial<Customer>) => {
        await customersApi.update(id, data);
        fetchCustomers();
    }, [fetchCustomers]);

    return {
        customers,
        loading,
        setLoading,
        fetchCustomers,
        exchangerOptions,
        deleteCustomer,
        updateCustomer,
    };
}

/**
 * Client-side filtering & sorting pipeline.
 */
export function useFilteredCustomers(
    customers: Customer[],
    searchTerm: string,
    filters: FilterState,
    showDuplicatesOnly: boolean,
    sortConfig: SortConfig | null,
) {
    return useMemo(() => {
        let result = customers.filter(c =>
            (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.company || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.email || '').toLowerCase().includes(searchTerm.toLowerCase())
        );

        // Column filters
        for (const [key, value] of Object.entries(filters)) {
            if (value) {
                result = result.filter(c => {
                    const val = c[key as keyof Customer];
                    return (val || '').toString().toLowerCase().includes(value.toLowerCase());
                });
            }
        }

        // Duplicate detection
        if (showDuplicatesOnly) {
            const dups = new Set<number>();
            for (let i = 0; i < result.length; i++) {
                for (let j = i + 1; j < result.length; j++) {
                    const a = result[i], b = result[j];
                    const nameMatch = a.name && b.name && a.name === b.name;
                    const romajiMatch = a.name_romaji && b.name_romaji && a.name_romaji === b.name_romaji;
                    const companyMatch = a.company && b.company && a.company === b.company;
                    if ((nameMatch || romajiMatch) && companyMatch) { dups.add(a.id); dups.add(b.id); }
                }
            }
            result = result.filter(c => dups.has(c.id));
        }

        // Sort
        if (sortConfig) {
            result.sort((a, b) => {
                const valA = (a[sortConfig.key] || '').toString().toLowerCase();
                const valB = (b[sortConfig.key] || '').toString().toLowerCase();
                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [customers, searchTerm, filters, showDuplicatesOnly, sortConfig]);
}
