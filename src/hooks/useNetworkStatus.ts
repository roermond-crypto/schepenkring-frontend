"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * useNetworkStatus — Reactive hook for online/offline detection.
 *
 * Returns `isOnline` boolean that updates in real-time when the
 * browser goes offline or comes back online.
 */
export function useNetworkStatus() {
    const [isOnline, setIsOnline] = useState<boolean>(
        typeof navigator !== "undefined" ? navigator.onLine : true,
    );

    const handleOnline = useCallback(() => setIsOnline(true), []);
    const handleOffline = useCallback(() => setIsOnline(false), []);

    useEffect(() => {
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        // Sync initial state in case it changed between SSR and hydration
        setIsOnline(navigator.onLine);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, [handleOnline, handleOffline]);

    return { isOnline };
}
