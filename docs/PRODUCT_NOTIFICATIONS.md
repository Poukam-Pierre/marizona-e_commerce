# Product Notifications System

## Overview

Real-time notification system for product events (create, update, delete) using WebSockets.

## Architecture

### Backend (API)

**Components:**

- `NotificationsGateway` - WebSocket gateway handling connections and broadcasting events
- `ProductsService` - Emits notifications when products are created/updated/deleted
- Socket.io server on `/notifications` namespace

**Key Features:**

- Real-time event broadcasting
- Topic-based subscriptions
- Support for multiple concurrent connections
- Auto-reconnection handling

### Frontend (Storefront)

**Components:**

- `useProductNotifications` - React hook for subscribing to notifications
- `ProductNotificationsProvider` - Global provider with toast notifications
- Automatic React Query cache invalidation

**Features:**

- Auto-connect on mount
- Custom callbacks for each event type
- Toast notifications for new products
- Connection status indicator

## Implementation Guide

### 1. Backend Setup (Already Implemented ✅)

The gateway and service integrations are complete:

```typescript
// Product notifications are automatically emitted when:
// - Product is created
```

### 2. Frontend Integration

#### Option A: Global Provider (Recommended)

Add to your root layout:

```tsx
// apps/storefront/src/app/layout.tsx
import { ProductNotificationsProvider } from '@/providers/product-notifications-provider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <QueryClientProvider client={queryClient}>
          <ProductNotificationsProvider>
            {children}
          </ProductNotificationsProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
```

This will:

- Auto-connect to WebSocket
- Show toast notifications for new products
- Automatically refresh product lists
- Display connection status (dev mode)

#### Option B: Custom Hook Usage

Use the hook directly in any component:

```tsx
import { useProductNotifications } from '@/hooks/use-product-notifications';

function MyComponent() {
  const { isConnected, notifications, clearNotifications } =
    useProductNotifications({
      autoConnect: true,
      topics: ['products'],
      onProductCreated: (notification) => {
        console.log('New product!', notification.product);
        // Custom logic here
      },
    });

  return (
    <div>
      <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
      <p>Notifications: {notifications.length}</p>
      <button onClick={clearNotifications}>Clear</button>
    </div>
  );
}
```

### 3. Testing

#### Test WebSocket Connection

```bash
# Terminal 1: Start API server
cd apps/api
npm run dev

# Terminal 2: Test with wscat
npm install -g wscat
wscat -c "ws://localhost:4000/notifications"

# Send test message
{"event": "ping"}
```

#### Test from Storefront

1. Open storefront in browser
2. Check browser console for connection logs
3. Create a new product from admin panel
4. Should see toast notification appear on storefront

## API Reference

### WebSocket Events

#### Client → Server

**subscribe**

```typescript
socket.emit('subscribe', { topics: ['products'] });
```

**unsubscribe**

```typescript
socket.emit('unsubscribe', { topics: ['products'] });
```

**ping** (health check)

```typescript
socket.emit('ping');
// Response: { event: 'pong', data: { timestamp, clientId } }
```

#### Server → Client

**product.created**

```typescript
{
  type: 'product.created',
  product: {
    id: string,
    name: string,
    slug: string,
    price: number,
    image?: string,
    categoryId?: string,
    categoryName?: string
  },
  timestamp: Date
}
```

## Advanced Features (TODO)

### 1. Browser Push Notifications 🔔

Enable notifications even when browser tab is closed.

**Requirements:**

- Service Worker
- Push API subscription
- Notification permission
- Backend integration with Web Push protocol

**Implementation Steps:**

```typescript
// 1. Create service worker
// apps/storefront/public/sw.js
self.addEventListener('push', (event) => {
  const data = event.data.json();
  self.registration.showNotification(data.title, {
    body: data.body,
    icon: data.icon,
  });
});

// 2. Request permission and subscribe
const registration = await navigator.serviceWorker.register('/sw.js');
const permission = await Notification.requestPermission();

if (permission === 'granted') {
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: VAPID_PUBLIC_KEY,
  });

  // Send subscription to backend
  await api.savePushSubscription(subscription);
}

// 3. Backend: Send push notifications
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:admin@marizona.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
);

await webpush.sendNotification(
  subscription,
  JSON.stringify({
    title: 'New Product!',
    body: product.name,
    icon: product.image,
    data: { url: `/products/${product.slug}` },
  }),
);
```

**Files to Create:**

- `apps/storefront/public/sw.js` - Service worker
- `apps/storefront/src/hooks/use-push-notifications.ts` - Hook for push subscriptions
- `apps/api/src/modules/notifications/dto/push-subscription.dto.ts` - DTO
- `apps/api/src/modules/notifications/push-notifications.service.ts` - Push service
- Database table for storing subscriptions

### 2. Mobile App Push Notifications 📱

For React Native or mobile apps.

**Requirements:**

- Firebase Cloud Messaging (FCM) or similar
- Mobile app with notification permissions
- Device token registration

**Implementation:**

```typescript
// 1. Install FCM
npm install firebase-admin

// 2. Backend: Send to mobile devices
import admin from 'firebase-admin';

await admin.messaging().send({
  token: deviceToken,
  notification: {
    title: 'New Product!',
    body: product.name,
  },
  data: {
    productId: product.id,
    type: 'product.created'
  }
});

// 3. Mobile App: Register device token
const token = await messaging().getToken();
await api.registerDeviceToken(token);
```

**Files to Create:**

- `apps/api/src/modules/notifications/fcm.service.ts` - FCM integration
- `apps/api/src/modules/notifications/dto/device-token.dto.ts` - DTO
- Database table for device tokens
- Mobile app notification handler

### 3. Notification Preferences ⚙️

Allow users to customize which notifications they receive.

**Database Schema:**

```prisma
model NotificationPreference {
  id        String   @id @default(cuid())
  userId    String?  @unique
  sessionId String?  @unique

  // Product notifications
  productCreated Boolean @default(true)
  productUpdated Boolean @default(false)
  productDeleted Boolean @default(false)

  // Category filters
  categories String[] // Array of category IDs

  // Price range filters
  minPrice   Float?
  maxPrice   Float?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**API Endpoints:**

```typescript
// GET /notifications/preferences
// PUT /notifications/preferences
// POST /notifications/preferences/test
```

### 4. Notification History 📋

Store and display notification history.

**Database Schema:**

```prisma
model NotificationHistory {
  id           String   @id @default(cuid())
  userId       String?
  sessionId    String?
  type         String
  title        String
  body         String
  data         Json
  isRead       Boolean  @default(false)
  readAt       DateTime?
  createdAt    DateTime @default(now())

  @@index([userId])
  @@index([sessionId])
  @@index([createdAt])
}
```

**Features:**

- Notification inbox
- Mark as read/unread
- Delete notifications
- Filter by type/date
- Pagination

### 5. Rate Limiting & Throttling ⏱️

Prevent notification spam.

**Implementation:**

```typescript
// Throttle notifications per user
const notificationQueue = new Map();

function throttleNotification(userId: string, notification: Notification) {
  const lastSent = notificationQueue.get(userId);
  const now = Date.now();

  // Only send if 30 seconds have passed
  if (!lastSent || now - lastSent > 30000) {
    sendNotification(userId, notification);
    notificationQueue.set(userId, now);
  }
}
```

**Features:**

- Max notifications per minute
- Batch similar notifications
- Quiet hours support
- Priority levels

## Configuration

### Environment Variables

Add to `.env`:

```bash
# WebSocket Configuration
WEBSOCKET_PORT=4000
WEBSOCKET_CORS_ORIGIN=http://localhost:3000

# Web Push (for browser push notifications)
VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key
VAPID_SUBJECT=mailto:admin@marizona.com

# Firebase (for mobile push notifications)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_client_email
```

### Nginx/Caddy Configuration

Ensure WebSocket upgrade headers are set:

```caddy
# Caddyfile
@websocket {
    path /notifications/*
}

handle @websocket {
    reverse_proxy localhost:4000 {
        header_up Upgrade {http.request.header.Upgrade}
        header_up Connection {http.request.header.Connection}
    }
}
```

## Monitoring & Analytics

### Metrics to Track

- Connected clients count
- Notifications sent per minute
- Average delivery time
- Failed deliveries
- WebSocket reconnection rate

### Logging

```typescript
// Add to NotificationsGateway
@Interval(60000) // Every minute
logMetrics() {
  this.logger.log(`Connected clients: ${this.getConnectedClientsCount()}`);
}
```

## Troubleshooting

### Connection Issues

**Problem:** WebSocket not connecting

**Solutions:**

1. Check CORS configuration
2. Verify proxy/reverse proxy settings
3. Check firewall rules
4. Ensure WebSocket upgrade headers are set

### No Notifications Received

**Problem:** Connected but not receiving notifications

**Solutions:**

1. Check if subscribed to correct topics
2. Verify product creation is triggering events
3. Check server logs for errors
4. Test with ping/pong event

### Performance Issues

**Problem:** Slow notification delivery

**Solutions:**

1. Check server resources
2. Implement Redis for pub/sub across instances
3. Add message queuing (RabbitMQ, SQS)
4. Optimize notification payload size

## Next Steps

1. ✅ Implement basic WebSocket notifications (DONE)
2. ⬜ Add ProductNotificationsProvider to storefront layout
3. ⬜ Test end-to-end with product creation
4. ⬜ Implement browser push notifications
5. ⬜ Add notification preferences
6. ⬜ Create notification history/inbox
7. ⬜ Implement mobile push notifications
8. ⬜ Add rate limiting
9. ⬜ Set up monitoring & analytics

## Resources

- [Socket.io Documentation](https://socket.io/docs/v4/)
- [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Web Push Protocol](https://tools.ietf.org/html/rfc8030)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
