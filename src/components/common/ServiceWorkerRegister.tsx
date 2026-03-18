"use client";

import { useEffect } from "react";

/**
 * ServiceWorkerRegister — Registers the service worker on mount.
 * Place this component once in the root layout.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const registerServiceWorker = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          console.log("[SW] Registered:", registration.scope);
        })
        .catch((registrationError) => {
          console.warn("[SW] Registration failed:", registrationError);
        });
    };

    if (document.readyState === "complete") {
      registerServiceWorker();
      return;
    }

    window.addEventListener("load", registerServiceWorker);
    return () => window.removeEventListener("load", registerServiceWorker);
  }, []);

  return null;
}
