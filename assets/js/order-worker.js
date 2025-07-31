// ===================================================================
// LIVE ORDER FEED - ORDER WORKER (Plugin Version - Background Processing)
// ===================================================================

let pollingInterval = null;
let isPolling = false;

self.addEventListener('message', (e) => {
    const { command, ajaxUrl, nonce, interval } = e.data;

    switch (command) {
        case 'start':
            if (!isPolling) {
                startPolling(ajaxUrl, nonce, interval || 7000);
            }
            break;
        case 'stop':
            stopPolling();
            break;
        default:
            break;
    }
});

function startPolling(ajaxUrl, nonce, interval) {
    if (isPolling) return;
    
    isPolling = true;
    
    // Initial fetch
    fetchOrders(ajaxUrl, nonce);
    
    // Set up interval
    pollingInterval = setInterval(() => {
        fetchOrders(ajaxUrl, nonce);
    }, interval);
}

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
    isPolling = false;
}

async function fetchOrders(ajaxUrl, nonce) {
    try {
        const formData = new FormData();
        formData.append('action', 'get_live_orders');
        formData.append('nonce', nonce);

        const response = await fetch(ajaxUrl, {
            method: 'POST',
            body: formData,
            credentials: 'same-origin'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success) {
            // Send successful data back to main thread
            self.postMessage({
                success: true,
                payload: data.data
            });
        } else {
            // Send error back to main thread
            self.postMessage({
                success: false,
                error: data.data || 'Unknown error occurred'
            });
        }
        
    } catch (error) {
        // Send fetch error back to main thread
        self.postMessage({
            success: false,
            error: `Network error: ${error.message}`
        });
    }
}

// Send ready signal
self.postMessage({
    type: 'worker_ready'
});
