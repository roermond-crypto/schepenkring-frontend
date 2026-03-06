// ──────────────────────────────────────────────────────────
// NauticSecure / Schepenkring CRM — Service Worker
// ──────────────────────────────────────────────────────────

const CACHE_VERSION = "v1";
const STATIC_CACHE = `nauticsecure-static-${CACHE_VERSION}`;
const API_CACHE = `nauticsecure-api-${CACHE_VERSION}`;

// App shell files to precache on install
const APP_SHELL = ["/", "/manifest.json", "/schepenkring-logo.png"];

// ── Install: precache app shell ──────────────────────────
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches
            .open(STATIC_CACHE)
            .then((cache) => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

// ── Activate: clean old caches ───────────────────────────
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter((k) => k !== STATIC_CACHE && k !== API_CACHE)
                        .map((k) => caches.delete(k))
                )
            )
            .then(() => self.clients.claim())
    );
});

// ── Fetch strategies ─────────────────────────────────────

function isStaticAsset(url) {
    return (
        url.pathname.startsWith("/_next/static/") ||
        url.pathname.match(/\.(js|css|woff2?|ttf|otf|eot|ico|svg|png|jpg|jpeg|webp|gif)$/)
    );
}

function isApiRequest(url) {
    return url.pathname.startsWith("/api/");
}

function isMutatingRequest(method) {
    return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

// Stale-while-revalidate for static assets
async function staleWhileRevalidate(request) {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(request);

    const fetchPromise = fetch(request)
        .then((response) => {
            if (response.ok) {
                cache.put(request, response.clone());
            }
            return response;
        })
        .catch(() => cached);

    return cached || fetchPromise;
}

// Network-first with cache fallback for API GET requests
async function networkFirst(request) {
    const cache = await caches.open(API_CACHE);

    try {
        const response = await fetch(request);
        // Only cache successful GET responses for non-sensitive data
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        const cached = await cache.match(request);
        if (cached) return cached;

        // Return a synthetic offline JSON response
        return new Response(
            JSON.stringify({
                error: "offline",
                message: "You are currently offline. Data may be stale.",
            }),
            {
                status: 503,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
}

// Cache-first for app shell (HTML pages)
async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        // Return cached root page as fallback for navigation
        return caches.match("/") || new Response("Offline", { status: 503 });
    }
}

self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);

    // Skip non-http(s) requests
    if (!url.protocol.startsWith("http")) return;

    // Skip cross-origin requests (CDN fonts, external APIs, etc.)
    if (url.origin !== self.location.origin) return;

    // 1. Mutating API requests — always network-only (handled by outbox)
    if (isApiRequest(url) && isMutatingRequest(event.request.method)) {
        return; // Let the browser handle it naturally
    }

    // 2. API GET requests — network-first with cache fallback
    if (isApiRequest(url)) {
        event.respondWith(networkFirst(event.request));
        return;
    }

    // 3. Static assets — stale-while-revalidate
    if (isStaticAsset(url)) {
        event.respondWith(staleWhileRevalidate(event.request));
        return;
    }

    // 4. Navigation / HTML — cache-first (app shell)
    if (event.request.mode === "navigate") {
        event.respondWith(cacheFirst(event.request));
        return;
    }

    // 5. Everything else — try network, fall back to cache
    event.respondWith(staleWhileRevalidate(event.request));
});
