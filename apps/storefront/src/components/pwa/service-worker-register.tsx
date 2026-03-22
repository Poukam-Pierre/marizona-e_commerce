'use client';

import { useEffect } from 'react';

/**
 * Registers /sw.js unconditionally on every page load.
 * Only requires `serviceWorker` in navigator (not PushManager/Notification),
 * so PWA installability + offline caching work on all modern browsers.
 * Push-notification logic remains separate (use-push-notifications hook).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[SW] Registered, scope:', registration.scope);

        // If a new SW is waiting, activate it immediately
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // A new version is ready; activate without forcing a hard reload
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch((err) => console.error('[SW] Registration failed:', err));
  }, []);

  return null;
}
