"use client";

/**
 * offline-db.ts — IndexedDB abstraction for offline storage.
 *
 * Stores:
 *   local_boats      — partner boat drafts (existing)
 *   conversations     — cached conversation list
 *   messages          — cached messages per conversation
 *   leads             — cached leads
 *   employees         — minimal employee records for UI
 *   widget_config     — widget settings for offline widget
 *   outbox_requests   — queued mutations for sync when online
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
    id: string;
    form_data: Record<string, any>;
    gallery_refs: string[];
    main_image_ref: string | null;
    status: BoatSyncStatus;
    server_id: number | null;
    error_message: string | null;
    created_at: string;
    updated_at: string;
    retry_count: number;
}

export interface CachedConversation {
    id: string;
    status: string;
    source: string;
    contact_name: string;
    contact_avatar?: string;
    contact_company?: string;
    assigned_to?: string;
    assigned_name?: string;
    last_message?: string;
    last_message_at?: string;
    unread_count: number;
    created_at: string;
    updated_at: string;
    [key: string]: any;
}

export interface CachedMessage {
    id: string;
    conversation_id: string;
    sender_type: string;
    sender_name: string;
    sender_avatar?: string;
    text: string;
    client_message_id?: string;
    delivery_state: "sent" | "queued" | "failed";
    server_message_id?: string;
    created_at: string;
    [key: string]: any;
}

export interface CachedLead {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    status?: string;
    notes?: string;
    updated_at: string;
    [key: string]: any;
}

export interface CachedEmployee {
    id: string;
    name: string;
    email?: string;
    avatar?: string;
    role?: string;
}

export interface CachedWidgetConfig {
    id: string;
    config: Record<string, any>;
    updated_at: string;
}

export type OutboxStatus = "queued" | "syncing" | "sent" | "failed";

export interface OutboxRequest {
    id: string;
    type: string; // SEND_MESSAGE, UPDATE_LEAD, ASSIGN_CONVERSATION, etc.
    endpoint: string;
    method: "POST" | "PUT" | "PATCH" | "DELETE";
    headers: Record<string, string>;
    payload: Record<string, any>;
    client_request_id: string;
    created_at: string;
    attempts: number;
    last_error: string | null;
    status: OutboxStatus;
}

// ─── Constants ──────────────────────────────────────────────────

const DB_NAME = "nauticsecure_offline";
const DB_VERSION = 2;

const STORES = {
    LOCAL_BOATS: "local_boats",
    CONVERSATIONS: "conversations",
    MESSAGES: "messages",
    LEADS: "leads",
    EMPLOYEES: "employees",
    WIDGET_CONFIG: "widget_config",
    OUTBOX: "outbox_requests",
} as const;

// ─── Open / upgrade ─────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = request.result;
            const oldVersion = event.oldVersion;

            // V1: local_boats
            if (oldVersion < 1) {
                if (!db.objectStoreNames.contains(STORES.LOCAL_BOATS)) {
                    const store = db.createObjectStore(STORES.LOCAL_BOATS, { keyPath: "id" });
                    store.createIndex("status", "status", { unique: false });
                    store.createIndex("updated_at", "updated_at", { unique: false });
                }
            }

            // V2: conversations, messages, leads, employees, widget_config, outbox
            if (oldVersion < 2) {
                if (!db.objectStoreNames.contains(STORES.CONVERSATIONS)) {
                    const s = db.createObjectStore(STORES.CONVERSATIONS, { keyPath: "id" });
                    s.createIndex("status", "status", { unique: false });
                    s.createIndex("updated_at", "updated_at", { unique: false });
                }

                if (!db.objectStoreNames.contains(STORES.MESSAGES)) {
                    const s = db.createObjectStore(STORES.MESSAGES, { keyPath: "id" });
                    s.createIndex("conversation_id", "conversation_id", { unique: false });
                    s.createIndex("created_at", "created_at", { unique: false });
                    s.createIndex("client_message_id", "client_message_id", { unique: false });
                }

                if (!db.objectStoreNames.contains(STORES.LEADS)) {
                    const s = db.createObjectStore(STORES.LEADS, { keyPath: "id" });
                    s.createIndex("updated_at", "updated_at", { unique: false });
                }

                if (!db.objectStoreNames.contains(STORES.EMPLOYEES)) {
                    db.createObjectStore(STORES.EMPLOYEES, { keyPath: "id" });
                }

                if (!db.objectStoreNames.contains(STORES.WIDGET_CONFIG)) {
                    db.createObjectStore(STORES.WIDGET_CONFIG, { keyPath: "id" });
                }

                if (!db.objectStoreNames.contains(STORES.OUTBOX)) {
                    const s = db.createObjectStore(STORES.OUTBOX, { keyPath: "id" });
                    s.createIndex("status", "status", { unique: false });
                    s.createIndex("created_at", "created_at", { unique: false });
                    s.createIndex("type", "type", { unique: false });
                }
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// ─── Generic helpers ────────────────────────────────────────────

export function generateUUID(): string {
    return crypto.randomUUID();
}

async function putRecord<T>(storeName: string, record: T): Promise<T> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).put(record);
        tx.oncomplete = () => resolve(record);
        tx.onerror = () => reject(tx.error);
    });
}

async function getRecord<T>(storeName: string, id: string): Promise<T | undefined> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const req = tx.objectStore(storeName).get(id);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
    });
}

async function getAllRecords<T>(storeName: string): Promise<T[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result as T[]);
        req.onerror = () => reject(req.error);
    });
}

async function deleteRecord(storeName: string, id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function clearStore(storeName: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function getByIndex<T>(
    storeName: string,
    indexName: string,
    value: IDBValidKey,
): Promise<T[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const index = tx.objectStore(storeName).index(indexName);
        const req = index.getAll(value);
        req.onsuccess = () => resolve(req.result as T[]);
        req.onerror = () => reject(req.error);
    });
}

// ─── Local Boats (preserved from V1) ───────────────────────────

export async function createLocalBoat(id?: string): Promise<LocalBoat> {
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
    return putRecord(STORES.LOCAL_BOATS, boat);
}

export async function getLocalBoat(id: string): Promise<LocalBoat | undefined> {
    return getRecord<LocalBoat>(STORES.LOCAL_BOATS, id);
}

export async function updateLocalBoat(
    id: string,
    updates: Partial<Omit<LocalBoat, "id">>,
): Promise<LocalBoat> {
    const existing = await getLocalBoat(id);
    if (!existing) throw new Error(`Local boat ${id} not found`);
    const merged: LocalBoat = {
        ...existing,
        ...updates,
        updated_at: new Date().toISOString(),
    };
    return putRecord(STORES.LOCAL_BOATS, merged);
}

export async function deleteLocalBoat(id: string): Promise<void> {
    return deleteRecord(STORES.LOCAL_BOATS, id);
}

export async function getLocalBoats(statuses?: BoatSyncStatus[]): Promise<LocalBoat[]> {
    let boats = await getAllRecords<LocalBoat>(STORES.LOCAL_BOATS);
    if (statuses && statuses.length > 0) {
        boats = boats.filter((b) => statuses.includes(b.status));
    }
    boats.sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
    return boats;
}

export async function countBoatsByStatus(statuses: BoatSyncStatus[]): Promise<number> {
    const boats = await getLocalBoats(statuses);
    return boats.length;
}

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

// ─── Conversations ──────────────────────────────────────────────

export async function cacheConversation(conv: CachedConversation): Promise<CachedConversation> {
    return putRecord(STORES.CONVERSATIONS, conv);
}

export async function cacheConversations(convs: CachedConversation[]): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.CONVERSATIONS, "readwrite");
        const store = tx.objectStore(STORES.CONVERSATIONS);
        for (const conv of convs) {
            store.put(conv);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function getCachedConversation(id: string): Promise<CachedConversation | undefined> {
    return getRecord<CachedConversation>(STORES.CONVERSATIONS, id);
}

export async function getCachedConversations(): Promise<CachedConversation[]> {
    const convs = await getAllRecords<CachedConversation>(STORES.CONVERSATIONS);
    convs.sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
    return convs;
}

export async function clearCachedConversations(): Promise<void> {
    return clearStore(STORES.CONVERSATIONS);
}

// ─── Messages ───────────────────────────────────────────────────

export async function cacheMessage(msg: CachedMessage): Promise<CachedMessage> {
    return putRecord(STORES.MESSAGES, msg);
}

export async function cacheMessages(msgs: CachedMessage[]): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.MESSAGES, "readwrite");
        const store = tx.objectStore(STORES.MESSAGES);
        for (const msg of msgs) {
            store.put(msg);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function getCachedMessages(conversationId: string): Promise<CachedMessage[]> {
    const msgs = await getByIndex<CachedMessage>(STORES.MESSAGES, "conversation_id", conversationId);
    msgs.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    return msgs;
}

export async function updateMessageDeliveryState(
    id: string,
    deliveryState: CachedMessage["delivery_state"],
    serverMessageId?: string,
): Promise<CachedMessage> {
    const existing = await getRecord<CachedMessage>(STORES.MESSAGES, id);
    if (!existing) throw new Error(`Cached message ${id} not found`);
    const updated: CachedMessage = {
        ...existing,
        delivery_state: deliveryState,
        server_message_id: serverMessageId ?? existing.server_message_id,
    };
    return putRecord(STORES.MESSAGES, updated);
}

export async function clearCachedMessages(): Promise<void> {
    return clearStore(STORES.MESSAGES);
}

// ─── Leads ──────────────────────────────────────────────────────

export async function cacheLead(lead: CachedLead): Promise<CachedLead> {
    return putRecord(STORES.LEADS, lead);
}

export async function cacheLeads(leads: CachedLead[]): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.LEADS, "readwrite");
        const store = tx.objectStore(STORES.LEADS);
        for (const lead of leads) {
            store.put(lead);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function getCachedLead(id: string): Promise<CachedLead | undefined> {
    return getRecord<CachedLead>(STORES.LEADS, id);
}

export async function getCachedLeads(): Promise<CachedLead[]> {
    const leads = await getAllRecords<CachedLead>(STORES.LEADS);
    leads.sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
    return leads;
}

export async function clearCachedLeads(): Promise<void> {
    return clearStore(STORES.LEADS);
}

// ─── Employees ──────────────────────────────────────────────────

export async function cacheEmployee(emp: CachedEmployee): Promise<CachedEmployee> {
    return putRecord(STORES.EMPLOYEES, emp);
}

export async function cacheEmployees(emps: CachedEmployee[]): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.EMPLOYEES, "readwrite");
        const store = tx.objectStore(STORES.EMPLOYEES);
        for (const emp of emps) {
            store.put(emp);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function getCachedEmployees(): Promise<CachedEmployee[]> {
    return getAllRecords<CachedEmployee>(STORES.EMPLOYEES);
}

// ─── Widget Config ──────────────────────────────────────────────

export async function cacheWidgetConfig(config: CachedWidgetConfig): Promise<CachedWidgetConfig> {
    return putRecord(STORES.WIDGET_CONFIG, config);
}

export async function getCachedWidgetConfig(id: string): Promise<CachedWidgetConfig | undefined> {
    return getRecord<CachedWidgetConfig>(STORES.WIDGET_CONFIG, id);
}

// ─── Outbox Queue ───────────────────────────────────────────────

export async function createOutboxRequest(
    params: Omit<OutboxRequest, "id" | "created_at" | "attempts" | "last_error" | "status">,
): Promise<OutboxRequest> {
    const entry: OutboxRequest = {
        ...params,
        id: generateUUID(),
        created_at: new Date().toISOString(),
        attempts: 0,
        last_error: null,
        status: "queued",
    };
    return putRecord(STORES.OUTBOX, entry);
}

export async function getOutboxRequest(id: string): Promise<OutboxRequest | undefined> {
    return getRecord<OutboxRequest>(STORES.OUTBOX, id);
}

export async function getQueuedOutboxRequests(): Promise<OutboxRequest[]> {
    const all = await getByIndex<OutboxRequest>(STORES.OUTBOX, "status", "queued");
    // FIFO: sort by created_at ascending
    all.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    return all;
}

export async function getFailedOutboxRequests(): Promise<OutboxRequest[]> {
    return getByIndex<OutboxRequest>(STORES.OUTBOX, "status", "failed");
}

export async function getAllOutboxRequests(): Promise<OutboxRequest[]> {
    const all = await getAllRecords<OutboxRequest>(STORES.OUTBOX);
    all.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    return all;
}

export async function updateOutboxStatus(
    id: string,
    status: OutboxStatus,
    error?: string,
): Promise<OutboxRequest> {
    const existing = await getOutboxRequest(id);
    if (!existing) throw new Error(`Outbox request ${id} not found`);
    const updated: OutboxRequest = {
        ...existing,
        status,
        last_error: error ?? existing.last_error,
        attempts: status === "syncing" ? existing.attempts + 1 : existing.attempts,
    };
    return putRecord(STORES.OUTBOX, updated);
}

export async function deleteOutboxRequest(id: string): Promise<void> {
    return deleteRecord(STORES.OUTBOX, id);
}

export async function deleteSentOutboxRequests(): Promise<void> {
    const all = await getByIndex<OutboxRequest>(STORES.OUTBOX, "status", "sent");
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.OUTBOX, "readwrite");
        const store = tx.objectStore(STORES.OUTBOX);
        for (const entry of all) {
            store.delete(entry.id);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function countPendingOutbox(): Promise<number> {
    const queued = await getQueuedOutboxRequests();
    const db = await openDB();
    const syncing = await new Promise<OutboxRequest[]>((resolve, reject) => {
        const tx = db.transaction(STORES.OUTBOX, "readonly");
        const index = tx.objectStore(STORES.OUTBOX).index("status");
        const req = index.getAll("syncing");
        req.onsuccess = () => resolve(req.result as OutboxRequest[]);
        req.onerror = () => reject(req.error);
    });
    return queued.length + syncing.length;
}

