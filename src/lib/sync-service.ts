"use client";

/**
 * sync-service.ts — Outbox processor + data sync engine.
 *
 * Responsibilities:
 *   1. Process queued outbox requests (FIFO) when online
 *   2. Pull latest data from server into IndexedDB cache
 *   3. Periodic sync while online
 *   4. Sentry-style breadcrumb logging
 */

import { api } from "@/lib/api";
import {
    getQueuedOutboxRequests,
    updateOutboxStatus,
    deleteSentOutboxRequests,
    countPendingOutbox,
    type OutboxRequest,
} from "@/lib/offline-db";

// ─── Types ──────────────────────────────────────────────────────

export type SyncStatus = "online" | "offline" | "syncing";

export interface SyncResult {
    processed: number;
    succeeded: number;
    failed: number;
    errors: Array<{ id: string; error: string }>;
}

type SyncEventType =
    | "offline_detected"
    | "online_detected"
    | "message_queued"
    | "sync_started"
    | "sync_item_processing"
    | "sync_item_succeeded"
    | "sync_item_failed"
    | "sync_completed";

interface SyncEvent {
    type: SyncEventType;
    timestamp: string;
    data?: Record<string, unknown>;
}

// ─── Breadcrumb / observability logging ─────────────────────────

const breadcrumbs: SyncEvent[] = [];
const MAX_BREADCRUMBS = 100;

function addBreadcrumb(type: SyncEventType, data?: Record<string, unknown>) {
    const event: SyncEvent = {
        type,
        timestamp: new Date().toISOString(),
        data,
    };
    breadcrumbs.push(event);
    if (breadcrumbs.length > MAX_BREADCRUMBS) {
        breadcrumbs.shift();
    }

    // Log to console for debugging (replace with Sentry SDK when available)
    if (typeof console !== "undefined") {
        const label = `[Sync] ${type}`;
        if (type.includes("failed")) {
            console.warn(label, data);
        } else {
            console.log(label, data);
        }
    }
}

export function getSyncBreadcrumbs(): SyncEvent[] {
    return [...breadcrumbs];
}

// ─── Outbox processing ──────────────────────────────────────────

const MAX_RETRIES = 5;

function getBackoffMs(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s (capped at 30s)
    return Math.min(1000 * Math.pow(2, attempt), 30_000);
}

async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Process all queued outbox requests in FIFO order.
 * Returns a summary of what happened.
 */
export async function processOutbox(): Promise<SyncResult> {
    const queued = await getQueuedOutboxRequests();

    if (queued.length === 0) {
        return { processed: 0, succeeded: 0, failed: 0, errors: [] };
    }

    addBreadcrumb("sync_started", { pendingCount: queued.length });

    const result: SyncResult = {
        processed: queued.length,
        succeeded: 0,
        failed: 0,
        errors: [],
    };

    for (const entry of queued) {
        try {
            // Mark as syncing
            await updateOutboxStatus(entry.id, "syncing");

            addBreadcrumb("sync_item_processing", {
                id: entry.id,
                type: entry.type,
                endpoint: entry.endpoint,
                attempt: entry.attempts + 1,
            });

            // Make the API request
            const response = await api.request({
                url: entry.endpoint,
                method: entry.method,
                data: entry.payload,
                headers: {
                    ...entry.headers,
                    // Add Idempotency-Key for non-GET requests
                    "Idempotency-Key": entry.client_request_id,
                },
            });

            // Success — mark as sent
            await updateOutboxStatus(entry.id, "sent");
            result.succeeded++;

            addBreadcrumb("sync_item_succeeded", {
                id: entry.id,
                type: entry.type,
                statusCode: response.status,
            });
        } catch (error: any) {
            const errorMessage =
                error?.response?.data?.message ||
                error?.message ||
                "Unknown error";

            // Check if we've exceeded max retries
            const currentAttempts = (entry.attempts || 0) + 1;
            if (currentAttempts >= MAX_RETRIES) {
                await updateOutboxStatus(entry.id, "failed", errorMessage);
                result.failed++;
            } else {
                // Reset to queued for retry (attempt count was incremented by updateOutboxStatus)
                await updateOutboxStatus(entry.id, "queued", errorMessage);
            }

            result.errors.push({ id: entry.id, error: errorMessage });

            addBreadcrumb("sync_item_failed", {
                id: entry.id,
                type: entry.type,
                error: errorMessage,
                attempt: currentAttempts,
                willRetry: currentAttempts < MAX_RETRIES,
            });

            // Backoff before next item if this one failed
            if (currentAttempts < MAX_RETRIES) {
                await sleep(getBackoffMs(currentAttempts));
            }
        }
    }

    // Clean up sent entries
    await deleteSentOutboxRequests();

    addBreadcrumb("sync_completed", {
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed,
    });

    return result;
}

// ─── Periodic sync management ───────────────────────────────────

let periodicSyncInterval: ReturnType<typeof setInterval> | null = null;

export function startPeriodicSync(intervalMs: number = 30_000) {
    stopPeriodicSync(); // Clear any existing interval
    periodicSyncInterval = setInterval(async () => {
        if (typeof navigator !== "undefined" && navigator.onLine) {
            const pending = await countPendingOutbox();
            if (pending > 0) {
                await processOutbox();
            }
        }
    }, intervalMs);
}

export function stopPeriodicSync() {
    if (periodicSyncInterval) {
        clearInterval(periodicSyncInterval);
        periodicSyncInterval = null;
    }
}

// ─── Online/Offline event helpers ───────────────────────────────

export function onOnline() {
    addBreadcrumb("online_detected");
    // Immediately process outbox when coming back online
    processOutbox().catch((err) => {
        console.warn("[Sync] Error processing outbox on reconnect:", err);
    });
}

export function onOffline() {
    addBreadcrumb("offline_detected");
}

export function onMessageQueued(type: string, endpoint: string) {
    addBreadcrumb("message_queued", { type, endpoint });
}
