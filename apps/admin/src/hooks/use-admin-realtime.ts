'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/hooks/use-queries';

/**
 * Global Realtime hook for the admin panel.
 * Subscribes to postgres_changes on products, orders, and inventory_movements.
 * On any change it invalidates the relevant TanStack Query cache keys so that
 * all admin views automatically refresh — no manual polling required.
 *
 * Call this once at a high level (e.g. the admin layout or a provider).
 */
export function useAdminRealtime() {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let connectedCount = 0;
    const TOTAL_CHANNELS = 3;

    const markConnected = (connected: boolean) => {
      if (connected) {
        connectedCount = Math.min(connectedCount + 1, TOTAL_CHANNELS);
      } else {
        connectedCount = Math.max(connectedCount - 1, 0);
      }
      setIsConnected(connectedCount === TOTAL_CHANNELS);
    };

    // ── Products channel ────────────────────────────────────────────────────
    const productsChannel = supabase
      .channel('admin:products')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.products() });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats });
        },
      )
      .subscribe((status) => {
        markConnected(status === 'SUBSCRIBED');
      });

    // ── Orders channel ──────────────────────────────────────────────────────
    const ordersChannel = supabase
      .channel('admin:orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.orders() });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats });
          queryClient.invalidateQueries({
            queryKey: queryKeys.dashboard.recentOrders,
          });
        },
      )
      .subscribe((status) => {
        markConnected(status === 'SUBSCRIBED');
      });

    // ── Inventory channel ───────────────────────────────────────────────────
    const inventoryChannel = supabase
      .channel('admin:inventory')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory_movements' },
        () => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.dashboard.lowStock,
          });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats });
        },
      )
      .subscribe((status) => {
        markConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(inventoryChannel);
      setIsConnected(false);
    };
  }, [queryClient]);

  return { isConnected };
}
