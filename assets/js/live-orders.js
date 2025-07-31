// ===================================================================
// LIVE ORDER FEED - JAVASCRIPT (Plugin Version - Fully Dynamic)
// ===================================================================

jQuery(document).ready(function($) {
    // --- DYNAMIC CONFIGURATION (from PHP) ---
    const POLLING_INTERVAL = 7000;
    const NEW_ORDER_THRESHOLD_SECONDS = 60;
    const NOTIFICATION_SOUND_URL = live_order_ajax_object.notification_sound_url;
    const NOTIFICATION_ICON_URL = live_order_ajax_object.notification_icon_url;

    // --- DOM ELEMENTS & STATE ---
    // ... all the same state variables ...
    
    async function initializeAndStartFeed() {
        // ... (audio unlock and wake lock code is the same) ...

        if ('serviceWorker' in navigator) {
            try {
                // DYNAMIC: Path is now relative to the site root, as it should be.
                const registration = await navigator.serviceWorker.register('/service-worker.js');
                console.log('Service Worker registered.');

                // DYNAMIC: Send the list of URLs to cache to the service worker
                if (navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({
                        command: 'cache_urls',
                        urls: live_order_ajax_object.urls_to_cache
                    });
                }
                
                if (Notification.permission === 'granted') {
                    await subscribeUserToPush(registration);
                }
            } catch (error) { console.error('Service Worker setup failed:', error); }
        }

        if (window.Worker) {
            // DYNAMIC: Path now comes from PHP
            const workerPath = live_order_ajax_object.plugin_assets_url + 'order-worker.js';
            // ... (rest of the worker initialization is the same) ...
        }
        
        // ... (rest of the function is the same) ...
    }

    // ... (all other helper functions are the same) ...
});
