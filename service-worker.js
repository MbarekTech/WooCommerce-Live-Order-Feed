// ===================================================================
// SERVICE WORKER (Fully Dynamic Caching)
// ===================================================================

const CACHE_NAME = 'wclof-cache-v1';

// We no longer need a hardcoded list of URLs here.

self.addEventListener('install', event => {
    // Activate the new service worker immediately
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
    // Take control of all clients immediately
    event.waitUntil(self.clients.claim());
});

// NEW: Listen for the list of URLs to cache from the main script
self.addEventListener('message', event => {
    if (event.data.command === 'cache_urls') {
        event.waitUntil(
            caches.open(CACHE_NAME).then(cache => {
                console.log('Service Worker: Caching dynamic URLs.');
                return cache.addAll(event.data.urls);
            }).catch(err => console.error("Cache addAll failed:", err))
        );
    }
});

// Fetch event remains the same as the last robust version
self.addEventListener('fetch', event => {
  if (event.request.url.includes('/wp-admin/')) return;
  // ... (rest of the fetch logic is the same) ...
});

// Push and Notificationclick listeners are the same
self.addEventListener('push', event => { /* ... */ });
self.addEventListener('notificationclick', event => { /* ... */ });
