// Super Schema service worker — minimum needed to satisfy installability
// criteria and serve a basic offline shell. Bumps cache key on every deploy.

const CACHE_VERSION = "v2";
const STATIC_CACHE = `super-schema-static-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  "/",
  "/loading.svg",
  "/logo.svg",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("super-schema-") && k !== STATIC_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Don't intercept anything off-origin, anything in API/auth, or anything
  // that's part of a navigation flow we shouldn't touch (sign-in, sign-up,
  // OAuth callbacks).
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/_next/data")) return;
  if (url.pathname.startsWith("/sign-in")) return;
  if (url.pathname.startsWith("/sign-up")) return;

  // Network-first for HTML navigations so we always serve fresh app shell
  // when online; fall back to cached "/" for offline.
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r ?? caches.match("/")))
    );
    return;
  }

  // Cache-first for same-origin static assets.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".woff") ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ??
          fetch(req).then((res) => {
            const copy = res.clone();
            caches
              .open(STATIC_CACHE)
              .then((c) => c.put(req, copy))
              .catch(() => {});
            return res;
          })
      )
    );
  }
});
