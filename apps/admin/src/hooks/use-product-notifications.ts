'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export interface ProductNotification {
  type: 'product.created' | 'product.updated' | 'product.deleted';
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    image?: string;
    categoryId?: string;
    categoryName?: string;
  };
  timestamp: Date;
}

interface UseProductNotificationsOptions {
  autoConnect?: boolean;
  topics?: string[];
  onProductCreated?: (notification: ProductNotification) => void;
}

/**
 * Hook for admin panel to receive real-time product notifications
 * Shows toast when products are created/updated/deleted by other admins
 */
export function useProductNotifications(
  options: UseProductNotificationsOptions = {},
) {
  const {
    autoConnect = true,
    topics = ['products'],
    onProductCreated,
  } = options;

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<ProductNotification[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onProductCreatedRef = useRef(onProductCreated);

  useEffect(() => {
    onProductCreatedRef.current = onProductCreated;
  }, [onProductCreated]);

  useEffect(() => {
    if (!autoConnect) return;

    // Connect to API WebSocket - use full URL for admin
    const socketInstance = io(
      `${process.env.NEXT_PUBLIC_API_URL}/notifications`,
      {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
      },
    );

    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      setIsConnected(true);
      setError(null);
      console.log('[Admin] Connected to notifications server');

      if (topics.length > 0) {
        socketInstance.emit('subscribe', { topics });
      }
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
      console.log('[Admin] Disconnected from notifications server');
    });

    socketInstance.on('connect_error', (err) => {
      setError(err.message);
      console.error('[Admin] Connection error:', err);
    });

    socketInstance.on('connected', (data) => {
      console.log('[Admin] Server confirmed connection:', data);
    });

    socketInstance.on(
      'product.created',
      (notification: ProductNotification) => {
        console.log('[Admin] New product created:', notification);
        setNotifications((prev) => [notification, ...prev]);
        onProductCreatedRef.current?.(notification);
      },
    );

    return () => {
      socketInstance.disconnect();
    };
  }, [autoConnect, topics]);

  const subscribe = useCallback(
    (newTopics: string[]) => {
      if (socket && isConnected) {
        socket.emit('subscribe', { topics: newTopics });
      }
    },
    [socket, isConnected],
  );

  const unsubscribe = useCallback(
    (topicsToUnsubscribe: string[]) => {
      if (socket && isConnected) {
        socket.emit('unsubscribe', { topics: topicsToUnsubscribe });
      }
    },
    [socket, isConnected],
  );

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    isConnected,
    error,
    notifications,
    subscribe,
    unsubscribe,
    clearNotifications,
  };
}
