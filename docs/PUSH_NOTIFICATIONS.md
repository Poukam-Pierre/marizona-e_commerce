# Push Notifications Implementation

Complete browser push notification system for product creation events.

## Overview

Two notification systems now work together:

1. **WebSocket** - Real-time notifications for active users
2. **Push API** - Background notifications for PWA/browser (even when app is closed)

## Backend (API)

### Files Created/Modified

1. **push-notification.service.ts** - Core push notification service
   - `subscribe()` - Save subscription to database
   - `unsubscribe()` - Deactivate subscription
   - `sendToAll()` - Broadcast to all active subscriptions
   - `notifyProductCreated()` - Send product creation notification

2. **push-subscription.dto.ts** - Validation DTOs
   - `CreatePushSubscriptionDto`
   - `DeletePushSubscriptionDto`

3. **notifications.controller.ts** - REST endpoints
   - `GET /notifications/push/vapid-key` - Public VAPID key
   - `POST /notifications/push/subscribe` - Subscribe
   - `DELETE /notifications/push/unsubscribe` - Unsubscribe

4. **products.service.ts** - Integrated push notifications
   - Calls `pushNotificationService.notifyProductCreated()` after product creation
   - Works alongside existing WebSocket notifications

5. **.env** - VAPID keys added
   ```
   VAPID_PUBLIC_KEY=BHJlt2l0NEnasgLw5R0bi6JKx6EvvRvKgNCP_YZetSHlSksqR9AzIt6VFIPScBpcqKW9GYRQ7BEGCUfZY804DjQ
   VAPID_PRIVATE_KEY=hnFI4UKv201367gcwwHE87HZ6-Jq2ajBCGFvFQs9cdY
   VAPID_SUBJECT=mailto:admin@marizona.com
   ```

## Frontend (Storefront)

### Files Created

1. **public/sw.js** - Service worker for push notifications
   - Handles 'push' events from browser
   - Displays notifications with `showNotification()`
   - Handles notification clicks to open product pages
   - Auto-activates and claims clients

2. **hooks/use-push-notifications.ts** - React hook for push management
   - `requestPermission()` - Request notification permission
   - `subscribe()` - Subscribe to push notifications
   - `unsubscribe()` - Unsubscribe from notifications
   - Auto-registers service worker
   - Sends subscription to backend

## Usage Example

### In a React Component

```tsx
'use client';

import { usePushNotifications } from '@/hooks/use-push-notifications';
import { Button } from '@/components/ui/button';

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

  if (!isSupported) {
    return <p>Push notifications are not supported</p>;
  }

  if (permission === 'denied') {
    return <p>Notifications blocked. Please enable in browser settings.</p>;
  }

  return (
    <div>
      {error && <p className="text-red-500">{error}</p>}

      {isSubscribed ? (
        <Button onClick={unsubscribe} disabled={isLoading} variant="outline">
          Turn off notifications
        </Button>
      ) : (
        <Button onClick={subscribe} disabled={isLoading}>
          Get notified about new products
        </Button>
      )}
    </div>
  );
}
```

## How It Works

### Duplicate Prevention

To avoid duplicate notifications, the service worker checks if the app is currently visible:

- **App visible** → Only WebSocket notification (in-app)
- **App hidden/closed** → Push notification (browser/system)

This ensures users never receive duplicate notifications for the same event.

### Product Creation Flow

1. Admin creates a product in admin panel
2. Backend saves product to database
3. Backend sends two notifications:
   - **WebSocket**: To all connected clients (real-time)
   - **Push API**: To all subscribed browsers (background)
4. Service worker receives push event
5. Service worker checks if any window is visible:
   - If visible → Skip (user already got WebSocket notification)
   - If hidden → Display push notification
6. User clicks notification → Opens product page

### Subscription Flow

1. User clicks "Get notified" button
2. Browser requests notification permission
3. Service worker registers at `/sw.js`
4. Browser creates push subscription with VAPID key
5. Frontend sends subscription to backend
6. Backend saves to `push_subscriptions` table
7. User receives notifications for all new products

## Testing

### 1. Start the application

```bash
pnpm dev
```

### 2. In Storefront (http://localhost:4200)

- Import and add `<NotificationToggle />` component
- Click "Get notified about new products"
- Allow notifications when prompted

### 3. In Admin (http://localhost:3001)

- Create a new product
- Go to Products → Create Product
- Fill form and submit

### 4. Check Notifications

- You should see a notification immediately
- Even if storefront tab is closed/in background
- Click notification to open product page

## Database

The `push_subscriptions` table already exists (from init migration):

- `endpoint` - Unique push endpoint URL
- `p256dh` - Public key for encryption
- `auth` - Authentication secret
- `userId` - Optional user association (for future)
- `isActive` - Subscription status

## Configuration

### Environment Variables (Already Set)

```
VAPID_PUBLIC_KEY=<public-key>
VAPID_PRIVATE_KEY=<private-key>
VAPID_SUBJECT=mailto:admin@marizona.com
```

### Next.js Public API URL

The hook uses `process.env.NEXT_PUBLIC_API_URL` or defaults to `http://localhost:3000/api`

## Production Considerations

1. **HTTPS Required** - Push API requires secure origin (HTTPS or localhost)
2. **VAPID Keys** - Already generated and committed to `.env`
3. **Error Handling** - Push failures logged but don't block product creation
4. **Batch Sending** - Sends push notifications in batches (100 at a time)
5. **Cleanup** - Failed subscriptions automatically marked as inactive

## Security

- VAPID authentication prevents spoofing
- Subscriptions tied to browser/device
- Optional user association (userId field)
- Encrypted payload (P-256 ECDH)

## Browser Support

- Chrome/Edge 50+
- Firefox 44+
- Safari 16+ (macOS 13+)
- Opera 37+

## Next Steps

1. Add `<NotificationToggle />` component to storefront layout
2. Test end-to-end flow (create product → receive notification)
3. Customize notification UI/styling
4. Add user preferences (notification frequency, types)
5. Track analytics (subscription rates, click-through)
