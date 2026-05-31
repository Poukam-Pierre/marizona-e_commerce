'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface ProductNotification {
  type: 'product.created' | 'product.updated' | 'product.deleted';
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    image?: string;
    categoryId?: string;
  };
  timestamp: Date;
}

interface UseProductNotificationsOptions {
  /** Auto-connect on mount. Default: true */
  autoConnect?: boolean;
  /** Callback when a new product is created */
  onProductCreated?: (notification: ProductNotification) => void;
}

/**
 * Subscribes globally to Supabase Realtime postgres_changes on the `products`
 * table. Replaces the previous Socket.io implementation.
 * The public interface is intentionally kept identical so ProductNotificationsProvider
 * requires zero changes.
 */
export function useProductNotifications(
  options: UseProductNotificationsOptions = {},
) {
  const { autoConnect = true, onProductCreated } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<ProductNotification[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onProductCreatedRef = useRef(onProductCreated);
  useEffect(() => {
    onProductCreatedRef.current = onProductCreated;
  }, [onProductCreated]);

  useEffect(() => {
    if (!autoConnect) return;

    const channel = supabase
      .channel('storefront:products')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'products' },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const notification: ProductNotification = {
            type: 'product.created',
            product: {
              id: row['id'] as string,
              name: row['name'] as string,
              slug: row['slug'] as string,
              price: row['price'] as number,
              image: row['image'] as string | undefined,
              categoryId: row['category_id'] as string | undefined,
            },
            timestamp: new Date(),
          };
          setNotifications((prev) => [notification, ...prev]);
          onProductCreatedRef.current?.(notification);
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'products' },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const notification: ProductNotification = {
            type: 'product.updated',
            product: {
              id: row['id'] as string,
              name: row['name'] as string,
              slug: row['slug'] as string,
              price: row['price'] as number,
              image: row['image'] as string | undefined,
              categoryId: row['category_id'] as string | undefined,
            },
            timestamp: new Date(),
          };
          setNotifications((prev) => [notification, ...prev]);
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'products' },
        (payload) => {
          const row = payload.old as Record<string, unknown>;
          const notification: ProductNotification = {
            type: 'product.deleted',
            product: {
              id: row['id'] as string,
              name: (row['name'] as string) ?? '',
              slug: (row['slug'] as string) ?? '',
              price: (row['price'] as number) ?? 0,
            },
            timestamp: new Date(),
          };
          setNotifications((prev) => [notification, ...prev]);
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setError(null);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsConnected(false);
          setError(`Realtime channel error: ${status}`);
        } else if (status === 'CLOSED') {
          setIsConnected(false);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [autoConnect]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    isConnected,
    error,
    notifications,
    clearNotifications,
  };
}
