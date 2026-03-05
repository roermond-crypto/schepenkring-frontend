"use client";

/**
 * sync-engine.ts — Background sync service for offline-created boats.
 *
 * Finds all boats with status `pending_sync` or `failed` in IndexedDB,
 * builds a FormData payload (including media from useImageStore), and
 * POSTs to the backend with an X-Offline-ID idempotency header.
 *
 * Auto-triggers on the `online` event and exposes a manual `syncAll`
 * function for the "Retry Sync" button.
 */

import {
    getLocalBoats,
    updateLocalBoat,
    type LocalBoat,
} from "./offline-db";
import { loadImage, loadImagesByPrefix } from "../hooks/useImageStore";
import { api } from "@/lib/api/http";

// ─── Constants ──────────────────────────────────────────────────

const MAX_RETRIES = 5;
const SYNC_LOCK_KEY = "boat_sync_in_progress";

// ─── Listeners (call once at app startup) ───────────────────────

let _listenerRegistered = false;

export function registerSyncListeners() {
    if (typeof window === "undefined" || _listenerRegistered) return;
    _listenerRegistered = true;

    window.addEventListener("online", () => {
        console.log("[SyncEngine] Back online — starting sync…");
        syncAllPendingBoats();
    });

    // Also try to register Background Sync if available
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.ready
            .then((reg) => {
                if ("sync" in reg) {
                    (reg as any).sync.register("sync-boats").catch(() => {
                        // Background Sync API not available, that's fine
                    });
                }
            })
            .catch(() => { });
    }
}

// ─── Core sync function ─────────────────────────────────────────

export type SyncProgressCallback = (synced: number, total: number) => void;

export async function syncAllPendingBoats(
    onProgress?: SyncProgressCallback,
): Promise<{ synced: number; failed: number }> {
    // Prevent concurrent syncs
    if (typeof window !== "undefined" && sessionStorage.getItem(SYNC_LOCK_KEY)) {
        console.log("[SyncEngine] Sync already in progress, skipping.");
        return { synced: 0, failed: 0 };
    }

    try {
        if (typeof window !== "undefined") {
            sessionStorage.setItem(SYNC_LOCK_KEY, "1");
        }

        const boats = await getLocalBoats(["pending_sync", "failed"]);

        // Filter out boats that exceeded max retries
        const eligible = boats.filter((b) => b.retry_count < MAX_RETRIES);

        if (eligible.length === 0) {
            console.log("[SyncEngine] Nothing to sync.");
            return { synced: 0, failed: 0 };
        }

        console.log(`[SyncEngine] Syncing ${eligible.length} boat(s)…`);

        let synced = 0;
        let failed = 0;

        for (const boat of eligible) {
            try {
                await syncSingleBoat(boat);
                synced++;
            } catch {
                failed++;
            }
            onProgress?.(synced, eligible.length);
        }

        console.log(
            `[SyncEngine] Done. Synced: ${synced}, Failed: ${failed}`,
        );

        return { synced, failed };
    } finally {
        if (typeof window !== "undefined") {
            sessionStorage.removeItem(SYNC_LOCK_KEY);
        }
    }
}

// ─── Single boat sync ───────────────────────────────────────────

async function syncSingleBoat(boat: LocalBoat): Promise<void> {
    // Mark as syncing
    await updateLocalBoat(boat.id, { status: "syncing", error_message: null });

    try {
        const formData = new FormData();

        // 1. Append all form_data fields
        const data = boat.form_data || {};
        for (const [key, value] of Object.entries(data)) {
            if (value === null || value === undefined || value === "") continue;

            // JSON-serialise arrays/objects
            if (typeof value === "object") {
                formData.append(key, JSON.stringify(value));
            } else {
                formData.append(key, String(value));
            }
        }

        // 2. Attach main image from IndexedDB
        if (boat.main_image_ref) {
            const mainFile = await loadImage(boat.main_image_ref);
            if (mainFile) {
                formData.append("main_image", mainFile);
            }
        }

        // 3. Send boat creation request with idempotency header
        const res = await api.post("/partner/yachts", formData, {
            headers: { "X-Offline-ID": boat.id },
        });

        const serverId = res.data?.id;

        // 4. Upload gallery images if any
        if (boat.gallery_refs.length > 0) {
            await syncGalleryImages(boat, serverId);
        }

        // 5. Mark as synced
        await updateLocalBoat(boat.id, {
            status: "synced",
            server_id: serverId,
            error_message: null,
        });

        console.log(
            `[SyncEngine] ✓ Boat ${boat.id} synced → server ID ${serverId}`,
        );
    } catch (err: any) {
        const msg =
            err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message ||
            "Unknown sync error";

        await updateLocalBoat(boat.id, {
            status: "failed",
            error_message: msg,
            retry_count: boat.retry_count + 1,
        });

        console.error(`[SyncEngine] ✗ Boat ${boat.id} failed: ${msg}`);
        throw err; // re-throw so the caller counts it as failed
    }
}

// ─── Gallery sync ───────────────────────────────────────────────

async function syncGalleryImages(
    boat: LocalBoat,
    serverId: number,
): Promise<void> {
    // Group gallery refs by category
    // Refs follow the pattern: boat_{uuid}_gallery_{category}_{index}
    const categoryMap: Record<string, string[]> = {};

    for (const ref of boat.gallery_refs) {
        // Extract category from the ref key
        const match = ref.match(/gallery_(.+?)_\d+$/);
        const category = match?.[1] || "General";
        if (!categoryMap[category]) categoryMap[category] = [];
        categoryMap[category].push(ref);
    }

    for (const [category, refs] of Object.entries(categoryMap)) {
        const gData = new FormData();
        let hasFiles = false;

        for (const ref of refs) {
            const file = await loadImage(ref);
            if (file) {
                gData.append("images[]", file);
                hasFiles = true;
            }
        }

        if (hasFiles) {
            gData.append("category", category);
            await api.post(`/partner/yachts/${serverId}/gallery`, gData);
        }
    }
}

// ─── Manual retry for a single boat ─────────────────────────────

export async function retrySingleBoat(boatId: string): Promise<boolean> {
    const boat = (await getLocalBoats()).find((b) => b.id === boatId);
    if (!boat) return false;

    try {
        await syncSingleBoat(boat);
        return true;
    } catch {
        return false;
    }
}
