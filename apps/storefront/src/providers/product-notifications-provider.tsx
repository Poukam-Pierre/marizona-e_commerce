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

      {/* Connection indicator (optional) */}
      {process.env.NODE_ENV === 'development' && (
        <div
          style={{
            position: 'fixed',
            bottom: '80px',
            right: '20px',
            padding: '8px 12px',
            background: isConnected ? '#10b981' : '#ef4444',
            color: 'white',
            borderRadius: '6px',
            fontSize: '12px',
            zIndex: 9999,
            opacity: 0.8,
          }}
        >
          {isConnected ? '🟢 Live' : '🔴 Offline'}
        </div>
      )}

      {/* Toast notifications */}
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxWidth: '320px',
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              padding: '12px 16px',
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              animation: 'slideInRight 0.3s ease-out',
            }}
          >
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>
              {toast.message}
            </p>
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}
