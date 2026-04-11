'use client';

import { usePushNotifications } from '@/hooks/use-push-notifications';

/**
 * Example component demonstrating push notification usage.
 *
 * You can add this to your layout or any page to allow users to subscribe
 * to push notifications for new products.
 *
 * Usage:
 * ```tsx
 * import { NotificationToggle } from '@/components/NotificationToggle';
 *
 * export default function Layout() {
 *   return (
 *     <div>
 *       <NotificationToggle />
 *       {children}
 *     </div>
 *   );
 * }
 * ```
 */
export function NotificationToggle() {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  // Not supported in this browser
  if (!isSupported) {
    return null; // Or show a message if you want
  }

  // User has blocked notifications
  if (permission === 'denied') {
    return (
      <div className="rounded-md bg-yellow-50 p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              Notifications Blocked
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>
                To receive notifications about new products, please enable
                notifications in your browser settings.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Product Notifications</h3>
          <p className="text-sm text-muted-foreground">
            {isSubscribed
              ? "You'll be notified when new products are added"
              : 'Get notified when new products are added'}
          </p>
        </div>
        <button
          onClick={isSubscribed ? unsubscribe : subscribe}
          disabled={isLoading}
          className={`
            rounded-md px-4 py-2 text-sm font-medium
            transition-colors disabled:opacity-50
            ${
              isSubscribed
                ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }
          `}
        >
          {isLoading ? 'Loading...' : isSubscribed ? 'Turn Off' : 'Turn On'}
        </button>
      </div>
      {error && <div className="mt-2 text-sm text-destructive">{error}</div>}
    </div>
  );
}
