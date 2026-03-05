"use client";

/**
 * useImageStore — IndexedDB hook for storing image File blobs offline.
 *
 * localStorage can't hold binary data efficiently, so we use IndexedDB
 * to persist uploaded images across sessions and offline states.
 *
 * Key format: yacht_{id}_main, yacht_{id}_gallery_{category}_{index}
 */

const DB_NAME = "nauticsecure_images";
const DB_VERSION = 1;
const STORE_NAME = "images";

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function storeImage(key: string, file: File): Promise<void> {
    // 1. Read file asynchronously first to avoid IndexedDB transaction timeout
    const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
    });

    // 2. Open DB and start transaction
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);

        store.put(
            {
                data: arrayBuffer,
                name: file.name,
                type: file.type,
                lastModified: file.lastModified,
            },
            key
        );

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function loadImage(key: string): Promise<File | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => {
            const result = request.result;
            if (!result) {
                resolve(null);
                return;
            }
            const file = new File([result.data], result.name, {
                type: result.type,
                lastModified: result.lastModified,
            });
            resolve(file);
        };
        request.onerror = () => reject(request.error);
    });
}

export async function deleteImage(key: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function deleteImagesByPrefix(prefix: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const request = store.openCursor();
        request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) {
                if (typeof cursor.key === "string" && cursor.key.startsWith(prefix)) {
                    cursor.delete();
                }
                cursor.continue();
            }
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function loadImagesByPrefix(
    prefix: string
): Promise<{ key: string; file: File }[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const request = store.openCursor();
        const results: { key: string; file: File }[] = [];

        request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) {
                if (typeof cursor.key === "string" && cursor.key.startsWith(prefix)) {
                    const val = cursor.value;
                    const file = new File([val.data], val.name, {
                        type: val.type,
                        lastModified: val.lastModified,
                    });
                    results.push({ key: cursor.key as string, file });
                }
                cursor.continue();
            }
        };
        tx.oncomplete = () => resolve(results);
        tx.onerror = () => reject(tx.error);
    });
}
