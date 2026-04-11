'use client';

import { useState } from 'react';
import { useProductNotifications } from '@/hooks/use-product-notifications';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/use-api';

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
  const [toasts, setToasts] = useState<
    Array<{ id: string; message: string; type: string }>
  >([]);

  const { isConnected } = useProductNotifications({
    autoConnect: true,
    topics: ['products'],
    onProductCreated: (notification) => {
      // Show toast notification
      showToast({
        message: `New product: ${notification.product.name}`,
        type: 'success',
      });

      // Invalidate product queries to refresh the list
      queryClient.invalidateQueries({ queryKey: queryKeys.products() });
    },
  });

  const showToast = (toast: { message: string; type: string }) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, ...toast }]);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

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

      {/* Toast notifications */}
      <div className="fixed bottom-5 right-5 z-[10000] flex flex-col gap-2.5 max-w-xs">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="px-4 py-3 bg-white border border-gray-200 rounded-lg shadow-md animate-slide-in-right"
          >
            <p className="m-0 text-sm font-medium">{toast.message}</p>
          </div>
        ))}
      </div>
    </>
  );
}
