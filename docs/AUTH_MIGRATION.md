# Supabase Auth & RLS Migration Plan

**Version:** 1.0  
**Date:** May 26, 2026  
**Status:** Planning Phase  
**Scope:** JWT/Passport → Supabase Auth + RLS for Edge Functions & Frontend Apps

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Authentication Architecture](#current-authentication-architecture)
3. [Target Architecture](#target-architecture)
4. [Migration Strategy](#migration-strategy)
5. [Implementation Plan](#implementation-plan)
6. [Code Examples](#code-examples)
7. [RLS Policy Matrix](#rls-policy-matrix)
8. [Frontend Migration](#frontend-migration)
9. [Testing Strategy](#testing-strategy)
10. [Rollout Plan](#rollout-plan)
11. [Troubleshooting](#troubleshooting)

---

## Executive Summary

This document outlines the complete migration from **NestJS Passport.js + JWT + Redis refresh tokens** to **Supabase Auth with Row Level Security (RLS)** for both Edge Functions backend and frontend applications (admin + storefront).

### Why This Migration is Necessary

- **Serverless Architecture**: Passport.js requires stateful Node.js server; Edge Functions are stateless Deno runtime
- **Session Management**: Manual JWT + Redis refresh token complexity → Supabase managed sessions with automatic refresh
- **Security Model**: Application-level guards → Database-level RLS policies (defense in depth)
- **Role Management**: Manual role checks → JWT claims + app_metadata with RLS enforcement
- **Frontend Simplification**: Custom auth service → Supabase Auth client SDK with built-in lifecycle

### Critical Decisions

| Decision               | Choice                         | Rationale                                                   |
| ---------------------- | ------------------------------ | ----------------------------------------------------------- |
| **Frontend Scope**     | Both admin + storefront        | Unified auth experience; eliminate redundant patterns       |
| **Role Storage**       | Supabase Auth app_metadata     | Single source of truth; JWT claims automatically include it |
| **RBAC Model**         | Metadata-based with RLS backup | Fast fail at function boundary + DB enforcement             |
| **Session Management** | Supabase auto-refresh          | Eliminate manual refresh endpoint + Redis dependency        |
| **Migration Strategy** | Phased rollout                 | Edge middleware first → Admin UI → Storefront UI            |

### Scope Clarification

**In Scope:**

- ✅ Edge Functions auth middleware (authenticate + authorize)
- ✅ RLS policies for all tables (customers, orders, admin operations)
- ✅ Admin frontend auth flow (login/logout/session)
- ✅ Storefront frontend auth flow (sign-up/sign-in for customers)
- ✅ Role hierarchy enforcement (SUPER_ADMIN > ADMIN > MANAGER > VIEWER)
- ✅ Remove Redis refresh token dependency

**Out of Scope:**

- ❌ NestJS API changes (remains as-is during migration)
- ❌ OAuth/SSO providers (future enhancement)
- ❌ Multi-factor authentication (future enhancement)

### Critical Implementation Notes

> ⚠️ **IMPORTANT**: The JWT claim path for roles is `auth.jwt() -> 'app_metadata' ->> 'role'`, NOT `auth.jwt() ->> 'role'`. Supabase nests the role inside `app_metadata` in the JWT. All RLS functions must use the correct path.

> ⚠️ **GUEST CHECKOUT**: Current storefront supports WhatsApp-based guest checkout with `user_id IS NULL`. RLS policies must explicitly allow anonymous order creation.

---

## Current Authentication Architecture

### NestJS Backend (Current State)

#### JWT Flow

```typescript
// apps/api/src/modules/auth/auth.service.ts
async login(credentials) {
  // 1. Validate password with bcrypt
  // 2. Generate access token (15m TTL)
  // 3. Generate refresh token (7d TTL)
  // 4. Store refresh token in Redis: refresh:${userId}
  // 5. Return both tokens
}

async refreshTokens(refreshToken) {
  // 1. Verify JWT signature
  // 2. Check token exists in Redis
  // 3. Generate new access + refresh tokens
  // 4. Update Redis
  // 5. Return new tokens
}
```

#### Guard Stack

```typescript
// Passport JWT Strategy
@UseGuards(JwtAuthGuard)           // Validates JWT, attaches user to request
@UseGuards(RolesGuard)              // Checks @Roles() decorator
@Roles(AdminRole.ADMIN)             // Required role annotation
async protectedEndpoint(@CurrentUser() user) { }
```

#### Role Hierarchy

```typescript
enum AdminRole {
  SUPER_ADMIN = 'SUPER_ADMIN', // Level 4 - Full access
  ADMIN = 'ADMIN', // Level 3 - Manage resources
  MANAGER = 'MANAGER', // Level 2 - Limited management
  VIEWER = 'VIEWER', // Level 1 - Read-only
}
```

#### Redis Dependency

- **Refresh tokens**: Stored at `refresh:${userId}` with 7d TTL
- **Logout**: Deletes token from Redis
- **Token validation**: Check existence in Redis before refresh

### Frontend (Current State)

#### Admin App Auth Flow

```typescript
// apps/admin/src/services/api.ts
async login(credentials) {
  const res = await fetch('/api/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
  const { accessToken, refreshToken, user } = await res.json();

  // Store in Zustand + localStorage
  authStore.setTokens(accessToken, refreshToken);
  authStore.setUser(user);
}

// Auto-retry on 401 with token refresh
if (response.status === 401) {
  const newToken = await refreshToken();
  // Retry original request with new token
}
```

#### Storefront App

- Currently **no authentication** (public-only endpoints)
- Plan: Add customer sign-up/sign-in for order tracking, wishlist, etc.

---

## Target Architecture

### Supabase Auth Edge Functions

#### Authentication Flow

```typescript
// supabase/functions/_shared/auth.ts
export async function authenticate(req: Request, supabase: SupabaseClient) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Missing authorization header', status: 401 };
  }

  const token = authHeader.split(' ')[1];
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { error: 'Invalid or expired token', status: 401 };
  }

  return { user, error: null };
}
```

#### Authorization Flow

```typescript
// Check role from app_metadata
export async function requireRole(user: User, minRole: AdminRole) {
  const userRole = user.app_metadata?.role as AdminRole;

  if (!userRole || ROLE_LEVELS[userRole] < ROLE_LEVELS[minRole]) {
    return { error: 'Insufficient permissions', status: 403 };
  }

  return { role: userRole, error: null };
}
```

#### Dual Client Pattern

```typescript
// User-scoped client (respects RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    headers: { Authorization: req.headers.get('Authorization') || '' },
  },
});

// Admin client (bypasses RLS) - use sparingly
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
```

### Row Level Security (RLS)

#### Customer Data Isolation

```sql
-- Orders: Users can only see their own orders
CREATE POLICY "users_own_orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);

-- Order items: Via order ownership
CREATE POLICY "users_own_order_items" ON order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
  );
```

#### Admin Access Control

```sql
-- Products: Admins can manage, public can read
-- ⚠️ CRITICAL: Use correct JWT claim path for role
CREATE POLICY "admin_manage_products" ON products
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role')::text IN ('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  );

CREATE POLICY "public_read_products" ON products
  FOR SELECT USING (is_active = true AND deleted_at IS NULL);
```

### Frontend Supabase Auth Integration

#### Admin App

```typescript
// apps/admin/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  },
);

// Login
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'admin@example.com',
  password: 'password',
});

// Auto-refresh handled by SDK
// No manual /auth/refresh needed!
```

#### Storefront App

```typescript
// Customer sign-up
const { data, error } = await supabase.auth.signUp({
  email: 'customer@example.com',
  password: 'password',
  options: {
    data: { full_name: 'John Doe' }, // Stored in user_metadata
  },
});

// Customer sign-in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'customer@example.com',
  password: 'password',
});
```

---

## Migration Strategy

### Phase Overview

| Phase                  | Duration | Focus                      | Deliverables                    |
| ---------------------- | -------- | -------------------------- | ------------------------------- |
| 1. Foundation          | Week 1   | Auth helpers, RLS policies | Edge middleware, policy scripts |
| 2. Edge Functions      | Week 1-2 | Retrofit all functions     | Protected endpoints working     |
| 3. Admin Frontend      | Week 2   | Replace auth flow          | Admin login with Supabase       |
| 4. Storefront Frontend | Week 2-3 | Add customer auth          | Customer accounts functional    |
| 5. Testing & Hardening | Week 3   | Security validation        | All tests passing               |
| 6. Rollout             | Week 3-4 | Staged deployment          | Production cutover              |

### Risk Mitigation

| Risk                    | Impact | Mitigation                                         |
| ----------------------- | ------ | -------------------------------------------------- |
| Breaking admin access   | High   | Deploy Edge middleware first, keep NestJS fallback |
| RLS policy bugs         | High   | Start with deny-all, add permissions incrementally |
| Token refresh failures  | Medium | Feature flag to toggle Supabase vs legacy auth     |
| Session loss on rollout | Medium | Clear communication + re-login prompt              |

---

## Implementation Plan

### Phase 1: Foundation (Week 1)

#### Step 1.1: Auth Inventory & Route Classification

**Objective**: Map all current auth-protected routes and classify by access level.

**Tasks**:

1. Audit NestJS controllers for `@UseGuards(JwtAuthGuard)` and `@Roles()` decorators
2. Classify routes:
   - **Public**: No auth required (products list, categories)
   - **Authenticated**: Any logged-in user (customer orders, profile)
   - **Admin-only**: Role-based (dashboard, product management, settings)

**Current Protected Routes** (from research):

```typescript
// Admin-only routes (NestJS)
POST   /auth/register           @Public()
POST   /auth/login              @Public()
POST   /auth/refresh            @Public()
POST   /auth/logout             @UseGuards(JwtAuthGuard)
GET    /auth/me                 @UseGuards(JwtAuthGuard)

GET    /dashboard/stats         @Roles(AdminRole.ADMIN)
GET    /dashboard/low-stock     @Roles(AdminRole.MANAGER)
GET    /dashboard/recent-orders @Roles(AdminRole.MANAGER)

POST   /products                @Roles(AdminRole.ADMIN)
PUT    /products/:id            @Roles(AdminRole.ADMIN)
DELETE /products/:id            @Roles(AdminRole.SUPER_ADMIN)

GET    /users                   @Roles(AdminRole.ADMIN)
POST   /users                   @Roles(AdminRole.SUPER_ADMIN)

// Customer routes (to be added)
GET    /orders (user's own)     Authenticated customer
POST   /orders                  Authenticated customer or guest
```

**Deliverables**:

- [ ] Route inventory spreadsheet with auth requirements
- [ ] Role mapping document (NestJS → Supabase)

**Files to Create**:

- `docs/route-inventory.md`

---

#### Step 1.2: Create Shared Auth Helpers

**Objective**: Build reusable auth middleware for Edge Functions.

**Tasks**:

1. Create `_shared/auth.ts` with:
   - `authenticate(req, supabase)` - Token extraction + validation
   - `requireRole(user, minRole)` - Role enforcement
   - `requireAdminRole(userId, allowedRoles, supabaseAdmin)` - Admin table lookup (optional)
2. Create `_shared/types.ts` with auth types
3. Create `_shared/response.ts` with standardized error responses

**Code Implementation**:

```typescript
// supabase/functions/_shared/auth.ts
import {
  createClient,
  SupabaseClient,
  User,
} from 'https://esm.sh/@supabase/supabase-js@2';

export enum AdminRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  VIEWER = 'VIEWER',
}

export const ROLE_LEVELS = {
  [AdminRole.SUPER_ADMIN]: 4,
  [AdminRole.ADMIN]: 3,
  [AdminRole.MANAGER]: 2,
  [AdminRole.VIEWER]: 1,
};

export interface AuthResult {
  user?: User;
  error?: string;
  status?: number;
}

export interface RoleResult {
  role?: AdminRole;
  error?: string;
  status?: number;
}

/**
 * Extract and validate Supabase Auth token from request
 */
export async function authenticate(
  req: Request,
  supabase: SupabaseClient,
): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization');

  if (!authHeader) {
    return { error: 'Missing authorization header', status: 401 };
  }

  if (!authHeader.startsWith('Bearer ')) {
    return { error: 'Invalid authorization format', status: 401 };
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error) {
      console.error('Auth error:', error);
      return { error: 'Invalid or expired token', status: 401 };
    }

    if (!user) {
      return { error: 'User not found', status: 401 };
    }

    // Log successful auth for debugging
    console.log(`Authenticated user: ${user.id} (${user.email})`);

    return { user };
  } catch (error) {
    console.error('Authentication exception:', error);
    return { error: 'Authentication failed', status: 401 };
  }
}

/**
 * Check if user has minimum required role from app_metadata
 */
export function requireRole(user: User, minRole: AdminRole): RoleResult {
  const userRole = user.app_metadata?.role as AdminRole | undefined;

  if (!userRole) {
    console.warn(`User ${user.id} has no role in app_metadata`);
    return { error: 'No role assigned', status: 403 };
  }

  const userLevel = ROLE_LEVELS[userRole];
  const requiredLevel = ROLE_LEVELS[minRole];

  if (!userLevel || userLevel < requiredLevel) {
    console.warn(
      `User ${user.id} with role ${userRole} (level ${userLevel}) ` +
        `denied access requiring ${minRole} (level ${requiredLevel})`,
    );
    return { error: 'Insufficient permissions', status: 403 };
  }

  console.log(`User ${user.id} authorized with role ${userRole}`);
  return { role: userRole };
}

/**
 * Check if user has one of the allowed roles (OR logic)
 */
export function requireAnyRole(
  user: User,
  allowedRoles: AdminRole[],
): RoleResult {
  const userRole = user.app_metadata?.role as AdminRole | undefined;

  if (!userRole) {
    return { error: 'No role assigned', status: 403 };
  }

  if (!allowedRoles.includes(userRole)) {
    return { error: 'Insufficient permissions', status: 403 };
  }

  return { role: userRole };
}

/**
 * Optional: Verify role from admin_users table (fallback/audit)
 */
export async function requireAdminRole(
  userId: string,
  allowedRoles: AdminRole[],
  supabaseAdmin: SupabaseClient,
): Promise<RoleResult> {
  const { data: adminUser, error } = await supabaseAdmin
    .from('admin_users')
    .select('role, is_active')
    .eq('id', userId)
    .is('deleted_at', null)
    .single();

  if (error || !adminUser) {
    console.error(`Admin user ${userId} not found:`, error);
    return { error: 'Not authorized as admin', status: 403 };
  }

  if (!adminUser.is_active) {
    console.warn(`Admin user ${userId} is inactive`);
    return { error: 'Account is inactive', status: 403 };
  }

  if (!allowedRoles.includes(adminUser.role as AdminRole)) {
    console.warn(
      `Admin user ${userId} role ${adminUser.role} not in ${allowedRoles}`,
    );
    return { error: 'Insufficient permissions', status: 403 };
  }

  return { role: adminUser.role as AdminRole };
}
```

```typescript
// supabase/functions/_shared/response.ts
export function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message, statusCode: status }, status);
}

export function corsResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
```

**Deliverables**:

- [ ] `_shared/auth.ts` with auth helpers
- [ ] `_shared/types.ts` with TypeScript types
- [ ] `_shared/response.ts` with response helpers
- [ ] Unit tests for auth helpers

**Testing**:

```typescript
// supabase/functions/_shared/auth.test.ts
import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { requireRole, AdminRole, ROLE_LEVELS } from './auth.ts';

Deno.test('requireRole allows equal level', () => {
  const user = { app_metadata: { role: 'ADMIN' } } as any;
  const result = requireRole(user, AdminRole.ADMIN);
  assertEquals(result.error, undefined);
  assertEquals(result.role, AdminRole.ADMIN);
});

Deno.test('requireRole allows higher level', () => {
  const user = { app_metadata: { role: 'SUPER_ADMIN' } } as any;
  const result = requireRole(user, AdminRole.ADMIN);
  assertEquals(result.error, undefined);
});

Deno.test('requireRole denies lower level', () => {
  const user = { app_metadata: { role: 'VIEWER' } } as any;
  const result = requireRole(user, AdminRole.ADMIN);
  assertEquals(result.status, 403);
});
```

---

#### Step 1.3: Set Up App Metadata Role Assignment

**Objective**: Configure Supabase to store admin roles in app_metadata.

**Tasks**:

1. Create SQL function to set user role
2. Create admin invite function
3. Update existing admin users with roles

**SQL Implementation**:

```sql
-- supabase/migrations/20260526_add_role_metadata_functions.sql

-- Function to set admin role in auth.users app_metadata
CREATE OR REPLACE FUNCTION set_user_role(
  user_id UUID,
  new_role TEXT
)
RETURNS VOID AS $$
BEGIN
  -- Validate role
  IF new_role NOT IN ('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'VIEWER') THEN
    RAISE EXCEPTION 'Invalid role: %', new_role;
  END IF;

  -- Update auth.users app_metadata
  UPDATE auth.users
  SET raw_app_meta_data = jsonb_set(
    COALESCE(raw_app_meta_data, '{}'::jsonb),
    '{role}',
    to_jsonb(new_role)
  )
  WHERE id = user_id;

  -- Also update admin_users table for consistency
  UPDATE admin_users
  SET role = new_role::admin_role
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service role only
GRANT EXECUTE ON FUNCTION set_user_role TO service_role;


-- Sync existing admin roles to auth metadata
DO $$
DECLARE
  admin_rec RECORD;
BEGIN
  FOR admin_rec IN
    SELECT id, role
    FROM admin_users
    WHERE deleted_at IS NULL
  LOOP
    UPDATE auth.users
    SET raw_app_meta_data = jsonb_set(
      COALESCE(raw_app_meta_data, '{}'::jsonb),
      '{role}',
      to_jsonb(admin_rec.role::text)
    )
    WHERE id = admin_rec.id;

    RAISE NOTICE 'Synced role % for user %', admin_rec.role, admin_rec.id;
  END LOOP;
END;
$$;
```

**Deliverables**:

- [ ] Migration script for role sync
- [ ] SQL function `set_user_role()`
- [ ] Verification query to check metadata

**Verification**:

```sql
-- Check app_metadata roles
SELECT
  au.id,
  au.email,
  adm.role AS table_role,
  au.raw_app_meta_data->>'role' AS metadata_role
FROM auth.users au
JOIN admin_users adm ON adm.id = au.id
WHERE adm.deleted_at IS NULL;
```

---

### Phase 2: RLS Policy Implementation (Week 1-2)

#### Step 2.1: Enable RLS on All Tables

**Objective**: Turn on Row Level Security for all tables, starting with deny-all.

**Tasks**:

1. Enable RLS on each table
2. Create deny-all baseline
3. Incrementally add allow policies

**SQL Implementation**:

```sql
-- supabase/migrations/20260526_enable_rls.sql

-- Enable RLS on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

**Deliverables**:

- [ ] RLS enabled on all tables
- [ ] Verification query confirming RLS status

---

#### Step 2.2: Public Data Policies

**Objective**: Allow unauthenticated read access to public product catalog.

**SQL Implementation**:

```sql
-- supabase/migrations/20260526_rls_public_policies.sql

-- Products: Public can read active products
CREATE POLICY "public_read_active_products" ON products
  FOR SELECT
  USING (
    is_active = true
    AND deleted_at IS NULL
  );

-- Product Images: Public can read images for active products
CREATE POLICY "public_read_product_images" ON product_images
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_images.product_id
        AND products.is_active = true
        AND products.deleted_at IS NULL
    )
  );

-- Product Variants: Public can read variants for active products
CREATE POLICY "public_read_product_variants" ON product_variants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_variants.product_id
        AND products.is_active = true
        AND products.deleted_at IS NULL
    )
  );

-- Categories: Public can read all categories
CREATE POLICY "public_read_categories" ON categories
  FOR SELECT
  USING (deleted_at IS NULL);
```

**Deliverables**:

- [ ] Public read policies for products, images, variants, categories
- [ ] Test: Unauthenticated user can list products

---

#### Step 2.3: Customer Data Isolation Policies

**Objective**: Customers can only access their own orders and data.

**SQL Implementation**:

```sql
-- supabase/migrations/20260526_rls_customer_policies.sql

-- Orders: Users can read their own orders
CREATE POLICY "users_read_own_orders" ON orders
  FOR SELECT
  USING (auth.uid() = user_id);

-- Orders: Users can create orders (for authenticated checkout)
CREATE POLICY "users_create_own_orders" ON orders
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ⚠️ CRITICAL: Allow guest checkout (WhatsApp-based, no user_id)
CREATE POLICY "allow_guest_order_creation" ON orders
  FOR INSERT
  WITH CHECK (user_id IS NULL);

-- Guest order items: Allow creation for orders without user_id
CREATE POLICY "guest_create_order_items" ON order_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.user_id IS NULL
    )
  );

-- Order Items: Users can read items for their orders
CREATE POLICY "users_read_own_order_items" ON order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.user_id = auth.uid()
    )
  );

-- Order Items: Users can insert items for their orders
CREATE POLICY "users_create_own_order_items" ON order_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.user_id = auth.uid()
    )
  );

-- Push Subscriptions: Users can manage their own subscriptions
CREATE POLICY "users_manage_own_subscriptions" ON push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**Deliverables**:

- [ ] Customer isolation policies for orders, order_items, subscriptions
- [ ] Guest checkout policies for anonymous orders
- [ ] Test: User A cannot read User B's orders
- [ ] Test: Guest can create orders with `user_id IS NULL`

---

#### Step 2.4: Admin Access Policies

**Objective**: Admins can manage all resources based on role level.

**SQL Implementation**:

```sql
-- supabase/migrations/20260526_rls_admin_policies.sql

-- Helper function to check admin role
-- ⚠️ CRITICAL: Correct JWT path is auth.jwt() -> 'app_metadata' ->> 'role'
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (auth.jwt() -> 'app_metadata' ->> 'role')::text IN ('SUPER_ADMIN', 'ADMIN', 'MANAGER');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'SUPER_ADMIN';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Products: Admins can manage all products
CREATE POLICY "admin_manage_products" ON products
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Product Images: Admins can manage all images
CREATE POLICY "admin_manage_product_images" ON product_images
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Product Variants: Admins can manage all variants
CREATE POLICY "admin_manage_product_variants" ON product_variants
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Categories: Admins can manage all categories
CREATE POLICY "admin_manage_categories" ON categories
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Orders: Admins can read and update all orders
CREATE POLICY "admin_read_all_orders" ON orders
  FOR SELECT
  USING (is_admin());

CREATE POLICY "admin_update_orders" ON orders
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- Only SUPER_ADMIN can delete orders (soft delete)
CREATE POLICY "super_admin_delete_orders" ON orders
  FOR UPDATE
  USING (is_super_admin() AND deleted_at IS NOT NULL)
  WITH CHECK (is_super_admin());

-- Inventory Movements: Admins can manage inventory
CREATE POLICY "admin_manage_inventory" ON inventory_movements
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Settings: Admins can manage settings
CREATE POLICY "admin_read_settings" ON settings
  FOR SELECT
  USING (is_admin());

CREATE POLICY "admin_manage_settings" ON settings
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Admin Users: Only SUPER_ADMIN can manage other admins
CREATE POLICY "super_admin_manage_admins" ON admin_users
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Admins can read own profile
CREATE POLICY "admin_read_own_profile" ON admin_users
  FOR SELECT
  USING (auth.uid() = id);
```

**Deliverables**:

- [ ] Admin policies for all tables
- [ ] Role-level differentiation (SUPER_ADMIN vs ADMIN vs MANAGER)
- [ ] Test: VIEWER cannot write, MANAGER cannot delete

---

### Phase 3: Edge Function Migration (Week 1-2)

#### Step 3.1: Protected Admin Endpoints

**Objective**: Retrofit existing Edge Functions with auth middleware.

**Example: Dashboard Stats**

```typescript
// supabase/functions/dashboard-stats/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticate, requireRole, AdminRole } from '../_shared/auth.ts';
import {
  jsonResponse,
  errorResponse,
  corsResponse,
} from '../_shared/response.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // User-scoped client (respects RLS)
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: req.headers.get('Authorization') || '' },
    },
  });

  // Admin client (bypasses RLS for aggregation queries)
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Step 1: Authenticate user
    const authResult = await authenticate(req, supabase);
    if (authResult.error) {
      return errorResponse(authResult.error, authResult.status);
    }

    // Step 2: Check admin role
    const roleResult = requireRole(authResult.user!, AdminRole.MANAGER);
    if (roleResult.error) {
      return errorResponse(roleResult.error, roleResult.status);
    }

    // Step 3: Fetch dashboard stats (using admin client for aggregations)
    const [ordersCount, productsCount, revenue] = await Promise.all([
      supabaseAdmin.from('orders').select('*', { count: 'exact', head: true }),
      supabaseAdmin
        .from('products')
        .select('*', { count: 'exact', head: true }),
      supabaseAdmin.rpc('get_total_revenue'),
    ]);

    return jsonResponse({
      orders: ordersCount.count || 0,
      products: productsCount.count || 0,
      revenue: revenue.data || 0,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return errorResponse('Internal server error', 500);
  }
});
```

**Example: Product Management**

```typescript
// supabase/functions/products-create/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticate, requireRole, AdminRole } from '../_shared/auth.ts';
import { invalidateNamespace } from '../_shared/cache.ts';
import {
  jsonResponse,
  errorResponse,
  corsResponse,
} from '../_shared/response.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: req.headers.get('Authorization') || '' },
    },
  });
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Authenticate
    const authResult = await authenticate(req, supabase);
    if (authResult.error)
      return errorResponse(authResult.error, authResult.status);

    // Require ADMIN or higher
    const roleResult = requireRole(authResult.user!, AdminRole.ADMIN);
    if (roleResult.error)
      return errorResponse(roleResult.error, roleResult.status);

    // Parse and validate payload
    const payload = await req.json();
    // ... validation logic ...

    // Create product using admin client (bypasses RLS for creation)
    const { data: product, error } = await supabaseAdmin.rpc(
      'create_product_with_relations',
      {
        product_data: payload,
        images_data: payload.images || [],
        variants_data: payload.variants || [],
      },
    );

    if (error) {
      console.error('Product creation error:', error);
      return errorResponse(error.message, 400);
    }

    // Invalidate product list cache
    await invalidateNamespace('products:list');

    return jsonResponse(product, 201);
  } catch (error) {
    console.error('Function error:', error);
    return errorResponse('Internal server error', 500);
  }
});
```

**Deliverables**:

- [ ] All admin endpoints migrated to Supabase Auth
- [ ] Consistent error responses (401/403)
- [ ] Service role usage minimized and audited

**Files to Update**:

- `supabase/functions/dashboard-stats/index.ts`
- `supabase/functions/dashboard-low-stock/index.ts`
- `supabase/functions/dashboard-recent-orders/index.ts`
- `supabase/functions/products-create/index.ts`
- `supabase/functions/products-update/index.ts`
- `supabase/functions/products-delete/index.ts`
- `supabase/functions/categories-create/index.ts`
- `supabase/functions/categories-update/index.ts`
- `supabase/functions/orders-list/index.ts`
- `supabase/functions/orders-update-status/index.ts`
- `supabase/functions/settings-update/index.ts`

---

#### Step 3.2: Customer-Scoped Endpoints

**Objective**: Add customer authentication to order and profile endpoints.

**Example: My Orders**

```typescript
// supabase/functions/orders-my-orders/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticate } from '../_shared/auth.ts';
import {
  jsonResponse,
  errorResponse,
  corsResponse,
} from '../_shared/response.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

  // User-scoped client (RLS will filter to user's orders)
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: req.headers.get('Authorization') || '' },
    },
  });

  try {
    // Authenticate user
    const authResult = await authenticate(req, supabase);
    if (authResult.error)
      return errorResponse(authResult.error, authResult.status);

    // RLS automatically filters to user's orders
    const { data: orders, error } = await supabase
      .from('orders')
      .select(
        `
        *,
        items:order_items(
          *,
          product:products(id, name, slug)
        )
      `,
      )
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Orders query error:', error);
      return errorResponse(error.message, 400);
    }

    return jsonResponse({ orders });
  } catch (error) {
    console.error('Function error:', error);
    return errorResponse('Internal server error', 500);
  }
});
```

**Deliverables**:

- [ ] Customer order listing
- [ ] Customer profile management
- [ ] RLS-enforced data isolation verified

---

### Phase 4: Frontend Migration (Week 2-3)

#### Step 4.1: Admin App Auth Refactor

**Objective**: Replace NestJS auth endpoints with Supabase Auth in admin frontend.

**Tasks**:

1. Install Supabase client SDK
2. Create Supabase client singleton
3. Update auth store to use Supabase session
4. Update login/logout flows
5. Update auth guard
6. Remove custom refresh token logic

**Installation**:

```bash
cd apps/admin
pnpm add @supabase/supabase-js
```

**Supabase Client Setup**:

```typescript
// apps/admin/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});
```

**Environment Variables**:

```bash
# apps/admin/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Auth Store Refactor**:

```typescript
// apps/admin/src/stores/auth-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export enum AdminRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  VIEWER = 'VIEWER',
}

interface AuthState {
  user: User | null;
  session: Session | null;
  role: AdminRole | null;
  isAuthenticated: boolean;
  hydrated: boolean;

  // Actions
  setSession: (session: Session | null) => void;
  setHydrated: () => void;
  logout: () => Promise<void>;
  getAccessToken: () => string | null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      role: null,
      isAuthenticated: false,
      hydrated: false,

      setSession: (session) => {
        const user = session?.user || null;
        const role = (user?.app_metadata?.role as AdminRole) || null;

        set({
          session,
          user,
          role,
          isAuthenticated: !!session,
        });
      },

      setHydrated: () => set({ hydrated: true }),

      logout: async () => {
        await supabase.auth.signOut();
        set({
          user: null,
          session: null,
          role: null,
          isAuthenticated: false,
        });
      },

      getAccessToken: () => {
        return get().session?.access_token || null;
      },
    }),
    {
      name: 'admin-auth-storage',
      partialize: (state) => ({
        // Only persist minimal info; session is handled by Supabase SDK
        hydrated: state.hydrated,
      }),
    },
  ),
);
```

**Auth Provider** (to listen for session changes):

```typescript
// apps/admin/src/providers/auth-provider.tsx
'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { supabase } from '@/lib/supabase';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setSession, setHydrated, session: zustandSession } = useAuthStore();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setHydrated();
    });

    // Listen for auth changes
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // Session sync check - verify Zustand and Supabase SDK are in sync
    const syncInterval = setInterval(async () => {
      const { data: { session: sdkSession } } = await supabase.auth.getSession();

      // If SDK session exists but Zustand doesn't, or vice versa, sync them
      if (!!sdkSession !== !!zustandSession) {
        console.warn('Session state drift detected, syncing...');
        setSession(sdkSession);
      }
    }, 60000); // Check every minute

    return () => {
      subscription.unsubscribe();
      clearInterval(syncInterval);
    };
  }, [setSession, setHydrated, zustandSession]);

  return <>{children}</>;
}
```

**Login Page Update**:

```typescript
// apps/admin/src/app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        setError(error.message);
        return;
      }

      // Check if user has admin role
      const role = data.user?.app_metadata?.role;
      if (!role || !['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'VIEWER'].includes(role)) {
        setError('Access denied. Admin privileges required.');
        await supabase.auth.signOut();
        return;
      }

      // Session automatically stored by Supabase SDK
      router.push('/dashboard');
    } catch (err) {
      setError('Login failed. Please try again.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleLogin} className="w-full max-w-md space-y-4 p-8">
        <h1 className="text-2xl font-bold">Admin Login</h1>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded">{error}</div>
        )}

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="w-full p-2 border rounded"
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          className="w-full p-2 border rounded"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}
```

**Auth Guard Update**:

```typescript
// apps/admin/src/components/layout/auth-guard.tsx
'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, hydrated, role } = useAuthStore();

  useEffect(() => {
    if (!hydrated) return;

    const isLoginPage = pathname === '/login';

    if (!isAuthenticated && !isLoginPage) {
      // Redirect to login if not authenticated
      router.push('/login');
    } else if (isAuthenticated && isLoginPage) {
      // Redirect to dashboard if already authenticated
      router.push('/dashboard');
    }
  }, [isAuthenticated, hydrated, pathname, router]);

  // Show nothing while checking auth
  if (!hydrated) {
    return null;
  }

  // Show login page or protected content
  return <>{children}</>;
}
```

**API Service Update** (for Edge Function calls):

```typescript
// apps/admin/src/services/api.ts
import { supabase } from '@/lib/supabase';

const API_BASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL! + '/functions/v1';

async function getAuthHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
}

// Retry wrapper for token refresh during long operations
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 1,
): Promise<Response> {
  try {
    const res = await fetch(url, options);

    // If 401 and we haven't retried, refresh token and retry
    if (res.status === 401 && retries > 0) {
      console.log('Token expired, refreshing session...');
      const {
        data: { session },
        error,
      } = await supabase.auth.refreshSession();

      if (error || !session) {
        throw new Error('Session refresh failed');
      }

      // Retry with new token
      const newHeaders = {
        ...options.headers,
        Authorization: `Bearer ${session.access_token}`,
      };

      return fetch(url, { ...options, headers: newHeaders });
    }

    return res;
  } catch (error) {
    if (retries > 0) {
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}

export async function fetchDashboardStats() {
  const headers = await getAuthHeaders();
  const res = await fetchWithRetry(`${API_BASE_URL}/dashboard-stats`, {
    headers,
  });

  if (!res.ok) {
    throw new Error(`Dashboard stats failed: ${res.statusText}`);
  }

  return res.json();
}

export async function createProduct(data: any) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/products-create`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Product creation failed');
  }

  return res.json();
}

// ... other API methods
```

**Deliverables**:

- [ ] Supabase client installed and configured
- [ ] Auth store refactored to use Supabase session
- [ ] Login page using `signInWithPassword`
- [ ] Logout using `signOut`
- [ ] Auth guard using Supabase session state
- [ ] API service using Supabase access token
- [ ] Remove all references to `/api/auth/login`, `/api/auth/refresh`

**Files to Update**:

- `apps/admin/src/lib/supabase.ts` (create)
- `apps/admin/src/stores/auth-store.ts` (refactor)
- `apps/admin/src/providers/auth-provider.tsx` (create)
- `apps/admin/src/app/login/page.tsx` (refactor)
- `apps/admin/src/components/layout/auth-guard.tsx` (refactor)
- `apps/admin/src/services/api.ts` (refactor)
- `apps/admin/.env.local` (add Supabase vars)

---

#### Step 4.2: Storefront App Customer Auth

**Objective**: Add customer sign-up/sign-in functionality to storefront.

**Tasks**:

1. Install Supabase client SDK
2. Create Supabase client singleton
3. Add customer sign-up flow
4. Add customer sign-in flow
5. Add "My Orders" page for authenticated customers
6. Update order creation to optionally link to user

**Installation**:

```bash
cd apps/storefront
pnpm add @supabase/supabase-js
```

**Supabase Client Setup**:

```typescript
// apps/storefront/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});
```

**Customer Auth Store**:

```typescript
// apps/storefront/src/store/auth.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;

  // Actions
  setSession: (session: Session | null) => void;
  logout: () => Promise<void>;
  getAccessToken: () => string | null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      isAuthenticated: false,

      setSession: (session) => {
        set({
          session,
          user: session?.user || null,
          isAuthenticated: !!session,
        });
      },

      logout: async () => {
        await supabase.auth.signOut();
        set({
          user: null,
          session: null,
          isAuthenticated: false,
        });
      },

      getAccessToken: () => {
        return get().session?.access_token || null;
      },
    }),
    {
      name: 'customer-auth-storage',
    },
  ),
);
```

**Sign-Up Page**:

```typescript
// apps/storefront/src/app/signup/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
          }
        }
      });

      if (error) {
        setError(error.message);
        return;
      }

      setSuccess(true);
      // Note: User may need to verify email before logging in
      setTimeout(() => router.push('/login'), 3000);
    } catch (err) {
      setError('Sign-up failed. Please try again.');
      console.error('Sign-up error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16 p-8">
      <h1 className="text-3xl font-bold mb-6">Create Account</h1>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>
      )}

      {success && (
        <div className="bg-green-100 text-green-700 p-3 rounded mb-4">
          Account created! Check your email to verify your account.
        </div>
      )}

      <form onSubmit={handleSignUp} className="space-y-4">
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Full Name"
          required
          className="w-full p-2 border rounded"
        />

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="w-full p-2 border rounded"
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 6 characters)"
          required
          minLength={6}
          className="w-full p-2 border rounded"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Sign Up'}
        </button>
      </form>

      <p className="mt-4 text-center">
        Already have an account?{' '}
        <a href="/login" className="text-blue-600 hover:underline">
          Login
        </a>
      </p>
    </div>
  );
}
```

**Login Page**:

```typescript
// apps/storefront/src/app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        setError(error.message);
        return;
      }

      router.push('/my-orders');
    } catch (err) {
      setError('Login failed. Please try again.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16 p-8">
      <h1 className="text-3xl font-bold mb-6">Login</h1>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="w-full p-2 border rounded"
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          className="w-full p-2 border rounded"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>

      <p className="mt-4 text-center">
        Don't have an account?{' '}
        <a href="/signup" className="text-blue-600 hover:underline">
          Sign Up
        </a>
      </p>
    </div>
  );
}
```

**My Orders Page**:

```typescript
// apps/storefront/src/app/my-orders/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';

export default function MyOrdersPage() {
  const router = useRouter();
  const { isAuthenticated, getAccessToken } = useAuthStore();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    loadOrders();
  }, [isAuthenticated]);

  const loadOrders = async () => {
    try {
      const token = getAccessToken();
      if (!token) throw new Error('No access token');

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/orders-my-orders`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!res.ok) throw new Error('Failed to load orders');

      const data = await res.json();
      setOrders(data.orders || []);
    } catch (error) {
      console.error('Load orders error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="max-w-4xl mx-auto mt-16 p-8">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto mt-16 p-8">
      <h1 className="text-3xl font-bold mb-6">My Orders</h1>

      {orders.length === 0 ? (
        <p>You don't have any orders yet.</p>
      ) : (
        <div className="space-y-4">
          {orders.map((order: any) => (
            <div key={order.id} className="border rounded p-4">
              <div className="flex justify-between">
                <div>
                  <p className="font-semibold">Order #{order.id.slice(0, 8)}</p>
                  <p className="text-sm text-gray-600">
                    {new Date(order.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{order.total_amount} XAF</p>
                  <p className="text-sm">
                    <span className={`px-2 py-1 rounded ${
                      order.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                      order.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {order.status}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Deliverables**:

- [ ] Customer sign-up page
- [ ] Customer login page
- [ ] My Orders page for authenticated customers
- [ ] Auth state management with Zustand
- [ ] Guest checkout still functional

**Files to Create/Update**:

- `apps/storefront/src/lib/supabase.ts` (create)
- `apps/storefront/src/store/auth.ts` (create)
- `apps/storefront/src/app/signup/page.tsx` (create)
- `apps/storefront/src/app/login/page.tsx` (create)
- `apps/storefront/src/app/my-orders/page.tsx` (create)
- `apps/storefront/.env.local` (add Supabase vars)

---

#### Step 4.3: Password Reset Flow

**Objective**: Allow users to reset forgotten passwords.

**Admin App - Forgot Password Page**:

```typescript
// apps/admin/src/app/forgot-password/page.tsx
'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) {
        setError(error.message);
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError('Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold mb-6">Reset Password</h1>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>
        )}

        {success ? (
          <div className="bg-green-100 text-green-700 p-3 rounded">
            Password reset email sent! Check your inbox.
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="w-full p-2 border rounded"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>

            <a href="/login" className="block text-center text-blue-600 hover:underline">
              Back to Login
            </a>
          </form>
        )}
      </div>
    </div>
  );
}
```

**Admin App - Reset Password Page**:

```typescript
// apps/admin/src/app/reset-password/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        setError(error.message);
        return;
      }

      // Success - redirect to login
      alert('Password updated successfully!');
      router.push('/login');
    } catch (err) {
      setError('Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold mb-6">Set New Password</h1>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>
        )}

        <form onSubmit={handleReset} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New Password"
            required
            minLength={6}
            className="w-full p-2 border rounded"
          />

          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm Password"
            required
            minLength={6}
            className="w-full p-2 border rounded"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

**Storefront - Same Pattern**:

Create identical pages for storefront at:

- `apps/storefront/src/app/forgot-password/page.tsx`
- `apps/storefront/src/app/reset-password/page.tsx`

**Deliverables**:

- [ ] Forgot password page (admin + storefront)
- [ ] Reset password page (admin + storefront)
- [ ] Link from login page to forgot password
- [ ] Test: Password reset email received
- [ ] Test: Password successfully updated

---

#### Step 4.4: Email Verification Callback

**Objective**: Handle email verification after sign-up.

**Auth Callback Handler**:

```typescript
// apps/admin/src/app/auth/callback/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = createRouteHandlerClient({ cookies });
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Redirect to dashboard or login
  return NextResponse.redirect(new URL('/dashboard', requestUrl.origin));
}
```

**Or using middleware approach**:

```typescript
// apps/admin/src/app/auth/callback/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Supabase will automatically handle the token from URL
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          setError(error.message);
          return;
        }

        if (session) {
          router.push('/dashboard');
        } else {
          router.push('/login');
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setError('Authentication failed');
        setTimeout(() => router.push('/login'), 3000);
      }
    };

    handleCallback();
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <p>Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p>Verifying your email...</p>
      </div>
    </div>
  );
}
```

**Update Supabase Client Config**:

```typescript
// apps/admin/src/lib/supabase.ts
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // ⚠️ Important for email verification
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});
```

**Deliverables**:

- [ ] Auth callback handler route
- [ ] Email verification flow tested
- [ ] Redirect to dashboard after verification
- [ ] Error handling for failed verification

---

#### Step 4.5: Admin User Provisioning

**Objective**: Allow SUPER_ADMIN to invite new admin users via UI.

**Edge Function - Admin Invite**:

```typescript
// supabase/functions/admin-users-invite/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticate, requireRole, AdminRole } from '../_shared/auth.ts';
import {
  jsonResponse,
  errorResponse,
  corsResponse,
} from '../_shared/response.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: req.headers.get('Authorization') || '' },
    },
  });
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Authenticate
    const authResult = await authenticate(req, supabase);
    if (authResult.error)
      return errorResponse(authResult.error, authResult.status);

    // Require SUPER_ADMIN
    const roleResult = requireRole(authResult.user!, AdminRole.SUPER_ADMIN);
    if (roleResult.error)
      return errorResponse(roleResult.error, roleResult.status);

    const { email, role, firstName, lastName } = await req.json();

    // Validate input
    if (!email || !role) {
      return errorResponse('Email and role are required', 400);
    }

    if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'VIEWER'].includes(role)) {
      return errorResponse('Invalid role', 400);
    }

    // Create user with admin service role
    const { data: newUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        app_metadata: { role },
        user_metadata: { first_name: firstName, last_name: lastName },
      });

    if (createError) {
      console.error('User creation error:', createError);
      return errorResponse(createError.message, 400);
    }

    // Insert into admin_users table
    const { error: dbError } = await supabaseAdmin.from('admin_users').insert({
      id: newUser.user.id,
      email,
      role,
      first_name: firstName,
      last_name: lastName,
      is_active: true,
    });

    if (dbError) {
      console.error('Admin user insert error:', dbError);
      return errorResponse(dbError.message, 400);
    }

    // Send password reset email for initial password setup
    await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
    });

    return jsonResponse(
      {
        id: newUser.user.id,
        email,
        role,
        message:
          'Admin user invited. They will receive an email to set their password.',
      },
      201,
    );
  } catch (error) {
    console.error('Function error:', error);
    return errorResponse('Internal server error', 500);
  }
});
```

**Admin UI - Invite Page**:

```typescript
// apps/admin/src/app/admin-users/invite/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function InviteAdminPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('VIEWER');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-users-invite`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, role, firstName, lastName })
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to invite admin');
      }

      alert('Admin invited successfully!');
      router.push('/admin-users');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Invite Admin User</h1>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>
      )}

      <form onSubmit={handleInvite} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First Name"
            required
            className="p-2 border rounded"
          />
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last Name"
            required
            className="p-2 border rounded"
          />
        </div>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="w-full p-2 border rounded"
        />

        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full p-2 border rounded"
        >
          <option value="VIEWER">Viewer</option>
          <option value="MANAGER">Manager</option>
          <option value="ADMIN">Admin</option>
          <option value="SUPER_ADMIN">Super Admin</option>
        </select>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Inviting...' : 'Send Invitation'}
        </button>
      </form>
    </div>
  );
}
```

**Deliverables**:

- [ ] Edge Function: `admin-users-invite`
- [ ] Admin UI: Invite admin page
- [ ] Only SUPER_ADMIN can access
- [ ] Password reset email sent to new admin
- [ ] Test: New admin can set password and log in

---

### Phase 5: Testing & Validation (Week 3)

#### Authentication Tests

```typescript
// tests/auth/authentication.test.ts
describe('Authentication', () => {
  it('rejects missing Bearer token', async () => {
    const res = await fetch(
      'http://localhost:54321/functions/v1/dashboard-stats',
    );
    expect(res.status).toBe(401);
  });

  it('rejects invalid token', async () => {
    const res = await fetch(
      'http://localhost:54321/functions/v1/dashboard-stats',
      {
        headers: { Authorization: 'Bearer invalid-token' },
      },
    );
    expect(res.status).toBe(401);
  });

  it('accepts valid token', async () => {
    // Sign in as admin
    const { data } = await supabase.auth.signInWithPassword({
      email: 'admin@example.com',
      password: 'password',
    });

    const res = await fetch(
      'http://localhost:54321/functions/v1/dashboard-stats',
      {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      },
    );

    expect(res.status).toBe(200);
  });
});
```

#### Authorization Tests

```typescript
// tests/auth/authorization.test.ts
describe('Role-Based Authorization', () => {
  it('VIEWER cannot create products', async () => {
    const { data } = await supabase.auth.signInWithPassword({
      email: 'viewer@example.com',
      password: 'password',
    });

    const res = await fetch(
      'http://localhost:54321/functions/v1/products-create',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test Product',
          sku: 'TEST-001',
          price: 100,
        }),
      },
    );

    expect(res.status).toBe(403);
  });

  it('ADMIN can create products', async () => {
    const { data } = await supabase.auth.signInWithPassword({
      email: 'admin@example.com',
      password: 'password',
    });

    const res = await fetch(
      'http://localhost:54321/functions/v1/products-create',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test Product',
          sku: 'TEST-001',
          price: 100,
          type: 'PHYSICAL',
        }),
      },
    );

    expect(res.status).toBe(201);
  });

  it('SUPER_ADMIN can delete products', async () => {
    const { data } = await supabase.auth.signInWithPassword({
      email: 'superadmin@example.com',
      password: 'password',
    });

    const res = await fetch(
      'http://localhost:54321/functions/v1/products-delete/product-id',
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      },
    );

    expect(res.status).toBe(200);
  });
});
```

#### RLS Isolation Tests

```typescript
// tests/rls/customer-isolation.test.ts
describe('Customer Data Isolation (RLS)', () => {
  it('User A cannot read User B orders', async () => {
    // Sign in as User A
    const { data: userA } = await supabase.auth.signInWithPassword({
      email: 'customer-a@example.com',
      password: 'password',
    });

    // Try to read all orders (should only return User A's orders)
    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', 'user-b-id'); // Try to access User B's orders

    // RLS should return empty array or error
    expect(orders).toEqual([]);
  });

  it('Admin can read all orders', async () => {
    const { data: admin } = await supabase.auth.signInWithPassword({
      email: 'admin@example.com',
      password: 'password',
    });

    // Create admin client (service role)
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: orders } = await supabaseAdmin.from('orders').select('*');

    // Should return all orders
    expect(orders.length).toBeGreaterThan(0);
  });
});
```

#### Frontend Session Tests

```typescript
// apps/admin/__tests__/auth.test.tsx
describe('Admin Auth Flow', () => {
  it('redirects unauthenticated user to login', () => {
    render(<Dashboard />);
    expect(window.location.pathname).toBe('/login');
  });

  it('persists session across reload', async () => {
    await supabase.auth.signInWithPassword({
      email: 'admin@example.com',
      password: 'password'
    });

    // Simulate page reload
    window.location.reload();

    // Should still be authenticated
    const { data: { session } } = await supabase.auth.getSession();
    expect(session).not.toBeNull();
  });

  it('clears session on logout', async () => {
    await supabase.auth.signInWithPassword({
      email: 'admin@example.com',
      password: 'password'
    });

    await supabase.auth.signOut();

    const { data: { session } } = await supabase.auth.getSession();
    expect(session).toBeNull();
  });
});
```

**Deliverables**:

- [ ] Authentication tests passing
- [ ] Authorization tests passing
- [ ] RLS isolation tests passing
- [ ] Frontend session tests passing
- [ ] No Redis refresh token dependency in tests

---

### Phase 6: Rollout (Week 3-4)

#### Rollout Strategy

**Stage 1: Edge Functions (Backend)**

1. Deploy `_shared/auth.ts` helpers
2. Deploy RLS policies (migrations)
3. Deploy updated Edge Functions
4. Test with Postman/curl using real Supabase tokens
5. Monitor logs for auth errors
6. **Criteria**: All Edge Functions accepting Supabase Auth tokens

**Stage 2: Admin Frontend**

1. Deploy admin app with Supabase Auth
2. Notify admin users to re-login
3. Monitor for login/session issues
4. **Criteria**: Admin users can log in and access all features

**Stage 3: Storefront Frontend**

1. Deploy storefront with customer auth
2. Announce customer account feature
3. Monitor sign-up/login flow
4. **Criteria**: Customers can create accounts and view orders

**Stage 4: Cleanup**

1. Remove NestJS `/auth/*` endpoint usage from frontend code
2. Remove Redis refresh token logic
3. Update documentation
4. **Criteria**: No legacy auth code remains

#### Feature Flags

```bash
# Supabase Edge Functions
SUPABASE_AUTH_ENABLED=true  # Toggle between Supabase Auth and legacy

# Frontend Apps
NEXT_PUBLIC_USE_SUPABASE_AUTH=true
```

#### Rollback Plan

If critical issues arise:

1. Set `SUPABASE_AUTH_ENABLED=false` in Edge Functions
2. Revert frontend to use NestJS `/auth/*` endpoints
3. No database rollback needed (RLS policies don't break existing data)

---

## RLS Policy Matrix

Complete policy summary:

| Table                   | Policy Name                    | Type   | Condition                                 |
| ----------------------- | ------------------------------ | ------ | ----------------------------------------- |
| **products**            | public_read_active_products    | SELECT | `is_active = true AND deleted_at IS NULL` |
| **products**            | admin_manage_products          | ALL    | `is_admin()`                              |
| **product_images**      | public_read_product_images     | SELECT | Product is active                         |
| **product_images**      | admin_manage_product_images    | ALL    | `is_admin()`                              |
| **product_variants**    | public_read_product_variants   | SELECT | Product is active                         |
| **product_variants**    | admin_manage_product_variants  | ALL    | `is_admin()`                              |
| **categories**          | public_read_categories         | SELECT | `deleted_at IS NULL`                      |
| **categories**          | admin_manage_categories        | ALL    | `is_admin()`                              |
| **orders**              | users_read_own_orders          | SELECT | `auth.uid() = user_id`                    |
| **orders**              | users_create_own_orders        | INSERT | `auth.uid() = user_id`                    |
| **orders**              | allow_guest_order_creation     | INSERT | `user_id IS NULL` (guest checkout)        |
| **order_items**         | guest_create_order_items       | INSERT | Via guest order ownership                 |
| **orders**              | admin_read_all_orders          | SELECT | `is_admin()`                              |
| **orders**              | admin_update_orders            | UPDATE | `is_admin()`                              |
| **orders**              | super_admin_delete_orders      | UPDATE | `is_super_admin()`                        |
| **order_items**         | users_read_own_order_items     | SELECT | Via order ownership                       |
| **order_items**         | users_create_own_order_items   | INSERT | Via order ownership                       |
| **inventory_movements** | admin_manage_inventory         | ALL    | `is_admin()`                              |
| **settings**            | admin_read_settings            | SELECT | `is_admin()`                              |
| **settings**            | admin_manage_settings          | ALL    | `is_admin()`                              |
| **admin_users**         | super_admin_manage_admins      | ALL    | `is_super_admin()`                        |
| **admin_users**         | admin_read_own_profile         | SELECT | `auth.uid() = id`                         |
| **push_subscriptions**  | users_manage_own_subscriptions | ALL    | `auth.uid() = user_id`                    |

---

## Troubleshooting

### Issue: "Invalid or expired token" on valid requests

**Diagnosis**:

- Check token is being passed correctly: `Authorization: Bearer <token>`
- Verify token hasn't expired (use JWT decoder)
- Check Supabase project URL/keys are correct

**Solutions**:

- Re-authenticate to get fresh token
- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` environment variables
- Check Supabase dashboard for auth service status

---

### Issue: "Insufficient permissions" for admin user

**Diagnosis**:

- Check user's `app_metadata.role`:
  ```sql
  SELECT raw_app_meta_data->>'role' FROM auth.users WHERE email = 'admin@example.com';
  ```
- Verify role is in allowed roles for endpoint

**Solutions**:

- Run role sync migration
- Manually set role:
  ```sql
  SELECT set_user_role('<user-id>', 'ADMIN');
  ```
- Check RLS helper functions (`is_admin()`, etc.) are defined

---

### Issue: Customer cannot see own orders

**Diagnosis**:

- Check RLS policy is enabled: `SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'orders';`
- Verify user is authenticated
- Check `user_id` matches `auth.uid()`

**Solutions**:

- Ensure user is signed in
- Verify order has correct `user_id` field
- Check RLS policy logic:
  ```sql
  SELECT * FROM pg_policies WHERE tablename = 'orders';
  ```

---

### Issue: Session not persisting across page reload

**Diagnosis**:

- Check `localStorage` contains Supabase session
- Verify `AuthProvider` is wrapping app
- Check `persistSession: true` in Supabase client config

**Solutions**:

- Ensure `AuthProvider` is in root layout
- Clear localStorage and re-login
- Check browser console for Supabase errors

---

### Issue: Cannot switch from NestJS auth to Supabase auth

**Diagnosis**:

- Check frontend is using new Supabase client, not old API service
- Verify environment variables are set
- Check feature flags are enabled

**Solutions**:

- Clear browser cache and localStorage
- Verify `.env.local` has Supabase credentials
- Check import statements use new Supabase client

---

## Appendix

### Admin User Seeding Script

```sql
-- Create initial super admin
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data
) VALUES (
  gen_random_uuid(),
  'superadmin@shoppk.com',
  crypt('admin123', gen_salt('bf')),
  NOW(),
  '{"role": "SUPER_ADMIN"}'::jsonb
);

-- Insert into admin_users table
INSERT INTO admin_users (id, email, role)
SELECT id, email, 'SUPER_ADMIN'::admin_role
FROM auth.users
WHERE email = 'superadmin@shoppk.com';
```

### Environment Variables Checklist

**Supabase Project**:

- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`

**Admin App** (`apps/admin/.env.local`):

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Storefront App** (`apps/storefront/.env.local`):

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

---

## Known Issues and Resolutions

### Issue: JWT Claim Path for Roles

**Problem**: Initial documentation showed incorrect JWT claim path `auth.jwt() ->> 'role'`.

**Root Cause**: Supabase nests roles inside `app_metadata` in the JWT, not at the root level.

**Correct Implementation**:

```sql
-- ✅ CORRECT
(auth.jwt() -> 'app_metadata' ->> 'role')::text

-- ❌ WRONG
(auth.jwt() ->> 'role')::text
```

**Impact**: All RLS functions (`is_admin()`, `is_super_admin()`) must use the correct path, otherwise authorization will fail for all admin operations.

**Verification**:

```sql
-- Test the correct path
SELECT
  email,
  raw_app_meta_data->>'role' AS metadata_role,
  (SELECT auth.jwt() -> 'app_metadata' ->> 'role') AS jwt_claim_role
FROM auth.users
WHERE email = 'admin@example.com';
```

---

### Issue: Guest Checkout Blocked by RLS

**Problem**: Current storefront supports WhatsApp-based guest checkout with `user_id IS NULL`, but customer isolation policies require `auth.uid() = user_id` which blocks anonymous users.

**Solution**: Add explicit guest checkout policy:

```sql
CREATE POLICY "allow_guest_order_creation" ON orders
  FOR INSERT
  WITH CHECK (user_id IS NULL);
```

**Testing**:

- Guest can create orders without authentication
- Authenticated users still restricted to own orders
- Admin can view all orders including guest orders

---

### Issue: Session State Drift

**Problem**: Zustand store only persists `hydrated` flag, not the session. If Supabase SDK and Zustand get out of sync, UI may show incorrect auth state.

**Solution**: Implemented session sync check in `AuthProvider` that runs every minute to detect and fix drift.

**Mitigation**:

- Store is now a cache of SDK state, not source of truth
- Sync interval checks for drift every 60 seconds
- Always query SDK for critical auth decisions

---

### Issue: Token Expiration During Long Operations

**Problem**: Bulk uploads or large reports may take longer than token TTL, causing 401 errors mid-operation.

**Solution**: Implemented `fetchWithRetry()` wrapper that:

1. Catches 401 responses
2. Calls `supabase.auth.refreshSession()`
3. Retries request with new token
4. Maximum 1 retry to avoid infinite loops

**Usage**: Wrap all API calls in `fetchWithRetry()` for automatic token refresh.

---

**Document Version:** 1.1  
**Last Updated:** May 26, 2026  
**Revision Notes:** Fixed JWT claim path, added guest checkout, password reset, email verification, admin provisioning, token refresh retry, and session sync improvements  
**Next Review:** After Phase 2 completion

**End of Document**
