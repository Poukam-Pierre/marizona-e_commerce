'use client';

import { useProductNotifications } from '@/hooks/use-product-notifications';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/use-api';
import { toast } from 'sonner';

/**
 * ProductNotificationsProvider - Global provider for real-time product notifications
 * Place this in your root layout to enable notifications throughout the app
 */
export function ProductNotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();

  const { isConnected } = useProductNotifications({
    autoConnect: true,
    topics: ['products'],
    onProductCreated: (notification) => {
      toast.success(`New product: ${notification.product.name}`, {
        description: 'Just arrived in the store!',
        duration: 5000,
      });

      // Invalidate product queries to refresh the list
      queryClient.invalidateQueries({ queryKey: queryKeys.products() });
    },
  });

  return (
    <>
      {children}

      {/* Connection indicator (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div
          className={[
            'fixed bottom-20 right-5 px-3 py-2 rounded-md text-white text-xs z-[9999] opacity-80',
            isConnected ? 'bg-emerald-500' : 'bg-red-500',
          ].join(' ')}
        >
          {isConnected ? '🟢 Live' : '🔴 Offline'}
        </div>
      )}
    </>
  );
}
