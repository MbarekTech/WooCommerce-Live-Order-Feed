// ===================================================================
// LIVE ORDER FEED - JAVASCRIPT (Plugin Version - Fully Dynamic)
// ===================================================================

jQuery(document).ready(function($) {
    // --- DYNAMIC CONFIGURATION (from PHP) ---
    const POLLING_INTERVAL = 7000;
    const NEW_ORDER_THRESHOLD_SECONDS = 60;
    const NOTIFICATION_SOUND_URL = live_order_ajax_object.notification_sound_url;
    const NOTIFICATION_ICON_URL = live_order_ajax_object.notification_icon_url;

    // --- DOM ELEMENTS ---
    const feedContainer = $('#live-order-feed-container');
    const startButton = $('#start-feed-btn');
    const overlay = $('#start-feed-overlay');
    const topNav = $('#live-feed-top-nav');
    const wrapper = $('#live-feed-wrapper');
    const notificationToggle = $('#notification-toggle');
    const dailyIncomeTotalSpan = $('#daily-income-total');
    const permissionStatusDiv = $('#permission-status');
    
    // --- STATE ---
    let knownOrderIds = new Set();
    let isFirstLoad = true;
    let notificationSound = null;
    let wakeLock = null;
    let orderWorker = null;
    let isAudioUnlocked = false;

    // --- MAIN INITIALIZATION (Triggered by button click) ---
    async function initializeAndStartFeed() {
        if (!isAudioUnlocked) {
            try {
                notificationSound = new Audio(NOTIFICATION_SOUND_URL);
                await notificationSound.play();
                notificationSound.pause();
                notificationSound.currentTime = 0;
                isAudioUnlocked = true;
                console.log("Audio context unlocked.");
            } catch (err) { console.error("Audio context could not be unlocked:", err); }
        }

        if ('wakeLock' in navigator && !wakeLock) {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                permissionStatusDiv.text('Feed Active').addClass('status-ok');
            } catch (err) { console.error("Could not acquire Wake Lock:", err); }
        }

        await checkAndRequestPermissions();

        if ('serviceWorker' in navigator) {
            try {
                // The service worker MUST be in the root to control the site scope.
                const registration = await navigator.serviceWorker.register('/service-worker.js');
                console.log('Service Worker registered with scope:', registration.scope);

                // Send the dynamic list of URLs to the service worker to cache
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
            const workerPath = live_order_ajax_object.plugin_assets_url + 'order-worker.js';
            if (!orderWorker) {
                try {
                    orderWorker = new Worker(workerPath);
                    orderWorker.onmessage = (e) => {
                        const { success, payload } = e.data;
                        if (success) handleNewData(payload);
                    };
                    orderWorker.onerror = (e) => console.error(`Error in Order Worker: ${e.message}`);
                } catch (e) { console.error("Failed to create Order Worker. Check path:", workerPath, e); return; }
            }
            orderWorker.postMessage({
                command: 'start',
                ajaxUrl: live_order_ajax_object.ajax_url,
                nonce: live_order_ajax_object.nonce,
                interval: POLLING_INTERVAL
            });
        }
        
        overlay.fadeOut();
        setTimeout(() => { topNav.addClass('hidden'); wrapper.addClass('nav-hidden'); }, 10000);
    }
    
    async function checkAndRequestPermissions() {
        if (!('Notification' in window)) { permissionStatusDiv.text('Notifications Not Supported').addClass('status-error'); return; }
        let permission = Notification.permission;
        if (permission === 'default') {
            permissionStatusDiv.text('Requesting Permission...').addClass('status-warning');
            permission = await Notification.requestPermission();
        }
        if (permission === 'granted') { permissionStatusDiv.text('Notifications Enabled').addClass('status-ok'); }
        else { permissionStatusDiv.text('Notifications Blocked').addClass('status-error'); }
    }
    
    async function subscribeUserToPush(registration) {
        if (Notification.permission !== 'granted') return;
        const existingSubscription = await registration.pushManager.getSubscription();
        if (existingSubscription) return;
        const applicationServerKey = urlB64ToUint8Array(live_order_ajax_object.vapid_public_key);
        if (!applicationServerKey) { console.error("VAPID public key is invalid."); return; }
        try {
            const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
            await saveSubscriptionToServer(subscription);
            console.log('User subscribed successfully.');
        } catch (err) { console.error('Failed to subscribe user:', err); }
    }

    function saveSubscriptionToServer(subscription) {
        return $.ajax({ url: live_order_ajax_object.ajax_url, type: 'POST', data: { action: 'save_push_subscription', subscription: JSON.stringify(subscription) } });
    }

    function handleNewData(data) {
        const { orders, total_income } = data;
        const newOrders = orders.filter(order => !knownOrderIds.has(order.id));
        dailyIncomeTotalSpan.html(total_income);
        if (newOrders.length > 0 && !isFirstLoad) { playSound(); }
        renderOrders(orders);
        knownOrderIds = new Set(orders.map(o => o.id));
        isFirstLoad = false;
    }

    function renderOrders(orders) {
        if (orders.length === 0) { feedContainer.html('<div class="status-message">No recent orders found.</div>'); return; }
        feedContainer.empty();
        const nowInSeconds = Date.now() / 1000;
        orders.forEach(order => {
            const isVeryNew = (nowInSeconds - order.time_gmt) < NEW_ORDER_THRESHOLD_SECONDS;
            let itemsHtml = order.items.map(item => `<li><span class="item-info">${item.quantity}x ${item.name}</span><span class="item-price">${item.total}</span></li>`).join('');
            const orderCard = `<div class="order-card ${isVeryNew ? 'new-order' : ''}"><div class="order-header"><span class="order-id">#${order.id}</span><span class="order-time">${order.time_local}</span></div><div class="order-body"><ul class="order-items-list">${itemsHtml}</ul></div></div>`;
            feedContainer.append(orderCard);
        });
    }

    function playSound() {
        if (notificationToggle.is(':checked') && notificationSound && isAudioUnlocked) {
            notificationSound.currentTime = 0;
            notificationSound.play().catch(e => console.error("Sound play failed:", e));
        }
    }

    function urlB64ToUint8Array(base64String) {
        if (!base64String || typeof base64String !== 'string') return null;
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
        return outputArray;
    }
    
    startButton.on('click', initializeAndStartFeed);
});
