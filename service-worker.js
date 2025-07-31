// Service worker for caching and push notifications
// Handles offline functionality and background notifications

const CACHE_NAME = 'wclof-cache-v1';

self.addEventListener('install', event => {
    // Take over immediately when updated
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
    // Start controlling all pages right away
    event.waitUntil(self.clients.claim());
});

// Listen for cache commands from main script
self.addEventListener('message', event => {
    if (event.data.command === 'cache_urls') {
        event.waitUntil(
            caches.open(CACHE_NAME).then(cache => {
                console.log('Service Worker: Caching URLs for offline use');
                return cache.addAll(event.data.urls);
            }).catch(err => console.error("Caching failed:", err))
        );
    }
});

// Handle network requests - serve cached content when offline
self.addEventListener('fetch', event => {
    // Skip WordPress admin requests
    if (event.request.url.includes('/wp-admin/')) return;
    
    event.respondWith(
        caches.match(event.request).then(response => {
            // Return cached version if we have it
            if (response) {
                return response;
            }
            // Otherwise fetch from network
            return fetch(event.request).catch(() => {
                // If network fails, show offline page or cached content
                console.log('Network failed, serving cached content');
            });
        })
    );
});

// Handle push notifications from server
self.addEventListener('push', event => {
    if (!event.data) return;
    
    const data = event.data.json();
    const options = {
        body: data.body,
        icon: data.icon,
        badge: data.icon,
        data: { url: data.url }
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.notification.data && event.notification.data.url) {
        event.waitUntil(
            clients.openWindow(event.notification.data.url)
        );
    }
});
