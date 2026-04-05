/**
 * Safe accessor hook for SyncContext.
 * Eliminates the need for null-checks at every call site.
 */

import { useContext } from 'react';
import { SyncContext } from '../contexts/SyncContext';

export function useSync() {
    const ctx = useContext(SyncContext);
    if (!ctx) {
        // Provide safe defaults when used outside SyncProvider (shouldn't happen in production)
        return {
            syncing: false,
            showSyncPanel: false,
            logs: [] as never[],
            progressStats: { total: 0, current: 0 },
            latestProcessedTime: Date.now(),
            handleDriveSync: () => {},
            handleForceReset: () => {},
            setShowSyncPanel: (_: boolean) => {},
        };
    }
    return ctx;
}
