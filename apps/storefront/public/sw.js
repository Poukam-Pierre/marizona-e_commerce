// ─── Cache configuration ───────────────────────────────────────────────────
const CACHE_VERSION = 'v1';
const STATIC_CACHE  = `static-${CACHE_VERSION}`;
const PAGES_CACHE   = `pages-${CACHE_VERSION}`;
const ALL_CACHES    = [STATIC_CACHE, PAGES_CACHE];

// Assets to pre-cache on install
const PRECACHE_URLS = ['/', '/offline', '/manifest.json'];

// ─── Install: pre-cache critical shell ────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(PAGES_CACHE).then(async (cache) => {
      // Fetch each URL individually so a single 404/redirect doesn't abort
      // the entire install. Chrome kills the SW if cache.addAll() rejects.
      await Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          fetch(url)
            .then((res) => {
              if (res.ok) return cache.put(url, res);
              console.warn('[SW] Pre-cache skipped (non-200):', url, res.status);
            })
            .catch((err) => console.warn('[SW] Pre-cache fetch failed:', url, err)),
        ),
      );
      await self.skipWaiting();
    }),
  );
});

// ─── Activate: purge stale caches, claim clients ──────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !ALL_CACHES.includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ─── Fetch: cache strategies ──────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept non-GET, cross-origin API calls, or Next.js internal routes
  if (request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/_next/data/')) return;

  // ── Cache-First: immutable static assets ──
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/favicon.ico'
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // ── Network-First: HTML page navigations (with offline fallback) ──
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(PAGES_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match('/offline') || new Response('Offline', { status: 503 });
        }),
    );
    return;
  }

  // ── Stale-While-Revalidate: everything else (fonts, JSON, etc.) ──
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      });
      return cached || networkFetch;
    }),
  );
});

// ─── Message: allow clients to trigger SKIP_WAITING ──────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ─── Push Notifications ───────────────────────────────────────────────────

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


