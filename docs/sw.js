// Service Worker for Finance & Utang Tracker (Offline-First PWA)
const CACHE_NAME = "finance-tracker-v0.9.1";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./styles/app.css?v=0.9.1",
  "./shared/domain.js?v=0.9.1",
  "./shared/application.js?v=0.9.1",
  "./client/helpers.js?v=0.9.1",
  "./client/state.js?v=0.9.1",
  "./client/status.js?v=0.9.1",
  "./client/canvas-orbs.js?v=0.9.1",
  "./client/canvas-background.js?v=0.9.1",
  "./client/analytics.js?v=0.9.1",
  "./client/calendar.js?v=0.9.1",
  "./client/transactions.js?v=0.9.1",
  "./client/debts.js?v=0.9.1",
  "./client/stashes.js?v=0.9.1",
  "./client/presets.js?v=0.9.1",
  "./client/sync.js?v=0.9.1",
  "./client/event-listeners.js?v=0.9.1",
  "./client/ui-render.js?v=0.9.1",
  "./client/edit-modal.js?v=0.9.1",
  "./client/audit.js?v=0.9.1",
  "./client/bootstrap.js?v=0.9.1",
  "./popup.js?v=0.9.1",
  "./google_sync.js?v=0.9.1",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon16.png",
  "./icons/icon48.png",
  "./icons/icon128.png"
];

// Install: pre-cache static assets for 100% offline access
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up older caches immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Stale-While-Revalidate for app assets, bypass for Google APIs
self.addEventListener("fetch", (event) => {
  // Only handle GET requests within same origin
  if (event.request.method !== "GET") return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Offline and resource not in cache
        if (event.request.headers.get("accept")?.includes("text/html")) {
          return caches.match("./index.html");
        }
      });

      // Return cached asset immediately if found, otherwise wait for network
      return cachedResponse || fetchPromise;
    })
  );
});
