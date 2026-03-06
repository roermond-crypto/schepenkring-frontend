"use client";

import { useEffect } from "react";

/**
 * ServiceWorkerRegister — Registers the service worker on mount.
 * Place this component once in the root layout.
 */
export function ServiceWorkerRegister() {
    useEffect(() => {
        if (
            typeof window === "undefined" ||
            !("serviceWorker" in navigator) ||
            process.env.NODE_ENV === "development"
        ) {
            return;
        }

        navigator.serviceWorker
            .register("/sw.js", { scope: "/" })
            .then((registration) => {
                console.log("[SW] Registered:", registration.scope);

                // Check for updates periodically (every 60 minutes)
                setInterval(() => {
                    registration.update();
                }, 60 * 60 * 1000);
            })
            .catch((err) => {
                console.warn("[SW] Registration failed:", err);
            });
    }, []);

    return null;
}
