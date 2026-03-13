"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import {
    processOutbox,
    startPeriodicSync,
    stopPeriodicSync,
    onOnline,
    onOffline,
    type SyncStatus,
} from "@/lib/sync-service";
import { countPendingOutbox } from "@/lib/offline-db";

/**
 * useSyncService — React hook wrapping the sync engine.
 *
 * Returns:
 *   syncStatus:    'online' | 'offline' | 'syncing'
 *   pendingCount:  number of outbox items waiting
 *   syncNow:       trigger manual sync
 *   lastSyncAt:    timestamp of last successful sync
 */
export function useSyncService() {
    const { isOnline } = useNetworkStatus();
    // Keep the first client render identical to SSR to avoid hydration mismatches.
    const [syncStatus, setSyncStatus] = useState<SyncStatus>("online");
    const [pendingCount, setPendingCount] = useState(0);
    const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
    const wasOnlineRef = useRef(isOnline);

    // Update pending count
    const refreshPendingCount = useCallback(async () => {
        try {
            const count = await countPendingOutbox();
            setPendingCount(count);
        } catch {
            // IndexedDB might not be available during SSR
        }
    }, []);

    // Manual sync trigger
    const syncNow = useCallback(async () => {
        if (!isOnline) return;

        setSyncStatus("syncing");
        try {
            const result = await processOutbox();
            setLastSyncAt(new Date());
            await refreshPendingCount();

            if (result.failed > 0) {
                console.warn(`[Sync] ${result.failed} items failed to sync`);
            }
        } catch (err) {
            console.warn("[Sync] Manual sync error:", err);
        } finally {
            setSyncStatus(isOnline ? "online" : "offline");
        }
    }, [isOnline, refreshPendingCount]);

    // React to online/offline changes
    useEffect(() => {
        if (isOnline && !wasOnlineRef.current) {
            // Just came back online
            onOnline();
            setSyncStatus("syncing");

            processOutbox()
                .then(() => {
                    setLastSyncAt(new Date());
                    refreshPendingCount();
                })
                .catch(() => { })
                .finally(() => setSyncStatus("online"));
        } else if (!isOnline && wasOnlineRef.current) {
            // Just went offline
            onOffline();
            setSyncStatus("offline");
        } else {
            setSyncStatus(isOnline ? "online" : "offline");
        }

        wasOnlineRef.current = isOnline;
    }, [isOnline, refreshPendingCount]);

    // Start periodic sync + initial sync on mount
    useEffect(() => {
        // Initial pending count
        refreshPendingCount();

        // Initial sync if online
        if (isOnline) {
            processOutbox()
                .then(() => {
                    setLastSyncAt(new Date());
                    refreshPendingCount();
                })
                .catch(() => { });
        }

        // Start periodic sync (every 30 seconds)
        startPeriodicSync(30_000);

        // Refresh pending count every 10 seconds
        const countInterval = setInterval(refreshPendingCount, 10_000);

        return () => {
            stopPeriodicSync();
            clearInterval(countInterval);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        syncStatus,
        pendingCount,
        syncNow,
        lastSyncAt,
        isOnline,
    };
}
