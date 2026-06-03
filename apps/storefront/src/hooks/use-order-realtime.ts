'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface OrderRealtimeStatus {
  status: string;
  paymentStatus: string;
  updatedAt: string;
}

interface UseOrderRealtimeOptions {
  /** Called whenever the order row changes */
  onStatusChange?: (update: OrderRealtimeStatus) => void;
}

/**
 * Subscribes to Supabase Realtime postgres_changes for a single order row,
 * filtered by orderId. Used on the order tracking page so customers see live
 * status updates without polling.
 *
 * Security note: the subscription filter is client-side. The actual data
 * returned by postgres_changes only includes columns the anon role can SELECT
 * (enforced by RLS on the orders table). The orderId is used purely for
 * channel scoping — no sensitive data is exposed beyond what RLS permits.
 */
export function useOrderRealtime(
  orderId: string | null | undefined,
  options: UseOrderRealtimeOptions = {},
) {
  const { onStatusChange } = options;

  const [orderStatus, setOrderStatus] = useState<OrderRealtimeStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!orderId) return;

    const channel = supabase
      .channel(`order:${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const update: OrderRealtimeStatus = {
            status: row['status'] as string,
            paymentStatus: row['payment_status'] as string,
            updatedAt: row['updated_at'] as string,
          };
          setOrderStatus(update);
          onStatusChange?.(update);
        },
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // onStatusChange is intentionally excluded — callers should use useCallback
    // or a ref if they need stable identity. Including it would cause
    // subscribe/unsubscribe on every render for inline functions.
  }, [orderId]);

  return { orderStatus, isConnected };
}
