"use client";

import { useSyncExternalStore } from "react";

function subscribe(onStoreChange: () => void) {
    window.addEventListener("online", onStoreChange);
    window.addEventListener("offline", onStoreChange);

    return () => {
        window.removeEventListener("online", onStoreChange);
        window.removeEventListener("offline", onStoreChange);
    };
}

function getSnapshot() {
    return navigator.onLine;
}

function getServerSnapshot() {
    return true;
}

/**
 * useNetworkStatus — Reactive hook for online/offline detection.
 *
 * Uses useSyncExternalStore so the first client render stays consistent with SSR
 * and React can subscribe to browser online/offline events safely.
 */
export function useNetworkStatus() {
    const isOnline = useSyncExternalStore(
        subscribe,
        getSnapshot,
        getServerSnapshot,
    );

    return { isOnline };
}
