# Socket.io → Supabase Realtime Migration Plan

**Version:** 1.0  
**Date:** May 26, 2026  
**Status:** Planning Phase  
**Scope:** Replace Socket.io WebSocket gateway with Supabase Realtime for product & order updates

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Socket.io Architecture](#current-socketio-architecture)
3. [Target Supabase Realtime Architecture](#target-supabase-realtime-architecture)
4. [Migration Strategy](#migration-strategy)
5. [Implementation Plan](#implementation-plan)
6. [Code Examples](#code-examples)
7. [Channel Subscriptions Matrix](#channel-subscriptions-matrix)
8. [Testing Strategy](#testing-strategy)
9. [Rollout Plan](#rollout-plan)
10. [Troubleshooting](#troubleshooting)

---

## Executive Summary

This document outlines the complete migration from **Socket.io WebSocket gateway** (NestJS) to **Supabase Realtime** for real-time broadcasts of product and order status changes. This migration enables:

- ✅ **Built-in RLS**: Subscriptions automatically respect row-level security (customers only see own orders)
- ✅ **Scalable**: No Redis adapter needed; Supabase handles pub/sub infrastructure
- ✅ **Unified Auth**: Uses same JWT authentication as rest of app
- ✅ **New Feature**: Order status updates (currently missing from Socket.io)
- ✅ **Less Code**: Remove 200+ lines of gateway code; rely on database change detection
- ✅ **Zero Configuration**: No Socket.io server tuning or connection pool management

### Why This Migration is Necessary

| Issue                  | Current (Socket.io)                     | Supabase Realtime                     |
| ---------------------- | --------------------------------------- | ------------------------------------- |
| **Scaling**            | Single-instance only (no Redis adapter) | Distributed by default                |
| **Auth**               | ❌ No JWT verification on WebSocket     | ✅ JWT + RLS enforcement              |
| **RLS**                | ❌ Manual filtering in app code         | ✅ Automatic (customers see own data) |
| **Order Updates**      | ❌ Not implemented                      | ✅ Automatic on DB change             |
| **Connection Mgmt**    | Manual rooms + topics                   | Channel subscriptions                 |
| **Code Complexity**    | Gateway + emitters + listeners          | Listener only (DB triggers emission)  |
| **Operations**         | Requires Socket.io server tuning        | Zero-config                           |
| **Horizontal Scaling** | Requires Redis adapter setup            | Handled by Supabase                   |

### Critical Discovery: Missing Order Tracking Feature

⚠️ **IMPORTANT**: The current Socket.io implementation only broadcasts `product.created` events. **Order status updates are NOT being broadcast**, which means customers have no real-time order tracking capability. This migration will enable proper order tracking for the first time.

### Scope Clarification

**In Scope:**

- ✅ Product creation/update/delete broadcasts (Realtime)
- ✅ Order status update broadcasts (new feature!)
- ✅ Inventory movement broadcasts
- ✅ Storefront order tracking (customer sees own orders)
- ✅ Admin real-time dashboards
- ✅ Remove Socket.io server code completely
- ✅ Both Storefront and Admin apps
- ✅ Dynamic subscriptions per page/component

**Out of Scope:**

- ❌ Admin user management notifications (future)
- ❌ Chat/messaging features (different namespace)
- ❌ Settings change broadcasts (low priority)

---

## Current Socket.io Architecture

### Discovery Summary

**Comprehensive codebase analysis revealed:**

- Only `product.created` event is fully implemented
- `product.updated` and `product.deleted` are commented out
- **No order status update events exist** (critical missing feature)
- No Redis adapter configured (single-instance deployment only)
- No JWT authentication on WebSocket connections (security gap)
- Inconsistent URL handling between Storefront and Admin

### Server-Side (NestJS)

#### Gateway File

**Location**: `apps/api/src/modules/notifications/notifications.gateway.ts`

```typescript
@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: '*' }, // ⚠️ Accepts all origins
})
@Injectable()
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
    // ⚠️ No JWT verification
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, data: { topic: string }) {
    client.join(`topic:${data.topic}`); // Topic-based rooms
    console.log(`Client ${client.id} subscribed to ${data.topic}`);
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(client: Socket, data: { topic: string }) {
    client.leave(`topic:${data.topic}`);
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket): string {
    return 'pong';
  }

  // ✅ ONLY ACTIVE EVENT
  emitProductCreated(notification: ProductNotification) {
    this.server.to('products').emit('product.created', notification);
  }

  // ❌ COMMENTED OUT
  // emitProductUpdated(notification: ProductNotification) {
  //   this.server.to('products').emit('product.updated', notification);
  // }

  // ❌ COMMENTED OUT
  // emitProductDeleted(notification: ProductNotification) {
  //   this.server.to('products').emit('product.deleted', notification);
  // }
}
```

#### Event Triggers

**Location**: `apps/api/src/modules/products/products.service.ts` (line 349)

```typescript
// After product creation
const createdProduct = await this.prisma.product.create({ data: productData });

// Emit Socket.io event
this.notificationsGateway.emitProductCreated({
  type: 'product.created',
  product: {
    id: createdProduct.id,
    name: createdProduct.name,
    slug: createdProduct.slug,
    price: createdProduct.price,
    image: createdProduct.images?.[0]?.url,
    categoryId: createdProduct.category_id,
    categoryName: category?.name,
  },
  timestamp: new Date(),
});
```

#### Current Events Status

| Event                  | Status             | Trigger Location          | Fully Implemented?    |
| ---------------------- | ------------------ | ------------------------- | --------------------- |
| `product.created`      | ✅ Active          | `products.service.ts:349` | Yes                   |
| `product.updated`      | ❌ Commented out   | N/A                       | No                    |
| `product.deleted`      | ❌ Commented out   | N/A                       | No                    |
| `order.status-changed` | ❌ Not implemented | N/A                       | **No** (critical gap) |

#### Limitations Identified

1. **No Redis Adapter**: Single-instance only, cannot scale horizontally
2. **No Authentication**: WebSocket accepts all connections without JWT verification
3. **No Authorization**: No role-based access control on event subscriptions
4. **Incomplete Events**: Only product creation works; updates/deletes disabled
5. **Missing Order Tracking**: No order status change broadcasts

---

### Client-Side (Storefront)

#### Hook Implementation

**Location**: `apps/storefront/src/hooks/use-product-notifications.ts`

```typescript
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

// URL resolution - strips /api/v1 path
function getSocketBaseUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl) {
    return apiUrl.replace(/\/api(\/v\d+)?\/?$/, ''); // Strips /api/v1
  }
  return 'http://localhost:3002'; // Dev fallback
}

export function useProductNotifications(
  onProductCreated?: (notification: any) => void,
) {
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const onProductCreatedRef = useRef(onProductCreated);

  useEffect(() => {
    onProductCreatedRef.current = onProductCreated;
  }, [onProductCreated]);

  useEffect(() => {
    // Connect to Socket.io server
    const socketInstance = io(`${getSocketBaseUrl()}/notifications`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    // Connection events
    socketInstance.on('connect', () => {
      console.log('Socket.io connected');
      setIsConnected(true);
      socketInstance.emit('subscribe', { topic: 'products' });
    });

    socketInstance.on('disconnect', () => {
      console.log('Socket.io disconnected');
      setIsConnected(false);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('Socket.io connection error:', error);
    });

    socketInstance.on('connected', (data) => {
      console.log('Server welcome:', data);
    });

    // Product events
    socketInstance.on('product.created', (notification) => {
      console.log('New product created:', notification);
      setNotifications((prev) => [notification, ...prev]);
      onProductCreatedRef.current?.(notification);
    });

    // Cleanup
    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return { isConnected, notifications };
}
```

#### Global Provider

**Location**: `apps/storefront/src/providers/product-notifications-provider.tsx`

```typescript
'use client';

import { useProductNotifications } from '@/hooks/use-product-notifications';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/query-keys';

export function ProductNotificationsProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  const { notifications, isConnected } = useProductNotifications((notification) => {
    // Show toast
    toast.success(`New product: ${notification.product.name}`, {
      description: 'A new product is now available',
      duration: 5000
    });

    // Invalidate React Query cache
    queryClient.invalidateQueries({ queryKey: queryKeys.products() });
  });

  return (
    <>
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 bg-white border rounded px-3 py-2 text-sm">
          {isConnected ? '🟢 Live' : '🔴 Offline'}
        </div>
      )}
      {children}
    </>
  );
}
```

---

### Client-Side (Admin)

#### Hook Implementation

**Location**: `apps/admin/src/hooks/use-product-notifications.ts`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useProductNotifications() {
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    // ⚠️ Different URL handling - uses full API URL
    const socketInstance = io(
      `${process.env.NEXT_PUBLIC_API_URL}/notifications`, // Includes /api/v1
      {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      },
    );

    socketInstance.on('connect', () => {
      console.log('[Admin] Socket.io connected');
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('[Admin] Socket.io disconnected');
      setIsConnected(false);
    });

    socketInstance.on('product.created', (notification) => {
      console.log('[Admin] New product:', notification);
      setNotifications((prev) => [notification, ...prev]);
    });

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return { isConnected, notifications };
}
```

**Key Difference**: Admin uses full API URL while Storefront strips the `/api/v1` path. This inconsistency causes confusion but both work.

---

## Target Supabase Realtime Architecture

### How Supabase Realtime Works

Supabase Realtime leverages **PostgreSQL logical replication** to broadcast database changes to subscribed clients:

1. **Enable Realtime on Tables**: Set `replica identity` to `FULL` on relevant tables
2. **Client Subscribes to Changes**:
   ```typescript
   supabase
     .channel('products')
     .on(
       'postgres_changes',
       {
         event: 'INSERT',
         schema: 'public',
         table: 'products',
       },
       callback,
     )
     .subscribe();
   ```
3. **Database Change Occurs**: `INSERT INTO products VALUES (...)`
4. **Postgres Triggers**: Logical decoding emits change event via WAL
5. **Supabase Broadcasts**: To all subscribed clients with matching filters
6. **RLS Applied Automatically**: Only clients with permission see the change

### Architecture Benefits

| Component             | Socket.io                       | Supabase Realtime       |
| --------------------- | ------------------------------- | ----------------------- |
| **Broadcast Logic**   | Manual (in code)                | Automatic (DB triggers) |
| **Scaling**           | Single-instance + Redis adapter | Distributed by default  |
| **Auth**              | Manual checks                   | Automatic RLS           |
| **Data Format**       | Custom payload structure        | PostgreSQL row format   |
| **Connection Pool**   | App manages                     | Supabase manages        |
| **Filtering**         | Application-level               | Database-level (RLS)    |
| **Subscription Mgmt** | Rooms + topics                  | Channels                |

### Channel Naming Convention

```typescript
// Global channels (public data)
supabase.channel('products'); // All product changes
supabase.channel('categories'); // All category changes
supabase.channel('inventory'); // All inventory changes

// User-scoped channels (RLS enforced)
supabase.channel(`orders:${userId}`); // Only user's own orders
supabase.channel(`admin:all`); // Admin-only broadcast (RLS filter)

// Admin channels
supabase.channel('admin-dashboard'); // Admin dashboard stats
```

### Automatic RLS Enforcement

**Key Advantage**: Supabase Realtime respects Row Level Security policies automatically.

**Example**:

```typescript
// Customer A subscribes to their orders
const channel = supabase
  .channel(`orders:${customerAId}`)
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      table: 'orders',
      filter: `user_id=eq.${customerAId}`, // Filter sent to Supabase
    },
    callback,
  )
  .subscribe();

// When order for Customer B is updated:
// 1. Does filter match? user_id = 123 (B) vs eq.456 (A) → NO
// 2. Does RLS policy allow? auth.uid() = 456 vs user_id = 123 → NO
// → Customer A never sees Customer B's update ✅
```

---

## Migration Strategy

### Phase Overview

| Phase                          | Duration | Focus                     | Deliverables              |
| ------------------------------ | -------- | ------------------------- | ------------------------- |
| 1. Realtime Setup              | Week 1   | Enable Realtime on tables | DDL scripts, verification |
| 2. Storefront Subscriptions    | Week 1   | Add Realtime listeners    | Product + Order hooks     |
| 3. Admin Subscriptions         | Week 1   | Admin real-time updates   | Dashboard integration     |
| 4. Remove Socket.io (NestJS)   | Week 2   | Clean up gateway code     | Gateway removed           |
| 5. Remove Socket.io (Frontend) | Week 2   | Remove client hooks       | Client code removed       |
| 6. Testing & Validation        | Week 2   | E2E testing               | All tests passing         |
| 7. Rollout                     | Week 2-3 | Staged deployment         | Production cutover        |

### Risk Mitigation

| Risk                       | Impact | Mitigation                          |
| -------------------------- | ------ | ----------------------------------- |
| Realtime not available     | High   | Feature flag + fallback to polling  |
| Missing real-time updates  | Medium | Comprehensive subscription coverage |
| Stale subscriptions        | Medium | Unsubscribe on component unmount    |
| RLS blocks intended access | High   | Verify policies before rollout      |
| Memory leaks               | Medium | Subscription lifecycle management   |

---

## Implementation Plan

### Phase 1: Enable Supabase Realtime on Tables (Week 1)

#### Step 1.1: Set Replica Identity

Supabase Realtime requires `REPLICA IDENTITY FULL` to send both old and new values in change events.

**Why This Matters**: Without `REPLICA IDENTITY FULL`, Realtime only sends the primary key of changed rows, not the full row data. This means your subscribers wouldn't receive the actual product name, price, etc.

```sql
-- supabase/migrations/20260526_enable_realtime.sql

-- Enable FULL replica identity for real-time updates
ALTER TABLE products REPLICA IDENTITY FULL;
ALTER TABLE product_images REPLICA IDENTITY FULL;
ALTER TABLE product_variants REPLICA IDENTITY FULL;
ALTER TABLE categories REPLICA IDENTITY FULL;
ALTER TABLE orders REPLICA IDENTITY FULL;
ALTER TABLE order_items REPLICA IDENTITY FULL;
ALTER TABLE inventory_movements REPLICA IDENTITY FULL;
ALTER TABLE settings REPLICA IDENTITY FULL;

-- Verify replica identity is set
SELECT
  schemaname,
  tablename,
  CASE replident
    WHEN 'd' THEN 'default'
    WHEN 'n' THEN 'nothing'
    WHEN 'f' THEN 'full'
    WHEN 'i' THEN 'index'
  END as replica_identity
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE schemaname = 'public'
ORDER BY tablename;

-- Expected output: replica_identity should be 'full' for all tables
```

#### Step 1.2: Create Realtime Publication (if not auto-enabled)

Supabase typically creates this automatically, but verify it exists:

```sql
-- Check existing publications
SELECT * FROM pg_publication WHERE pubname = 'supabase_realtime';

-- If not found, create it:
CREATE PUBLICATION supabase_realtime FOR TABLE
  products,
  product_images,
  product_variants,
  categories,
  orders,
  order_items,
  inventory_movements,
  settings;

-- Verify tables are in publication
SELECT
  p.pubname,
  n.nspname AS schema,
  c.relname AS table
FROM pg_publication p
JOIN pg_publication_rel pr ON p.oid = pr.prpubid
JOIN pg_class c ON c.oid = pr.prrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE p.pubname = 'supabase_realtime'
ORDER BY schema, table;
```

#### Step 1.3: Verify Supabase Realtime is Enabled

In **Supabase Dashboard**:

1. Go to Database → Replication
2. Verify "Realtime" is enabled
3. Check that publication `supabase_realtime` exists
4. Confirm tables are listed

**Deliverables**:

- [ ] `REPLICA IDENTITY FULL` set on all tables
- [ ] Supabase Realtime publication active
- [ ] Verification queries showing correct configuration
- [ ] Screenshot of Supabase Dashboard showing enabled Realtime

---

### Phase 2: Storefront Realtime Subscriptions (Week 1)

#### Step 2.1: Product Subscriptions Hook

**Objective**: Replace Socket.io `product.created` listener with Supabase Realtime INSERT/UPDATE/DELETE listeners.

```typescript
// apps/storefront/src/hooks/use-product-realtime.ts
'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/query-keys';

export function useProductRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Subscribe to product changes
    const productChannel = supabase
      .channel('products', {
        config: {
          broadcast: { self: false }, // Ignore own changes
        },
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'products',
          filter: 'is_active=eq.true', // Only active products
        },
        (payload) => {
          console.log('New product created:', payload.new);

          // Invalidate product list cache
          queryClient.invalidateQueries({
            queryKey: queryKeys.products(),
          });

          // Show toast notification
          toast.success(`New product: ${payload.new.name}`, {
            description: payload.new.description?.substring(0, 100),
            duration: 5000,
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
          filter: 'is_active=eq.true',
        },
        (payload) => {
          console.log('Product updated:', payload.new);

          // Invalidate product queries (list + detail)
          queryClient.invalidateQueries({
            queryKey: queryKeys.products(),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.productDetail(payload.new.id),
          });

          toast.info(`Product updated: ${payload.new.name}`);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'products',
        },
        (payload) => {
          console.log('Product deleted:', payload.old);

          // Invalidate list (may have been showing this product)
          queryClient.invalidateQueries({
            queryKey: queryKeys.products(),
          });

          toast.info(`Product removed: ${payload.old.name}`);
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Subscribed to product changes');
        } else if (status === 'CLOSED') {
          console.log('❌ Unsubscribed from product changes');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Subscription error');
        }
      });

    // CRITICAL: Cleanup - unsubscribe on unmount
    return () => {
      console.log('Cleaning up product subscription');
      supabase.removeChannel(productChannel);
    };
  }, [queryClient]);
}
```

**Key Features**:

- ✅ Listens for INSERT, UPDATE, DELETE events
- ✅ Filters for active products only (`is_active=eq.true`)
- ✅ Shows toast notifications for each event type
- ✅ Invalidates React Query cache automatically
- ✅ Proper cleanup on component unmount
- ✅ Subscription status logging

---

#### Step 2.2: Order Subscriptions Hook (Customer Tracking) — NEW FEATURE

**Objective**: Add real-time order status updates for customers. This is a **brand new feature** not present in Socket.io.

```typescript
// apps/storefront/src/hooks/use-order-realtime.ts
'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/query-keys';

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: '⏳ Pending',
  CONFIRMED: '✅ Confirmed',
  PROCESSING: '🔄 Processing',
  SHIPPED: '📦 Shipped',
  DELIVERED: '✓ Delivered',
  COMPLETED: '🎉 Completed',
  CANCELLED: '❌ Cancelled',
  REFUNDED: '💰 Refunded',
};

export function useOrderRealtime() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    // Only subscribe if user is authenticated
    if (!isAuthenticated || !user?.id) {
      console.log('Order realtime: Not authenticated, skipping subscription');
      return;
    }

    // Subscribe to user's orders only (RLS enforced)
    const ordersChannel = supabase
      .channel(`orders:${user.id}`, {
        config: { broadcast: { self: false } },
      })
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${user.id}`, // ⚠️ CRITICAL: RLS filter
        },
        (payload) => {
          const oldStatus = payload.old.status;
          const newStatus = payload.new.status;

          console.log(`Order ${payload.new.id}: ${oldStatus} → ${newStatus}`);

          // Invalidate order list and detail cache
          queryClient.invalidateQueries({
            queryKey: queryKeys.userOrders(),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.orderDetail(payload.new.id),
          });

          // Show status change toast (only if status actually changed)
          if (oldStatus !== newStatus) {
            const statusLabel = ORDER_STATUS_LABELS[newStatus] || newStatus;
            toast.info(`Order status: ${statusLabel}`, {
              description: `Order #${payload.new.id.slice(0, 8)} ${statusLabel}`,
              duration: 5000,
              action: {
                label: 'View',
                onClick: () =>
                  (window.location.href = `/orders/${payload.new.id}`),
              },
            });
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_items',
          // NOTE: Cannot directly filter by order's user_id, will receive all
          // but RLS on order_items ensures only user's items are visible
        },
        (payload) => {
          console.log('New item in order:', payload.new);

          // Invalidate orders (may have new items)
          queryClient.invalidateQueries({
            queryKey: queryKeys.userOrders(),
          });
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Subscribed to orders for user ${user.id}`);
        } else if (status === 'CLOSED') {
          console.log(`❌ Unsubscribed from orders for user ${user.id}`);
        }
      });

    // CRITICAL: Cleanup on unmount or user change
    return () => {
      console.log('Cleaning up order subscription');
      supabase.removeChannel(ordersChannel);
    };
  }, [user?.id, isAuthenticated, queryClient]);
}
```

**Why RLS Matters Here**:

```sql
-- Existing RLS policy (from AUTH_MIGRATION.md)
CREATE POLICY "users_read_own_orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);

-- ✅ Supabase Realtime respects this automatically
-- Customer A subscribing with filter user_id=eq.${customerAId}
-- will ONLY receive updates for their own orders
-- even if Realtime broadcasts to all clients
```

**Key Features**:

- ✅ Only authenticated users get order updates
- ✅ RLS filter ensures user only sees their own orders
- ✅ Status change notifications with emoji icons
- ✅ Toast action button to view order
- ✅ Cache invalidation on status changes
- ✅ Cleanup on logout (via dependency on `user?.id`)

---

#### Step 2.3: Unified Realtime Provider

**Objective**: Single provider that initializes all subscriptions.

```typescript
// apps/storefront/src/providers/realtime-provider.tsx
'use client';

import { useProductRealtime } from '@/hooks/use-product-realtime';
import { useOrderRealtime } from '@/hooks/use-order-realtime';

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  // Initialize all subscriptions
  useProductRealtime();  // All users get product updates
  useOrderRealtime();    // Only authenticated users get order updates

  return <>{children}</>;
}
```

**Usage in Root Layout**:

```typescript
// apps/storefront/src/app/layout.tsx
import { RealtimeProvider } from '@/providers/realtime-provider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RealtimeProvider>  {/* ← Add here */}
              {children}
            </RealtimeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
```

**Deliverables**:

- [ ] `use-product-realtime.ts` hook created and tested
- [ ] `use-order-realtime.ts` hook created and tested
- [ ] `realtime-provider.tsx` created
- [ ] Integrated into root layout
- [ ] Toast notifications working
- [ ] React Query cache invalidation verified
- [ ] Proper cleanup on unmount verified

**Files to Create**:

- `apps/storefront/src/hooks/use-product-realtime.ts`
- `apps/storefront/src/hooks/use-order-realtime.ts`
- `apps/storefront/src/providers/realtime-provider.tsx`

**Files to Update**:

- `apps/storefront/src/app/layout.tsx`

---

### Phase 3: Admin Realtime Subscriptions (Week 1)

#### Step 3.1: Admin Dashboard Real-Time Stats

**Objective**: Show real-time order and product updates in admin dashboard.

```typescript
// apps/admin/src/hooks/use-admin-realtime.ts
'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/query-keys';

export function useAdminRealtime() {
  const queryClient = useQueryClient();
  const { role } = useAuthStore();

  useEffect(() => {
    // Only admins get real-time updates
    if (!role || !['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role)) {
      console.log('Admin realtime: Not an admin, skipping');
      return;
    }

    // Request browser notification permission on first admin login
    if ('Notification' in window && Notification.permission === 'default') {
      console.log('[Admin] Requesting notification permission...');
      Notification.requestPermission().then((permission) => {
        console.log('[Admin] Notification permission:', permission);
      });
    }

    // Channel 1: Product changes (all admins see)
    const productsChannel = supabase
      .channel('admin-products')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'products',
        },
        (payload) => {
          const eventType = payload.eventType;
          const data = payload.new || payload.old;

          console.log(`[Admin] Product ${eventType}:`, data);

          // Invalidate product queries
          queryClient.invalidateQueries({
            queryKey: queryKeys.products(),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.adminProductsList(),
          });

          // Could show admin notification here
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Admin] ✅ Subscribed to product changes');
        }
      });

    // Channel 2: Order status changes (all admins see)
    const ordersChannel = supabase
      .channel('admin-orders')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          // No filter - admins see all order updates
        },
        (payload) => {
          const oldStatus = payload.old.status;
          const newStatus = payload.new.status;

          if (oldStatus !== newStatus) {
            console.log(
              `[Admin] Order ${payload.new.id}: ${oldStatus} → ${newStatus}`,
            );
          }

          // Invalidate order queries and dashboard stats
          queryClient.invalidateQueries({
            queryKey: queryKeys.orders(),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.dashboardStats(),
          });
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Admin] ✅ Subscribed to order changes');
        }
      });

    // Channel 3: Inventory changes (managers and up)
    const inventoryChannel = supabase
      .channel('admin-inventory')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'inventory_movements',
          filter: 'quantity=lt.0', // Stock decreases
        },
        (payload) => {
          console.log('[Admin] Stock decrease alert:', payload.new);

          // Invalidate dashboard low stock widget
          queryClient.invalidateQueries({
            queryKey: queryKeys.dashboardLowStock(),
          });
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Admin] ✅ Subscribed to inventory changes');
        }
      });

    // Channel 4: New order creation (all admins)
    const newOrdersChannel = supabase
      .channel('admin-new-orders')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          console.log('[Admin] New order created:', payload.new.id);

          // Could show desktop notification here
          if (
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            new Notification('New Order', {
              body: `Order #${payload.new.id.slice(0, 8)} - ${payload.new.total_amount} XAF`,
              icon: '/icon-192.png',
            });
          }

          // Invalidate queries
          queryClient.invalidateQueries({
            queryKey: queryKeys.orders(),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.dashboardStats(),
          });
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Admin] ✅ Subscribed to new orders');
        }
      });

    // CRITICAL: Cleanup all channels
    return () => {
      console.log('[Admin] Cleaning up subscriptions');
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(inventoryChannel);
      supabase.removeChannel(newOrdersChannel);
    };
  }, [role, queryClient]);
}
```

**Usage in Admin App Root**:

```typescript
// apps/admin/src/app/layout.tsx
import { RealtimeProvider } from '@/providers/realtime-provider';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RealtimeProvider>  {/* Adds admin subscriptions */}
              {children}
            </RealtimeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
```

**Key Features**:

- ✅ Four separate channels (products, orders, inventory, new orders)
- ✅ Browser notifications for new orders (with automatic permission request)
- ✅ Role-based filtering (only admins get updates)
- ✅ Dashboard stats auto-refresh on changes
- ✅ Low stock alerts for inventory movements
- ✅ Proper cleanup on unmount or role change

**Admin Realtime Provider**:

```typescript
// apps/admin/src/providers/realtime-provider.tsx
'use client';

import { useAdminRealtime } from '@/hooks/use-admin-realtime';
import { useAuthStore } from '@/stores/auth-store';

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { role } = useAuthStore();

  // Only initialize admin subscriptions if user has admin role
  // Note: Browser notification permission will be requested automatically on first load
  if (role && ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role)) {
    useAdminRealtime();
  }

  return <>{children}</>;
}
```

**Deliverables**:

- [ ] `use-admin-realtime.ts` hook created
- [ ] Product change subscriptions working
- [ ] Order status subscriptions working
- [ ] Inventory alert subscriptions working
- [ ] New order notifications (browser notifications)
- [ ] Browser notification permission request flow implemented
- [ ] Role-based filtering (MANAGER+)
- [ ] Dashboard stats refresh on updates
- [ ] Proper cleanup on unmount

**Files to Create**:

- `apps/admin/src/hooks/use-admin-realtime.ts`
- `apps/admin/src/providers/realtime-provider.tsx`

**Files to Update**:

- `apps/admin/src/app/layout.tsx`

---

### Phase 4: Remove Socket.io from NestJS (Week 2)

#### Step 4.1: Remove Gateway Files

**Objective**: Delete all Socket.io server code from NestJS API.

```bash
# Delete Socket.io gateway
rm apps/api/src/modules/notifications/notifications.gateway.ts

# Verify no references remain
grep -r "NotificationsGateway" apps/api/src/
grep -r "emitProduct" apps/api/src/
grep -r "@WebSocketGateway" apps/api/src/
```

#### Step 4.2: Update Notifications Module

**File**: `apps/api/src/modules/notifications/notifications.module.ts`

**Before**:

```typescript
import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway'; // ← Remove
import { PrismaModule } from '@/common/services/prisma.service';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsGateway, // ← Remove
  ],
  exports: [NotificationsGateway], // ← Remove
})
export class NotificationsModule {}
```

**After**:

```typescript
import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PrismaModule } from '@/common/services/prisma.service';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
```

#### Step 4.3: Remove Socket.io Emit Calls from Services

**File**: `apps/api/src/modules/products/products.service.ts`

**Before** (line 349):

```typescript
// Create product
const product = await this.prisma.product.create({ data: productData });

// Emit Socket.io event
this.notificationsGateway.emitProductCreated({
  type: 'product.created',
  product: {
    id: product.id,
    name: product.name,
    slug: product.slug,
    price: product.price,
    image: product.images?.[0]?.url,
    categoryId: product.category_id,
    categoryName: category?.name,
  },
  timestamp: new Date(),
});

return product;
```

**After**:

```typescript
// Create product
const product = await this.prisma.product.create({ data: productData });

// ✅ Supabase Realtime will detect this INSERT automatically
// No manual emit needed!

return product;
```

**Also remove constructor injection**:

**Before**:

```typescript
constructor(
  private prisma: PrismaService,
  private notificationsGateway: NotificationsGateway  // ← Remove
) {}
```

**After**:

```typescript
constructor(
  private prisma: PrismaService
) {}
```

#### Step 4.4: Remove Socket.io Dependencies

**File**: `apps/api/package.json`

**Before**:

```json
{
  "dependencies": {
    "@nestjs/websockets": "^11.2.3",
    "socket.io": "^4.7.2",
    ...
  }
}
```

**After**:

```json
{
  "dependencies": {
    // Removed @nestjs/websockets and socket.io
    ...
  }
}
```

**Run cleanup**:

```bash
cd apps/api
pnpm remove @nestjs/websockets socket.io
pnpm install
```

#### Step 4.5: Verify Build

```bash
# Build API
pnpm nx build api

# Check for errors
pnpm nx lint api

# Run tests
pnpm nx test api
```

**Deliverables**:

- [ ] `notifications.gateway.ts` deleted
- [ ] `notifications.module.ts` updated (gateway removed)
- [ ] `products.service.ts` updated (emit call removed)
- [ ] Constructor injection removed from services
- [ ] Socket.io dependencies removed from package.json
- [ ] API builds without errors
- [ ] All tests passing

**Files to Delete**:

- `apps/api/src/modules/notifications/notifications.gateway.ts`

**Files to Update**:

- `apps/api/src/modules/notifications/notifications.module.ts`
- `apps/api/src/modules/products/products.service.ts`
- `apps/api/package.json`

---

### Phase 5: Remove Socket.io from Frontends (Week 2)

#### Step 5.1: Remove Storefront Socket.io Client

**Delete old hooks and providers**:

```bash
# Delete old Socket.io hook
rm apps/storefront/src/hooks/use-product-notifications.ts

# Delete old Socket.io provider
rm apps/storefront/src/providers/product-notifications-provider.tsx
```

**Update root layout** - Replace old provider with new one:

**File**: `apps/storefront/src/app/layout.tsx`

**Before**:

```typescript
import { ProductNotificationsProvider } from '@/providers/product-notifications-provider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ProductNotificationsProvider>  {/* Socket.io */}
          {children}
        </ProductNotificationsProvider>
      </body>
    </html>
  );
}
```

**After**:

```typescript
import { RealtimeProvider } from '@/providers/realtime-provider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <RealtimeProvider>  {/* Supabase Realtime */}
          {children}
        </RealtimeProvider>
      </body>
    </html>
  );
}
```

**Remove Socket.io dependencies**:

```bash
cd apps/storefront
pnpm remove socket.io-client
pnpm install
```

**Verify build**:

```bash
pnpm nx build storefront
```

---

#### Step 5.2: Remove Admin Socket.io Client

**Delete old hook**:

```bash
# Delete old Socket.io hook
rm apps/admin/src/hooks/use-product-notifications.ts
```

**Update root layout** (if Socket.io was integrated):

**File**: `apps/admin/src/app/layout.tsx`

Ensure it uses the new `RealtimeProvider` created in Phase 3.

**Remove Socket.io dependencies**:

```bash
cd apps/admin
pnpm remove socket.io-client
pnpm install
```

**Verify build**:

```bash
pnpm nx build admin
```

---

**Deliverables**:

- [ ] Old Socket.io hooks deleted from both apps
- [ ] Old Socket.io providers deleted
- [ ] Root layouts updated to use RealtimeProvider
- [ ] Socket.io packages removed from both apps
- [ ] Storefront builds without errors
- [ ] Admin builds without errors
- [ ] No Socket.io references in codebase

**Files to Delete**:

- `apps/storefront/src/hooks/use-product-notifications.ts`
- `apps/storefront/src/providers/product-notifications-provider.tsx`
- `apps/admin/src/hooks/use-product-notifications.ts`

**Files to Update**:

- `apps/storefront/src/app/layout.tsx`
- `apps/storefront/package.json`
- `apps/admin/package.json`

---

## Code Examples

### Complete Subscription Pattern (Best Practice)

```typescript
// Subscription lifecycle management
useEffect(() => {
  // 1. Create channel with unique name
  const channel = supabase.channel(`resource:${resourceId}`);

  // 2. Add event listeners
  channel.on('postgres_changes', { ... }, callback);

  // 3. Subscribe
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('Connected');
    }
  });

  // 4. CRITICAL: Cleanup
  return () => {
    supabase.removeChannel(channel);
  };
}, [resourceId]); // Re-subscribe when ID changes
```

### Unsubscribe Pattern (Cleanup)

**Per-Component Unsubscribe**:

```typescript
export function OrderDetailPage({ orderId }: { orderId: string }) {
  useEffect(() => {
    const orderChannel = supabase
      .channel(`order:${orderId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        table: 'orders',
        filter: `id=eq.${orderId}`
      }, callback)
      .subscribe();

    // CRITICAL: Cleanup on component unmount
    return () => {
      console.log(`Unsubscribing from order ${orderId}`);
      supabase.removeChannel(orderChannel);  // ← Removes listener
    };
  }, [orderId]);

  return <div>Order Details...</div>;
}
```

**On Logout (Auth Store)**:

```typescript
export const useAuthStore = create<AuthState>((set) => ({
  logout: async () => {
    // 1. Close all Supabase subscriptions
    console.log('Closing all Realtime subscriptions');
    await supabase.removeAllChannels(); // ← Stops all listeners

    // 2. Sign out
    await supabase.auth.signOut();

    // 3. Clear state
    set({ user: null, session: null, isAuthenticated: false });
  },
}));
```

### Memory Leak Detection

```typescript
// Monitor active channels (dev mode only)
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    // @ts-ignore - Access internal channels list
    const activeChannels = supabase.getChannels?.() || [];
    console.log('Active Realtime channels:', activeChannels.length);

    if (activeChannels.length > 10) {
      console.warn('⚠️ Potential memory leak - too many active channels');
    }
  }, 30000); // Check every 30 seconds
}
```

---

## Channel Subscriptions Matrix

Complete mapping of database events to Realtime subscriptions:

| Channel            | Table               | Event                | Filter           | Scope        | Who Sees       | RLS Enforced?     |
| ------------------ | ------------------- | -------------------- | ---------------- | ------------ | -------------- | ----------------- |
| `products`         | products            | INSERT/UPDATE/DELETE | is_active=true   | Global       | Everyone       | Yes (public read) |
| `orders:{userId}`  | orders              | UPDATE               | user_id={userId} | User-scoped  | Only that user | Yes (own orders)  |
| `admin-products`   | products            | \*                   | None             | Admin-only   | Admins only    | Yes (RBAC)        |
| `admin-orders`     | orders              | INSERT/UPDATE        | None             | Admin-scoped | Admins only    | Yes (RBAC)        |
| `admin-new-orders` | orders              | INSERT               | None             | Admin-scoped | Admins only    | Yes (RBAC)        |
| `admin-inventory`  | inventory_movements | INSERT               | quantity<0       | Admin-scoped | Managers+      | Yes (RBAC)        |

### Event Mapping from Socket.io to Supabase Realtime

| Old Socket.io Event              | New Realtime Subscription            | Trigger                        |
| -------------------------------- | ------------------------------------ | ------------------------------ |
| `product.created`                | `INSERT` on `products`               | `CREATE` SQL                   |
| `product.updated` (commented)    | `UPDATE` on `products`               | `UPDATE` SQL                   |
| `product.deleted` (commented)    | `DELETE` on `products`               | `DELETE/UPDATE deleted_at` SQL |
| `order.status-changed` (missing) | `UPDATE` on `orders` filter `status` | `UPDATE orders SET status`     |

### RLS Policy Requirements

**For customer subscriptions to work**:

```sql
-- Customers read own orders
CREATE POLICY "users_read_own_orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);

-- ✅ Realtime respects this automatically
```

**For admin subscriptions to work**:

```sql
-- Admins read all orders
CREATE POLICY "admin_read_all_orders" ON orders
  FOR SELECT USING (
    (auth.jwt() -> 'app_metadata' ->> 'role')::text IN ('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  );

-- ✅ Realtime respects this automatically
```

---

## Testing Strategy

### Unit Tests

**Hook Testing**:

```typescript
// apps/storefront/__tests__/hooks/use-product-realtime.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { useProductRealtime } from '@/hooks/use-product-realtime';
import { supabase } from '@/lib/supabase';

describe('useProductRealtime', () => {
  it('subscribes to product changes on mount', () => {
    const channelSpy = vi.spyOn(supabase, 'channel');

    renderHook(() => useProductRealtime());

    expect(channelSpy).toHaveBeenCalledWith('products', expect.any(Object));
  });

  it('invalidates product queries on INSERT', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useProductRealtime());

    // Simulate postgres_changes event
    const callback = channelSpy.mock.calls[0][0].on.mock.calls[0][2];
    callback({ new: { id: '123', name: 'Test Product' } });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.products(),
      });
    });
  });

  it('unsubscribes on unmount', () => {
    const removeSpy = vi.spyOn(supabase, 'removeChannel');

    const { unmount } = renderHook(() => useProductRealtime());
    unmount();

    expect(removeSpy).toHaveBeenCalled();
  });
});
```

### Integration Tests

**Realtime Event Flow**:

```typescript
// tests/realtime/product-updates.test.ts
describe('Product Real-Time Updates', () => {
  it('broadcasts product creation to subscribers', async () => {
    // 1. Subscribe
    const callback = vi.fn();
    const channel = supabase
      .channel('products-test')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'products',
        },
        callback,
      )
      .subscribe();

    // Wait for subscription
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 2. Insert product via admin client
    const { data: product } = await supabaseAdmin
      .from('products')
      .insert({
        name: 'Test Product',
        sku: 'TEST-001',
        price: 100,
        type: 'PHYSICAL',
        is_active: true,
      })
      .select()
      .single();

    // 3. Verify callback fired
    await waitFor(
      () => {
        expect(callback).toHaveBeenCalled();
        expect(callback.mock.calls[0][0].new.name).toBe('Test Product');
      },
      { timeout: 5000 },
    );

    // 4. Cleanup
    await supabase.removeChannel(channel);
    await supabaseAdmin.from('products').delete().eq('id', product.id);
  });

  it('respects RLS - customer only sees own orders', async () => {
    // 1. Create two customers
    const customerA = await createTestUser('customer-a@test.com');
    const customerB = await createTestUser('customer-b@test.com');

    // 2. Customer A subscribes
    const supabaseA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${customerA.token}` } },
    });

    const callback = vi.fn();
    const channel = supabaseA
      .channel(`orders:${customerA.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${customerA.id}`,
        },
        callback,
      )
      .subscribe();

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 3. Update order for Customer B
    const orderB = await createTestOrder(customerB.id);
    await supabaseAdmin
      .from('orders')
      .update({ status: 'SHIPPED' })
      .eq('id', orderB.id);

    // 4. Verify Customer A doesn't see it
    await new Promise((resolve) => setTimeout(resolve, 2000));
    expect(callback).not.toHaveBeenCalled();

    // 5. Update order for Customer A
    const orderA = await createTestOrder(customerA.id);
    await supabaseAdmin
      .from('orders')
      .update({ status: 'SHIPPED' })
      .eq('id', orderA.id);

    // 6. Verify Customer A DOES see it
    await waitFor(() => {
      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].new.id).toBe(orderA.id);
    });

    // Cleanup
    await supabase.removeChannel(channel);
  });
});
```

### E2E Tests (Playwright)

**Customer Order Tracking**:

```typescript
// tests/e2e/realtime-orders.spec.ts
import { test, expect } from '@playwright/test';

test('customer sees order status update in real-time', async ({
  page,
  context,
}) => {
  // 1. Customer signs in and views orders
  await page.goto('/login');
  await page.fill('input[type="email"]', 'customer@test.com');
  await page.fill('input[type="password"]', 'password');
  await page.click('button:has-text("Login")');

  await page.goto('/my-orders');

  // 2. Wait for initial order status
  await expect(page.locator('text=Processing')).toBeVisible();

  // 3. Admin updates order status in separate browser
  const adminPage = await context.newPage();
  await adminPage.goto('/admin/login');
  await adminPage.fill('input[type="email"]', 'admin@test.com');
  await adminPage.fill('input[type="password"]', 'admin123');
  await adminPage.click('button:has-text("Login")');

  await adminPage.goto('/admin/orders');
  await adminPage.click(
    'tr:has-text("customer@test.com") button:has-text("Update Status")',
  );
  await adminPage.selectOption('select[name="status"]', 'SHIPPED');
  await adminPage.click('button:has-text("Save")');

  // 4. Customer sees update without page refresh
  await expect(page.locator('text=Shipped')).toBeVisible({ timeout: 5000 });

  // 5. Toast notification appears
  await expect(page.locator('.toast:has-text("Order status")')).toBeVisible();
});

test('admin dashboard shows live product count', async ({ page, context }) => {
  // 1. Admin views dashboard
  await page.goto('/admin/login');
  await page.fill('input[type="email"]', 'admin@test.com');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button:has-text("Login")');

  await page.goto('/admin/dashboard');

  // 2. Get initial product count
  const initialCount = await page
    .locator('[data-testid="product-count"]')
    .textContent();

  // 3. Create product in separate tab
  const productPage = await context.newPage();
  await productPage.goto('/admin/products/new');
  await productPage.fill('input[name="name"]', 'Live Test Product');
  await productPage.fill('input[name="sku"]', 'LIVE-001');
  await productPage.fill('input[name="price"]', '100');
  await productPage.click('button:has-text("Create")');

  // 4. Dashboard count updates automatically
  await expect(page.locator('[data-testid="product-count"]')).not.toHaveText(
    initialCount,
    { timeout: 5000 },
  );
});
```

**Deliverables**:

- [ ] Unit tests for each hook (subscription, callback, cleanup)
- [ ] Integration tests for RLS enforcement
- [ ] E2E test for customer order tracking
- [ ] E2E test for admin dashboard live updates
- [ ] Test coverage > 80%
- [ ] All tests passing in CI

---

## Rollout Plan

### Stage 1: Canary (10% Traffic) — Week 2

**Objective**: Validate Realtime in production with limited exposure.

**Steps**:

1. Deploy Realtime provider alongside Socket.io (both active)
2. Feature flag: `NEXT_PUBLIC_USE_REALTIME=true` (10% of users)
3. Monitor logs:
   - Connection success rate
   - Update delivery latency
   - RLS enforcement
   - Error rates
4. Metrics to track:
   - WebSocket connection stability
   - Message delivery time (DB write → client receives)
   - Memory usage (check for subscription leaks)

**Success Criteria**:

- ✅ No error spike (< 1% error rate)
- ✅ Update latency < 500ms (p95)
- ✅ Connection success rate > 99%
- ✅ No RLS policy violations

**Rollback Trigger**:

- Error rate > 5%
- Connection failures > 10%
- RLS violations detected

---

### Stage 2: Expand (50% Traffic) — Week 3

**Objective**: Scale up and validate stability under load.

**Steps**:

1. Increase feature flag to 50%
2. Remove Socket.io listeners (keep gateway running as fallback)
3. Monitor for 48 hours
4. Review user feedback (customer support tickets)

**Success Criteria**:

- ✅ Metrics stable (same as Stage 1)
- ✅ No user complaints about missing notifications
- ✅ Memory usage stable over 48h

**Rollback Trigger**:

- Performance degradation vs Stage 1
- User complaints > 5

---

### Stage 3: GA (100% Traffic) — Week 3

**Objective**: Full cutover to Supabase Realtime.

**Steps**:

1. Set feature flag to 100%
2. Deploy updated API without Socket.io gateway
3. Deploy frontends without Socket.io client
4. Monitor production for 7 days

**Success Criteria**:

- ✅ All metrics stable
- ✅ No Socket.io references in code
- ✅ No user complaints
- ✅ Order tracking feature used by customers

---

### Stage 4: Cleanup — Week 4

**Objective**: Remove all legacy code and dependencies.

**Steps**:

1. Remove Socket.io from `package.json` (all apps)
2. Delete old Socket.io files (confirmed in Phase 4-5)
3. Update documentation
4. Archive old Socket.io code in Git history

**Success Criteria**:

- ✅ No Socket.io dependencies
- ✅ No Socket.io references in codebase
- ✅ Documentation updated

---

### Feature Flags

**Environment Variables**:

```bash
# Supabase Edge Functions
SUPABASE_REALTIME_ENABLED=true

# Frontend Apps (Storefront + Admin)
NEXT_PUBLIC_USE_REALTIME=true  # Toggle for gradual rollout
```

**Implementation**:

```typescript
// apps/storefront/src/providers/realtime-provider.tsx
export function RealtimeProvider({ children }) {
  const useRealtime = process.env.NEXT_PUBLIC_USE_REALTIME === 'true';

  if (useRealtime) {
    useProductRealtime();
    useOrderRealtime();
  } else {
    // Fall back to Socket.io (legacy)
    useProductNotifications();  // Old hook
  }

  return <>{children}</>;
}
```

---

### Rollback Plan

**If critical issues arise during any stage**:

1. **Immediate Action**: Set `NEXT_PUBLIC_USE_REALTIME=false` in env vars
2. **Frontend Revert**: Keep Socket.io provider alongside Realtime provider
3. **Backend Revert**: Keep Socket.io gateway and emit calls active
4. **No Database Rollback Needed**: `REPLICA IDENTITY FULL` doesn't break existing data
5. **Investigation**: Review logs, RLS policies, subscription filters
6. **Fix & Re-deploy**: Address root cause before re-enabling

**Rollback is safe because**:

- Database changes (REPLICA IDENTITY) don't affect non-Realtime queries
- RLS policies only impact Realtime subscriptions
- Socket.io and Realtime can coexist temporarily

---

## Troubleshooting

### Issue: No Real-Time Updates Received

**Symptoms**:

- Subscriptions show `SUBSCRIBED` status
- Database changes occur
- Client doesn't receive callback

**Diagnosis**:

```typescript
// Check subscription status
const channel = supabase.channel('products');
channel
  .on('postgres_changes', { ... }, callback)
  .subscribe((status) => {
    console.log('Subscription status:', status);  // Should be SUBSCRIBED
  });

// Check Supabase Realtime is enabled
// Dashboard → Database → Replication → Realtime (should be ON)
```

**Solutions**:

1. Verify `REPLICA IDENTITY FULL` is set:
   ```sql
   SELECT relname, relreplident
   FROM pg_class
   WHERE relname = 'products';
   -- relreplident should be 'f' (FULL)
   ```
2. Check Supabase Realtime is enabled in project settings
3. Verify table is in `supabase_realtime` publication:
   ```sql
   SELECT * FROM pg_publication_rel
   WHERE prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime');
   ```
4. Check JWT token is valid:
   ```typescript
   const {
     data: { session },
   } = await supabase.auth.getSession();
   console.log('Session:', session);
   ```

---

### Issue: Subscription Not Triggering Callback

**Symptoms**:

- Subscription status is `SUBSCRIBED`
- Filter might not match event
- Callback never fires

**Diagnosis**:

```typescript
// Test with wildcard filter
channel.on(
  'postgres_changes',
  {
    event: '*', // All events
    schema: 'public',
    table: 'products',
    // No filter
  },
  (payload) => {
    console.log('Any change:', payload);
  },
);
```

**Common Filter Issues**:

```typescript
// ❌ WRONG - Filter column doesn't match
.on('postgres_changes', {
  event: 'UPDATE',
  filter: 'is_active=eq.true'  // Watches `is_active` column
}, callback);

// Database update
UPDATE products SET status = 'active' WHERE id = 123;  // Changes `status`, not `is_active`
// → Filter doesn't match, callback won't fire

// ✅ CORRECT
.on('postgres_changes', {
  event: 'UPDATE',
  filter: 'status=eq.active'  // Watches `status` column
}, callback);
```

**Solutions**:

1. Remove filter temporarily to test: `.on('postgres_changes', { event: 'UPDATE', table: 'products' }, ...)`
2. Verify filter column names match Postgres schema exactly
3. Check event type (INSERT vs UPDATE vs DELETE)
4. Test with manual SQL:
   ```sql
   INSERT INTO products (name, sku, price, type) VALUES ('Test', 'TEST-001', 100, 'PHYSICAL');
   ```

---

### Issue: Customer Sees Another Customer's Order

**Symptoms**:

- Customer A receives updates for Customer B's order
- RLS bypass detected

**Diagnosis**:

```sql
-- Check RLS policy exists
SELECT * FROM pg_policies WHERE tablename = 'orders';

-- Check policy predicate
SELECT policyname, qual FROM pg_policies
WHERE tablename = 'orders' AND policyname = 'users_read_own_orders';

-- Test policy manually
SET LOCAL jwt.claims.sub = '<customer-a-id>';
SELECT * FROM orders WHERE user_id = '<customer-b-id>';
-- Should return empty (RLS blocks)
```

**Solutions**:

1. Verify RLS policy exists:
   ```sql
   CREATE POLICY "users_read_own_orders" ON orders
     FOR SELECT USING (auth.uid() = user_id);
   ```
2. Ensure filter is passed to Realtime:
   ```typescript
   filter: `user_id=eq.${user.id}`; // ← Must match
   ```
3. Check JWT contains correct user ID:
   ```typescript
   const {
     data: { user },
   } = await supabase.auth.getUser();
   console.log('User ID:', user.id);
   ```
4. Verify Supabase Auth session is valid

---

### Issue: Memory Leak - Subscriptions Not Cleaned Up

**Symptoms**:

- Memory usage grows over time
- Too many active channels
- Browser becomes slow

**Diagnosis**:

```typescript
// Check active channels
setInterval(() => {
  // @ts-ignore - Internal API
  const channels = supabase.getChannels?.() || [];
  console.log('Active channels:', channels.length);

  if (channels.length > 10) {
    console.warn('⚠️ Memory leak suspected');
  }
}, 10000);
```

**Common Causes**:

```typescript
// ❌ WRONG - Missing cleanup
useEffect(() => {
  const channel = supabase.channel('products')
    .on('postgres_changes', { ... }, callback)
    .subscribe();

  // NO CLEANUP!
}, []);

// ✅ CORRECT - Cleanup on unmount
useEffect(() => {
  const channel = supabase.channel('products')
    .on('postgres_changes', { ... }, callback)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);  // ← Required
  };
}, []);
```

**Solutions**:

1. Ensure cleanup in every `useEffect`:
   ```typescript
   return () => supabase.removeChannel(channel);
   ```
2. Call on logout:
   ```typescript
   await supabase.removeAllChannels();
   ```
3. Test component mount/unmount cycles:
   ```typescript
   test('cleans up subscription on unmount', () => {
     const { unmount } = renderHook(() => useProductRealtime());
     unmount();
     expect(supabase.getChannels()).toHaveLength(0);
   });
   ```

---

### Issue: Subscription Status Stuck on "CONNECTING"

**Symptoms**:

- Subscription never reaches `SUBSCRIBED`
- Status remains `CONNECTING` or `CHANNEL_ERROR`

**Diagnosis**:

```typescript
channel.subscribe((status, error) => {
  console.log('Status:', status);
  if (error) {
    console.error('Error:', error);
  }
});
```

**Solutions**:

1. Check network connectivity (WebSocket port 443 open)
2. Verify Supabase project URL is correct
3. Check CORS settings in Supabase dashboard
4. Verify JWT token is valid (not expired)
5. Try recreating channel with different name
6. Check Supabase status page: https://status.supabase.com

---

### Issue: Toast Notifications Not Appearing

**Symptoms**:

- Realtime updates received (console logs show)
- Toast doesn't appear

**Diagnosis**:

```typescript
// Test toast directly
import { toast } from 'sonner';
toast.success('Test notification');
```

**Solutions**:

1. Verify `<Toaster />` is in root layout:

   ```typescript
   // apps/storefront/src/app/layout.tsx
   import { Toaster } from 'sonner';

   export default function RootLayout({ children }) {
     return (
       <html>
         <body>
           {children}
           <Toaster />  {/* ← Required */}
         </body>
       </html>
     );
   }
   ```

2. Check payload structure:
   ```typescript
   .on('postgres_changes', { ... }, (payload) => {
     console.log('Payload:', payload.new);  // Verify structure
     toast.success(`Product: ${payload.new.name}`);
   });
   ```

---

### Issue: Browser Notifications Not Appearing (Admin)

**Symptoms**:

- Realtime updates received (console logs show)
- Browser notifications don't appear for new orders

**Diagnosis**:

```typescript
// Check notification permission
console.log('Notification permission:', Notification.permission);
// Should be 'granted'

// Test notification directly
if (Notification.permission === 'granted') {
  new Notification('Test', { body: 'Test notification' });
}
```

**Solutions**:

1. **Permission not granted**: Browser blocks notifications by default
   ```typescript
   // Request permission manually (already in useAdminRealtime hook)
   if (Notification.permission === 'default') {
     await Notification.requestPermission();
   }
   ```
2. **Permission denied**: User blocked notifications
   - User must manually enable notifications in browser settings
   - Chrome: Settings → Privacy → Site Settings → Notifications
   - Firefox: Preferences → Privacy → Permissions → Notifications
3. **HTTPS required**: Browser notifications require secure context
   - Works on `localhost` in development
   - Requires HTTPS in production
4. **Browser support**: Check browser compatibility
   ```typescript
   if (!('Notification' in window)) {
     console.warn('Browser does not support notifications');
   }
   ```
5. **Focus/visibility**: Some browsers require the tab to be active
   - Notifications may be queued if tab is not focused
   - Check browser notification center/tray

---

## Appendix

### Complete File Checklist

**Files to Create**:

- [ ] `supabase/migrations/20260526_enable_realtime.sql`
- [ ] `apps/storefront/src/hooks/use-product-realtime.ts`
- [ ] `apps/storefront/src/hooks/use-order-realtime.ts`
- [ ] `apps/storefront/src/providers/realtime-provider.tsx`
- [ ] `apps/admin/src/hooks/use-admin-realtime.ts`
- [ ] `apps/admin/src/providers/realtime-provider.tsx`

**Files to Update**:

- [ ] `apps/api/src/modules/notifications/notifications.module.ts`
- [ ] `apps/api/src/modules/products/products.service.ts`
- [ ] `apps/api/package.json`
- [ ] `apps/storefront/src/app/layout.tsx`
- [ ] `apps/storefront/package.json`
- [ ] `apps/admin/src/app/layout.tsx`
- [ ] `apps/admin/package.json`

**Files to Delete**:

- [ ] `apps/api/src/modules/notifications/notifications.gateway.ts`
- [ ] `apps/storefront/src/hooks/use-product-notifications.ts`
- [ ] `apps/storefront/src/providers/product-notifications-provider.tsx`
- [ ] `apps/admin/src/hooks/use-product-notifications.ts`

---

### Environment Variables Checklist

**Supabase Project** (already set from AUTH_MIGRATION.md):

- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`

**Storefront** (`apps/storefront/.env.local`):

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `NEXT_PUBLIC_USE_REALTIME=true` (feature flag)

**Admin** (`apps/admin/.env.local`):

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `NEXT_PUBLIC_USE_REALTIME=true` (feature flag)

---

### SQL Verification Queries

**Check Replica Identity**:

```sql
SELECT
  n.nspname AS schema,
  c.relname AS table,
  CASE c.relreplident
    WHEN 'd' THEN 'default'
    WHEN 'n' THEN 'nothing'
    WHEN 'f' THEN 'full'
    WHEN 'i' THEN 'index'
  END AS replica_identity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relname;
```

**Check Realtime Publication**:

```sql
SELECT
  p.pubname,
  n.nspname || '.' || c.relname AS table_name
FROM pg_publication p
JOIN pg_publication_rel pr ON p.oid = pr.prpubid
JOIN pg_class c ON c.oid = pr.prrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE p.pubname = 'supabase_realtime'
ORDER BY table_name;
```

**Test RLS Enforcement**:

```sql
-- Set session as customer A
SET LOCAL jwt.claims.sub = '<customer-a-uuid>';

-- Try to read customer B's order
SELECT * FROM orders WHERE user_id = '<customer-b-uuid>';
-- Should return empty (RLS blocks)

-- Try to read own order
SELECT * FROM orders WHERE user_id = '<customer-a-uuid>';
-- Should return rows (RLS allows)
```

---

### Migration Timeline Summary

| Week     | Phase              | Key Deliverables                         |
| -------- | ------------------ | ---------------------------------------- |
| Week 1   | Setup + Storefront | DB setup, storefront hooks, provider     |
| Week 1   | Admin              | Admin hooks, dashboard integration       |
| Week 2   | Cleanup            | Remove Socket.io from NestJS + frontends |
| Week 2   | Testing            | E2E tests, RLS validation                |
| Week 2-3 | Rollout            | Canary → 50% → 100%                      |
| Week 3-4 | Finalize           | Cleanup, documentation                   |

---

**Document Version:** 1.0  
**Last Updated:** May 26, 2026  
**Next Review:** After Phase 2 completion

**End of Document**
