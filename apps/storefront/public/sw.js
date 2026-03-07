// Service Worker for Push Notifications

// Listen for push events
self.addEventListener('push', (event) => {
    console.log('[Service Worker] Push received:', event);

    if (!event.data) {
        console.log('[Service Worker] Push event but no data');
        return;
    }

    const handlePushNotification = async () => {
        try {
            // Check if any client window is currently visible
            const clients = await self.clients.matchAll({
                type: 'window',
                includeUncontrolled: true
            });

            const hasVisibleClient = clients.some(
                client => client.visibilityState === 'visible'
            );

            // If user has the app open and visible, skip push notification
            // They'll receive the real-time WebSocket notification instead
            if (hasVisibleClient) {
                console.log('[Service Worker] App is visible, skipping push notification');
                return;
            }

            const data = event.data.json();
            const { title, body, icon, badge, data: notificationData } = data;

            const options = {
                body,
                icon: icon || '/icon-192x192.png',
                badge: badge || '/badge-72x72.png',
                vibrate: [200, 100, 200],
                tag: notificationData?.productId || 'product-notification',
                data: notificationData,
                actions: [
                    {
                        action: 'open',
                        title: 'View Product',
                    },
                    {
                        action: 'close',
                        title: 'Dismiss',
                    },
                ],
            };

            await self.registration.showNotification(title, options);
            console.log('[Service Worker] Push notification displayed');
        } catch (error) {
            console.error('[Service Worker] Error handling push:', error);
        }
    };

    event.waitUntil(handlePushNotification());
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Notification clicked:', event.action);

    event.notification.close();

    if (event.action === 'close') {
        return;
    }

    // Open the product page
    const url = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Check if there's already a window open
            for (const client of clientList) {
                if (client.url.includes(url) && 'focus' in client) {
                    return client.focus();
                }
            }
            // If not, open a new window
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});

// Handle service worker installation
self.addEventListener('install', () => {
    console.log('[Service Worker] Installing...');
    // Skip waiting to activate immediately
    self.skipWaiting();
});

// Handle service worker activation
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    // Claim all clients immediately
    event.waitUntil(clients.claim());
});

// Handle messages from the client
self.addEventListener('message', (event) => {
    console.log('[Service Worker] Message received:', event.data);

    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
