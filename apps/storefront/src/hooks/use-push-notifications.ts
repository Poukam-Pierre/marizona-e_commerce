'use client';

import { useEffect, useState, useCallback } from 'react';
import { FUNCTIONS_URL } from '@/services/api';

interface UsePushNotificationsOptions {
  /** Auto-request permission on mount. Default: false */
  autoRequest?: boolean;
  /** Callback when subscription changes */
  onSubscriptionChange?: (subscription: PushSubscription | null) => void;
}

export function usePushNotifications(
  options: UsePushNotificationsOptions = {},
) {
  const { autoRequest = false, onSubscriptionChange } = options;

  const [permission, setPermission] =
    useState<NotificationPermission>('default');
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceWorkerReady, setServiceWorkerReady] = useState(false);

  // Start as false so server and client agree on the initial render,
  // then set the real value client-side to avoid hydration mismatches.
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(
      'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window,
    );
  }, []);

  // Initialize permission state
  useEffect(() => {
    if (isSupported && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, [isSupported]);

  // Wait for the globally-registered service worker to be ready.
  // Registration itself is handled by <ServiceWorkerRegister> in the layout.
  useEffect(() => {
    if (!isSupported) return;

    const waitForServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        console.log('[Push] Service worker ready:', registration.scope);
        setServiceWorkerReady(true);

        // Check for existing push subscription
        const existingSubscription =
          await registration.pushManager.getSubscription();
        if (existingSubscription) {
          setSubscription(existingSubscription);
          onSubscriptionChange?.(existingSubscription);
        }
      } catch (err) {
        console.error('[Push] Service worker not available:', err);
        setError('Service worker unavailable');
      }
    };

    waitForServiceWorker();
  }, [isSupported]);

  // Auto-request permission if enabled
  useEffect(() => {
    if (autoRequest && isSupported && permission === 'default') {
      requestPermission();
    }
  }, [autoRequest, isSupported, permission]);

  // Request notification permission
  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      setError('Push notifications are not supported');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (err) {
      console.error('[Push] Permission request failed:', err);
      setError('Failed to request permission');
      return false;
    }
  }, [isSupported]);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!isSupported || !serviceWorkerReady) {
      setError('Service worker not ready');
      return null;
    }

    if (permission !== 'granted') {
      const granted = await requestPermission();
      if (!granted) {
        setError('Permission denied');
        return null;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get VAPID public key from Edge Function
      const vapidResponse = await fetch(`${FUNCTIONS_URL}/push-vapid-key`);

      if (!vapidResponse.ok) {
        throw new Error('Failed to get VAPID key');
      }

      const { data: { publicKey } } = await vapidResponse.json();

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      console.log('[Push] Subscribed:', pushSubscription);

      // Send subscription to Edge Function
      const subscribeResponse = await fetch(`${FUNCTIONS_URL}/push-subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: pushSubscription.endpoint,
          p256dh: arrayBufferToBase64(pushSubscription.getKey('p256dh')),
          auth: arrayBufferToBase64(pushSubscription.getKey('auth')),
          userAgent: navigator.userAgent,
        }),
      });

      if (!subscribeResponse.ok) {
        throw new Error('Failed to save subscription');
      }

      setSubscription(pushSubscription);
      onSubscriptionChange?.(pushSubscription);

      return pushSubscription;
    } catch (err) {
      console.error('[Push] Subscription failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to subscribe');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [
    isSupported,
    serviceWorkerReady,
    permission,
    requestPermission,
    onSubscriptionChange,
  ]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    if (!subscription) {
      return true;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Unsubscribe from push
      await subscription.unsubscribe();

      // Notify Edge Function
      await fetch(`${FUNCTIONS_URL}/push-unsubscribe`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });

      console.log('[Push] Unsubscribed');
      setSubscription(null);
      onSubscriptionChange?.(null);

      return true;
    } catch (err) {
      console.error('[Push] Unsubscribe failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to unsubscribe');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [subscription, onSubscriptionChange]);

  return {
    isSupported,
    permission,
    subscription,
    isSubscribed: !!subscription,
    isLoading,
    error,
    serviceWorkerReady,
    requestPermission,
    subscribe,
    unsubscribe,
  };
}

// Helper: Convert URL-safe base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

// Helper: Convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}
