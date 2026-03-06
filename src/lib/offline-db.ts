"use client";

/**
 * offline-db.ts — IndexedDB abstraction for offline boat storage.
 *
 * Manages a `local_boats` object store so that partners can create
 * boats without an internet connection.  Media blobs are stored via
 * the existing `useImageStore` (DB: nauticsecure_images); this module
 * only keeps lightweight JSON metadata + gallery key references.
 */

// ─── Types ──────────────────────────────────────────────────────

export type BoatSyncStatus =
    | "draft"
    | "ready"
    | "pending_sync"
    | "syncing"
    | "synced"
    | "failed";

export interface LocalBoat {
    id: string; // client-generated UUID
    form_data: Record<string, any>; // all form fields as JSON
    gallery_refs: string[]; // keys into useImageStore
    main_image_ref: string | null; // key into useImageStore for main image
    status: BoatSyncStatus;
    server_id: number | null; // set after successful sync
    error_message: string | null;
    created_at: string; // ISO
    updated_at: string; // ISO
    retry_count: number;
}

// ─── Constants ──────────────────────────────────────────────────

const DB_NAME = "nauticsecure_offline";
const DB_VERSION = 1;
const STORE_NAME = "local_boats";

// ─── Open / upgrade ─────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
                store.createIndex("status", "status", { unique: false });
                store.createIndex("updated_at", "updated_at", { unique: false });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// ─── CRUD helpers ───────────────────────────────────────────────

/** Generate a RFC-4122 v4 UUID */
export function generateUUID(): string {
    return crypto.randomUUID();
}

/** Create a brand-new local boat record */
export async function createLocalBoat(
    id?: string,
): Promise<LocalBoat> {
    const db = await openDB();
    const now = new Date().toISOString();

    const boat: LocalBoat = {
        id: id || generateUUID(),
        form_data: {},
        gallery_refs: [],
        main_image_ref: null,
        status: "draft",
        server_id: null,
        error_message: null,
        created_at: now,
        updated_at: now,
        retry_count: 0,
    };

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(boat);
        tx.oncomplete = () => resolve(boat);
        tx.onerror = () => reject(tx.error);
    });
}

/** Get a single boat by id */
export async function getLocalBoat(
    id: string,
): Promise<LocalBoat | undefined> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).get(id);
        req.onsuccess = () => resolve(req.result as LocalBoat | undefined);
        req.onerror = () => reject(req.error);
    });
}

/** Update an existing boat record (partial merge) */
export async function updateLocalBoat(
    id: string,
    updates: Partial<Omit<LocalBoat, "id">>,
): Promise<LocalBoat> {
    const db = await openDB();
    const existing = await getLocalBoat(id);
    if (!existing) throw new Error(`Local boat ${id} not found`);

    const merged: LocalBoat = {
        ...existing,
        ...updates,
        updated_at: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(merged);
        tx.oncomplete = () => resolve(merged);
        tx.onerror = () => reject(tx.error);
    });
}

/** Delete a local boat */
export async function deleteLocalBoat(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

/** Get all boats, optionally filtered by status(es) */
export async function getLocalBoats(
    statuses?: BoatSyncStatus[],
): Promise<LocalBoat[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();

        req.onsuccess = () => {
            let boats = req.result as LocalBoat[];
            if (statuses && statuses.length > 0) {
                boats = boats.filter((b) => statuses.includes(b.status));
            }
            // Sort by updated_at descending
            boats.sort(
                (a, b) =>
                    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
            );
            resolve(boats);
        };
        req.onerror = () => reject(req.error);
    });
}

/** Count boats by status */
export async function countBoatsByStatus(
    statuses: BoatSyncStatus[],
): Promise<number> {
    const boats = await getLocalBoats(statuses);
    return boats.length;
}

/** Update just the status + optional error info */
export async function updateBoatStatus(
    id: string,
    status: BoatSyncStatus,
    serverId?: number,
    errorMessage?: string,
): Promise<LocalBoat> {
    return updateLocalBoat(id, {
        status,
        server_id: serverId ?? null,
        error_message: errorMessage ?? null,
        retry_count:
            status === "failed"
                ? ((await getLocalBoat(id))?.retry_count ?? 0) + 1
                : (await getLocalBoat(id))?.retry_count ?? 0,
    });
}
