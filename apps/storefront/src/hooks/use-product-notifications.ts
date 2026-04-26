'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

/**
 * Derive the Socket.io server base URL from NEXT_PUBLIC_API_URL.
 * The API URL includes "/api/v1", but the socket server lives at the root host.
 * Falls back to the API port (3002) for local development.
 */
function getSocketBaseUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl) {
    // Strip trailing /api/v1 or /api to get the bare origin
    return apiUrl.replace(/\/api(\/v\d+)?\/?$/, '');
  }
  return 'http://localhost:3002';
}

export interface ProductNotification {
  type: 'product.created';
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
  /** Auto-connect on mount. Default: true */
  autoConnect?: boolean;
  /** Topics to subscribe to. Default: ['products'] */
  topics?: string[];
  /** Callback when a new product is created */
  onProductCreated?: (notification: ProductNotification) => void;
}

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

  // Use refs to avoid recreating listeners on every render
  const onProductCreatedRef = useRef(onProductCreated);

  useEffect(() => {
    onProductCreatedRef.current = onProductCreated;
  }, [onProductCreated]);

  // Serialize topics so an inline array literal from the caller (e.g.
  // topics={['products']}) does not create a new reference on every render and
  // cause repeated socket connect/disconnect cycles.
  const topicsKey = JSON.stringify(topics);

  useEffect(() => {
    if (!autoConnect) return;

    // Connect to WebSocket server using an absolute URL so the socket
    // reaches the API server (port 3002) directly, regardless of the proxy
    // in front of the storefront (port 3000).
    const socketInstance = io(`${getSocketBaseUrl()}/notifications`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    setSocket(socketInstance);

    // Connection handlers
    socketInstance.on('connect', () => {
      setIsConnected(true);
      setError(null);
      console.log('Connected to notifications server');

      // Subscribe to topics
      const parsedTopics: string[] = JSON.parse(topicsKey);
      if (parsedTopics.length > 0) {
        socketInstance.emit('subscribe', { topics: parsedTopics });
      }
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from notifications server');
    });

    socketInstance.on('connect_error', (err) => {
      setError(err.message);
      console.error('Connection error:', err);
    });

    socketInstance.on('connected', (data) => {
      console.log('Server confirmed connection:', data);
    });

    // Product notification handlers
    socketInstance.on(
      'product.created',
      (notification: ProductNotification) => {
        console.log('New product created:', notification);
        setNotifications((prev) => [notification, ...prev]);
        onProductCreatedRef.current?.(notification);
      },
    );

    return () => {
      socketInstance.disconnect();
    };
  }, [autoConnect, topicsKey]);

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

  const disconnect = useCallback(() => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
    }
  }, [socket]);

  const connect = useCallback(() => {
    if (!socket) {
      const socketInstance = io(`${getSocketBaseUrl()}/notifications`, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
      });
      setSocket(socketInstance);
    } else if (!isConnected) {
      socket.connect();
    }
  }, [socket, isConnected]);

  return {
    isConnected,
    error,
    notifications,
    subscribe,
    unsubscribe,
    clearNotifications,
    disconnect,
    connect,
  };
}
