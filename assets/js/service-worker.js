// ===================================================================
// LIVE ORDER FEED - SERVICE WORKER (Plugin Version - Fully Dynamic)
// ===================================================================

const CACHE_NAME = 'live-order-feed-v1';
const urlsToCache = [];

self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('message', event => {
    if (event.data.command === 'cache_urls') {
        const urls = event.data.urls;
        if (urls && Array.isArray(urls)) {
            urlsToCache.length = 0;
            urlsToCache.push(...urls);
            event.waitUntil(preCache());
        }
    }
});

async function preCache() {
    try {
        const cache = await caches.open(CACHE_NAME);
        return cache.addAll(urlsToCache);
    } catch (error) {
        console.error('Failed to cache resources:', error);
    }
}

self.addEventListener('fetch', event => {
    if (event.request.url.includes('/wp-admin/admin-ajax.php')) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request).then(response => {
            if (response) {
                return response;
            }
            return fetch(event.request).catch(() => {
                if (event.request.destination === 'document') {
                    return caches.match('/');
                }
            });
        })
    );
});

self.addEventListener('push', event => {
    if (!event.data) return;

    try {
        const data = event.data.json();
        const options = {
            body: data.body || 'New order received!',
            icon: data.icon || '/assets/images/notification-icon.png',
            badge: data.badge || '/assets/images/notification-badge.png',
            tag: data.tag || 'new-order',
            requireInteraction: true,
            actions: [
                {
                    action: 'view',
                    title: 'View Order',
                    icon: '/assets/images/view-icon.png'
                },
                {
                    action: 'dismiss',
                    title: 'Dismiss',
                    icon: '/assets/images/dismiss-icon.png'
                }
            ],
            data: {
                url: data.url || '/'
            }
        };

        event.waitUntil(
            self.registration.showNotification(data.title || 'New Order', options)
        );
    } catch (error) {
        console.error('Error handling push notification:', error);
        
        const fallbackOptions = {
            body: 'New order received!',
            icon: '/assets/images/notification-icon.png',
            tag: 'new-order-fallback'
        };
        
        event.waitUntil(
            self.registration.showNotification('New Order', fallbackOptions)
        );
    }
});

self.addEventListener('notificationclick', event => {
    event.notification.close();

    if (event.action === 'view') {
        const urlToOpen = event.notification.data?.url || '/';
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
                for (let client of clientList) {
                    if (client.url.includes(urlToOpen) && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
        );
    } else if (event.action === 'dismiss') {
        return;
    } else {
        const urlToOpen = event.notification.data?.url || '/';
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
                for (let client of clientList) {
                    if (client.url.includes(urlToOpen) && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
        );
    }
});

self.addEventListener('notificationclose', event => {
    console.log('Notification closed:', event.notification.tag);
});
