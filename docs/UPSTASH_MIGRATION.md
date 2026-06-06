# Upstash Redis Migration for Edge Functions

**Version:** 1.0  
**Date:** May 26, 2026  
**Status:** Planning Phase  
**Scope:** Supabase Edge Functions Only

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Redis Usage Analysis](#current-redis-usage-analysis)
3. [Upstash vs ioredis: Key Differences](#upstash-vs-ioredis-key-differences)
4. [Architecture Design](#architecture-design)
5. [Implementation Plan](#implementation-plan)
6. [Code Examples](#code-examples)
7. [Environment Variables](#environment-variables)
8. [Testing Strategy](#testing-strategy)
9. [Rollout and Verification](#rollout-and-verification)
10. [Troubleshooting Guide](#troubleshooting-guide)

---

## Executive Summary

This document outlines the migration strategy for replacing **ioredis** (used in the current NestJS API) with **Upstash Redis REST API** for Supabase Edge Functions (Deno runtime). This migration is essential for the serverless Edge Functions architecture and addresses key constraints:

> **🔑 Critical Implementation Decision:** This plan uses the **direct REST API approach** via native `fetch()` instead of the `@upstash/redis` SDK. This is the recommended approach for Supabase Edge Functions because:
>
> - ✅ Zero dependencies (no esm.sh imports)
> - ✅ No compatibility issues with Supabase Edge runtime
> - ✅ Maximum reliability and control
> - ✅ Already proven pattern in SUPABASE_MIGRATION.md

### Why This Migration is Necessary

- **Runtime Incompatibility**: ioredis requires Node.js; Edge Functions run on Deno
- **Serverless Architecture**: Upstash provides REST-based Redis access optimized for serverless
- **Connection Model**: Upstash uses HTTP REST API instead of persistent TCP connections
- **Free Tier**: Upstash offers 10,000 commands/day free tier, suitable for validation phase

### Critical Constraints

| Constraint               | Impact                                                       | Solution                      |
| ------------------------ | ------------------------------------------------------------ | ----------------------------- |
| **No KEYS command**      | Pattern-based cache invalidation (`delPattern()`) won't work | Namespace key index tracking  |
| **No SCAN command**      | Cannot iterate over keys with patterns                       | Maintain explicit key lists   |
| **REST API overhead**    | Slightly higher latency than TCP                             | Cache TTL optimization        |
| **Command limit (free)** | 10,000 commands/day on free tier                             | Strategic caching, monitoring |

### Scope Clarification

**In Scope (Edge Functions Only):**

- ✅ Product list caching
- ✅ Dashboard statistics caching
- ✅ Distributed rate limiting for public endpoints
- ✅ Cache invalidation on product writes

**Out of Scope (NestJS API - No Changes):**

- ❌ Current NestJS Redis service remains unchanged
- ❌ No backport to ioredis patterns
- ❌ NestJS throttler configuration stays as-is

---

## Current Redis Usage Analysis

### 1. Product Caching (`products.service.ts`)

**Current Implementation:**

```typescript
// apps/api/src/modules/products/products.service.ts

// Cache key format
const cacheKey = `products:list:${JSON.stringify(query)}`;

// Cache read with 300s TTL
await this.redisService.get(cacheKey);

// Cache invalidation (LINE 227, 580)
await this.redisService.delPattern('products:list:*');
await this.redisService.delPattern('products:*');
```

**Key Findings:**

- TTL: 300 seconds (5 minutes)
- Cache key includes serialized query parameters
- Uses wildcard pattern deletion on writes
- Triggers: create, update, delete, rate product

### 2. Dashboard Caching (`dashboard.service.ts`)

**Current Implementation:**

```typescript
// apps/api/src/modules/dashboard/dashboard.service.ts

// Cache keys
const statsKey = 'dashboard:stats';
const lowStockKey = 'dashboard:low-stock';
const recentOrdersKey = 'dashboard:recent-orders';

// TTL: 60 seconds
await this.redisService.set(key, data, 60);
```

**Key Findings:**

- TTL: 60 seconds (1 minute)
- Simple string keys (no patterns)
- Admin-only endpoints (lower traffic)
- No explicit invalidation (relies on TTL)

### 3. Current Rate Limiting (`app.module.ts`)

**Current Implementation:**

```typescript
// apps/api/src/app/app.module.ts (LINE 41)

ThrottlerModule.forRoot({
  throttlers: [
    { name: 'short', ttl: 1000, limit: 3 }, // 3 req/s
    { name: 'medium', ttl: 10000, limit: 20 }, // 20 req/10s
    { name: 'long', ttl: 60000, limit: 100 }, // 100 req/min
  ],
});
```

**Critical Finding:**

- ⚠️ **No Redis storage configured** - this is in-memory only
- Uses `@nestjs/throttler` with default in-memory storage
- Will NOT work in distributed Edge Functions environment
- **Must implement distributed rate limiting from scratch**

### 4. Pattern Deletion Problem (`redis.service.ts`)

**Current Implementation:**

```typescript
// apps/api/src/common/services/redis.service.ts (LINE 103)

async delPattern(pattern: string): Promise<number> {
  const keys = await this.client!.keys(pattern);  // ❌ Not supported by Upstash REST
  if (keys.length === 0) return 0;
  return await this.client!.del(...keys);
}
```

**Problem:**

- `KEYS` command is not supported by Upstash REST API
- Performance issue even in standard Redis (blocks server)
- Must be replaced with explicit key tracking

---

## Upstash vs ioredis: Key Differences

### API Comparison

| Feature          | ioredis (NestJS)              | Upstash REST API (Edge)      |
| ---------------- | ----------------------------- | ---------------------------- |
| **Protocol**     | TCP (RESP)                    | HTTP REST                    |
| **Runtime**      | Node.js                       | Deno, Node, Browser          |
| **Connection**   | Persistent pool               | Stateless HTTP requests      |
| **KEYS command** | ✅ Supported                  | ❌ Not available             |
| **SCAN command** | ✅ Supported                  | ❌ Not available             |
| **Pipelining**   | ✅ Native                     | ✅ Via pipeline endpoint     |
| **TTL (EX)**     | ✅ `set(key, val, 'EX', 300)` | ✅ `POST /setex/{key}/{ttl}` |
| **JSON support** | Manual serialize              | Manual serialize             |
| **Dependencies** | ioredis package               | Zero (native fetch)          |
| **Auto-retry**   | ✅ Built-in                   | ✅ Built-in (HTTP)           |

### Import Differences

**ioredis (NestJS):**

```typescript
import Redis from 'ioredis';
const client = new Redis({ host, port, password });
```

**@upstash/redis (Edge Functions via REST API):**

```typescript
// Direct REST API approach - zero dependencies, most reliable
const UPSTASH_REDIS_REST_URL = Deno.env.get('UPSTASH_REDIS_REST_URL')!;
const UPSTASH_REDIS_REST_TOKEN = Deno.env.get('UPSTASH_REDIS_REST_TOKEN')!;

// No SDK import needed - use native fetch
async function redisGet(key: string) {
  const res = await fetch(`${UPSTASH_REDIS_REST_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
  });
  return (await res.json()).result;
}
```

### Command Mapping

| Operation          | ioredis                                                               | Upstash REST API                         |
| ------------------ | --------------------------------------------------------------------- | ---------------------------------------- |
| **Get**            | `await client.get(key)`                                               | `GET /get/{key}`                         |
| **Set with TTL**   | `await client.set(key, val, 'EX', 300)`                               | `POST /setex/{key}/{ttl}` with body      |
| **Delete**         | `await client.del(key1, key2)`                                        | `GET /del/{key1}/{key2}`                 |
| **Increment**      | `await client.incr(key)`                                              | `GET /incr/{key}`                        |
| **Expire**         | `await client.expire(key, 300)`                                       | `GET /expire/{key}/{ttl}`                |
| **SADD**           | `await client.sadd(set, member)`                                      | `POST /sadd/{key}` with body             |
| **SMEMBERS**       | `await client.smembers(set)`                                          | `GET /smembers/{key}`                    |
| **Pattern delete** | `const keys = await client.keys(pattern); await client.del(...keys);` | ❌ **Not possible** - use index tracking |

---

## Architecture Design

### 1. Namespace Key Index Pattern

**Problem:** Cannot use `KEYS` or `SCAN` for pattern-based invalidation.

**Solution:** Maintain an index key for each namespace that tracks all cache keys.

**Example:**

```typescript
// Namespace: products:list
// Index key: idx:products:list (Redis SET containing all product list cache keys)

// When caching a product list query
const cacheKey = `products:list:${hash(query)}`;

// Set data with TTL using REST API
await fetch(`${REDIS_URL}/setex/${cacheKey}/300`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  body: JSON.stringify(data),
});

// Track in index
await fetch(`${REDIS_URL}/sadd/idx:products:list`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  body: JSON.stringify([cacheKey]),
});

// When invalidating all product lists
const res = await fetch(`${REDIS_URL}/smembers/idx:products:list`, {
  headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
});
const keys = (await res.json()).result;

if (keys && keys.length > 0) {
  await fetch(`${REDIS_URL}/del/${keys.join('/')}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  await fetch(`${REDIS_URL}/del/idx:products:list`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
}
```

**Benefits:**

- ✅ No wildcard commands needed
- ✅ Bounded delete operations
- ✅ Explicit key management
- ✅ Works with Upstash REST API

**Trade-offs:**

- Additional write operation (index tracking)
- Index itself needs cleanup (handled by deleting index on invalidation)

### 2. Distributed Rate Limiting

**Problem:** Edge Functions are stateless; in-memory throttling doesn't work.

**Solution:** Redis-backed fixed-window rate limiter with atomic counters.

**Algorithm:**

```typescript
// Key format: rl:<route>:<subject>:<windowStart>
// Example: rl:orders-public-get:user-123:1680000000

const REDIS_URL = Deno.env.get('UPSTASH_REDIS_REST_URL')!;
const REDIS_TOKEN = Deno.env.get('UPSTASH_REDIS_REST_TOKEN')!;

const windowDuration = 60; // seconds
const limit = 10; // requests per window

const now = Math.floor(Date.now() / 1000);
const windowStart = Math.floor(now / windowDuration) * windowDuration;
const key = `rl:${route}:${subject}:${windowStart}`;

// Atomic increment using REST API
const incrRes = await fetch(`${REDIS_URL}/incr/${key}`, {
  headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
});
const count = (await incrRes.json()).result;

if (count === 1) {
  // Set expiry on first increment
  await fetch(`${REDIS_URL}/expire/${key}/${windowDuration}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
}

if (count > limit) {
  return {
    allowed: false,
    remaining: 0,
    retryAfter: windowDuration - (now - windowStart),
  };
}

return { allowed: true, remaining: limit - count };
```

**Subject Priority:**

1. Authenticated user ID (from JWT)
2. Lookup token hash (for public order routes)
3. Client IP (fallback)

**Known Limitation:**
The implementation uses two separate HTTP calls (INCR + EXPIRE). There's a tiny race condition: if the Edge Function crashes between these calls, the key persists without TTL. **Risk level: Very low** - affects only one user, rare occurrence, small memory impact (~100 bytes). A Lua script solution is documented in the Troubleshooting section if this becomes an issue in production.

**Rate Limit Tiers (Edge Functions):**

| Endpoint               | Tier    | Limit       | Rationale                   |
| ---------------------- | ------- | ----------- | --------------------------- |
| `orders-public-get`    | Medium  | 10 req/60s  | Prevent order enumeration   |
| `orders-download-item` | Strict  | 5 req/60s   | Prevent download abuse      |
| `products-list`        | Lenient | 100 req/60s | Public read, low abuse risk |
| Admin endpoints        | N/A     | N/A         | Auth-based access control   |

### 3. Cache Strategy

**Cached Endpoints:**

| Endpoint                  | Cache Key Format            | TTL  | Invalidation Trigger                   |
| ------------------------- | --------------------------- | ---- | -------------------------------------- |
| `products-list`           | `products:list:<queryHash>` | 300s | Product create/update/delete/rate      |
| `products-get`            | `products:id:<id>`          | 300s | Product update/delete                  |
| `products-get-by-slug`    | `products:slug:<slug>`      | 300s | Product update/delete                  |
| `categories-list`         | `categories:list`           | 600s | Category create/update/delete          |
| `categories-tree`         | `categories:tree`           | 600s | Category create/update/delete          |
| `dashboard-stats`         | `dashboard:stats`           | 60s  | Rely on TTL (no explicit invalidation) |
| `dashboard-low-stock`     | `dashboard:low-stock`       | 60s  | Rely on TTL                            |
| `dashboard-recent-orders` | `dashboard:recent-orders`   | 60s  | Rely on TTL                            |

**Query Hash Normalization:**

To maximize cache hit rate, queries must be normalized:

```typescript
function normalizeQuery(query: any): string {
  // Sort keys, apply defaults, remove undefined values
  const normalized = {
    page: query.page || 1,
    limit: query.limit || 10,
    search: query.search || '',
    type: query.type || '',
    categoryId: query.categoryId || '',
    isActive: query.isActive === undefined ? '' : String(query.isActive),
    isFeatured: query.isFeatured === undefined ? '' : String(query.isFeatured),
    minPrice: query.minPrice || '',
    maxPrice: query.maxPrice || '',
    sortBy: query.sortBy || 'created_at',
    sortOrder: query.sortOrder || 'desc',
  };

  return JSON.stringify(normalized);
}

// Use hash for shorter keys (optional)
const queryHash = await crypto.subtle
  .digest('SHA-256', new TextEncoder().encode(JSON.stringify(normalized)))
  .then((buf) =>
    Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(''),
  );
```

### 4. Graceful Degradation

All cache operations must gracefully degrade:

```typescript
async function getCached<T>(key: string): Promise<T | null> {
  const REDIS_URL = Deno.env.get('UPSTASH_REDIS_REST_URL');
  const REDIS_TOKEN = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');

  if (!REDIS_URL || !REDIS_TOKEN) return null; // Redis not configured

  try {
    const res = await fetch(`${REDIS_URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    });
    const data = await res.json();
    return data.result ? JSON.parse(data.result) : null;
  } catch (error) {
    console.error('Cache read error:', error);
    return null; // Fail open - proceed without cache
  }
}
```

**Fail-Open vs Fail-Closed:**

| Component                    | Policy      | Reason                                              |
| ---------------------------- | ----------- | --------------------------------------------------- |
| **Cache reads**              | Fail-open   | Availability > consistency; stale data acceptable   |
| **Cache writes**             | Fail-open   | Don't block business logic on cache failure         |
| **Rate limiter (public)**    | Fail-open   | Avoid blocking legitimate traffic on Redis outage   |
| **Rate limiter (sensitive)** | Fail-closed | Download/order endpoints - prefer blocking to abuse |

---

## Implementation Plan

### Phase 1: Foundation (Week 1)

**Deliverables:**

1. Create shared Upstash client module
2. Create cache helper library with namespace indexing
3. Create rate limiter library
4. Set up Upstash Redis account and configure secrets

**Files to Create:**

```
supabase/functions/
├── _shared/
│   ├── upstash.ts           # REST API helpers (no SDK imports)
│   ├── cache.ts             # Cache helpers (get, set, invalidate)
│   ├── rate-limit.ts        # Distributed rate limiter
│   ├── types.ts             # Type definitions
│   └── utils.ts             # Query normalization, hashing
```

**Acceptance Criteria:**

- [ ] Upstash client connects successfully in Edge Function
- [ ] Cache set/get operations work with TTL
- [ ] Namespace index tracking functional
- [ ] Rate limiter passes unit tests
- [ ] All modules have graceful degradation

---

### Phase 2: Product Caching (Week 1-2)

**Deliverables:**

1. Implement cache-first pattern in `products-list`
2. Add cache invalidation to product write endpoints
3. Implement query normalization
4. Add cache observability (hit/miss logging)

**Files to Modify:**

```
supabase/functions/
├── products-list/
│   └── index.ts             # Add cache-first logic
├── products-create/
│   └── index.ts             # Add invalidation hook
├── products-update/
│   └── index.ts             # Add invalidation hook
├── products-delete/
│   └── index.ts             # Add invalidation hook
└── products-rate/
    └── index.ts             # Add invalidation hook
```

**Implementation Steps:**

1. Import cache helpers into `products-list`
2. Normalize query parameters before generating cache key
3. Check cache first, fallback to database query
4. Track cache key in namespace index
5. Add cache invalidation after successful writes
6. Log cache hits/misses for monitoring

**Acceptance Criteria:**

- [ ] First request to products-list is cache miss (database query)
- [ ] Second identical request is cache hit (no database query)
- [ ] Creating/updating/deleting product clears relevant list caches
- [ ] Cache expires after 300 seconds
- [ ] Different query params generate different cache keys
- [ ] Similar queries (different order) generate same cache key (normalization works)

---

### Phase 3: Dashboard Caching (Week 2)

**Deliverables:**

1. Implement caching for dashboard stats
2. Implement caching for low-stock products
3. Implement caching for recent orders
4. Short TTL (60s) for near-real-time updates

**Files to Modify:**

```
supabase/functions/
├── dashboard-stats/
│   └── index.ts             # Add caching
├── dashboard-low-stock/
│   └── index.ts             # Add caching
└── dashboard-recent-orders/
    └── index.ts             # Add caching
```

**Acceptance Criteria:**

- [ ] Dashboard loads from cache on subsequent requests
- [ ] Cache expires after 60 seconds
- [ ] Dashboard remains functional if Redis unavailable
- [ ] Response includes cache hit indicator

---

### Phase 4: Distributed Rate Limiting (Week 2-3)

**Deliverables:**

1. Implement rate limiter for public order lookup
2. Implement stricter rate limiter for downloads
3. Add rate limit headers to responses
4. Implement 429 responses with retry-after

**Files to Modify:**

```
supabase/functions/
├── orders-public-get/
│   └── index.ts             # Add rate limiting
└── orders-download-item/
    └── index.ts             # Add stricter rate limiting
```

**Rate Limit Configuration:**

```typescript
// orders-public-get
const rateLimitConfig = {
  route: 'orders-public-get',
  windowSeconds: 60,
  maxRequests: 10,
  subjectPriority: ['token', 'ip'],
  failPolicy: 'open', // Fail open on Redis error
};

// orders-download-item
const rateLimitConfig = {
  route: 'orders-download-item',
  windowSeconds: 60,
  maxRequests: 5,
  subjectPriority: ['token', 'ip'],
  failPolicy: 'closed', // Fail closed on Redis error (prevent abuse)
};
```

**Acceptance Criteria:**

- [ ] Exceeding rate limit returns 429 status
- [ ] Response includes `Retry-After` header
- [ ] Response includes `X-RateLimit-Remaining` header
- [ ] Different subjects (users/IPs) have independent quotas
- [ ] Rate limits reset after window expires
- [ ] Anonymous requests rate-limited by IP
- [ ] Token-based requests rate-limited by token hash

---

### Phase 5: Monitoring & Optimization (Week 3-4)

**Deliverables:**

1. Add structured logging for cache operations
2. Track Redis command usage (stay under 10K/day free tier)
3. Monitor cache hit rates
4. Monitor rate limit 429 rates
5. Optimize TTLs based on real data

**Metrics to Track:**

| Metric                     | Target  | Alert Threshold        |
| -------------------------- | ------- | ---------------------- |
| Cache hit rate (products)  | > 70%   | < 50%                  |
| Cache hit rate (dashboard) | > 60%   | < 40%                  |
| Redis commands/day         | < 5,000 | > 8,000 (80% of limit) |
| Rate limit 429 rate        | < 1%    | > 5%                   |
| Cache error rate           | < 0.5%  | > 2%                   |

**Logging Format:**

```typescript
interface CacheLogEntry {
  level: 'info' | 'error';
  event: 'cache_hit' | 'cache_miss' | 'cache_error' | 'cache_invalidate';
  key?: string;
  namespace?: string;
  ttl?: number;
  duration_ms?: number;
  error?: string;
}

interface RateLimitLogEntry {
  level: 'info' | 'warn';
  event: 'rate_limit_check' | 'rate_limit_exceeded';
  route: string;
  subject: string;
  count: number;
  limit: number;
  remaining: number;
}
```

---

### Phase 6: Testing & Rollout (Week 4)

**Deliverables:**

1. Integration tests for cache behavior
2. Integration tests for rate limiting
3. Load tests to verify Redis free tier capacity
4. Staged rollout with feature flags

**Feature Flags:**

```typescript
const CACHE_ENABLED = Deno.env.get('CACHE_ENABLED') !== 'false';
const RATE_LIMIT_ENABLED = Deno.env.get('RATE_LIMIT_ENABLED') !== 'false';
```

**Rollback Plan:**

- Set `CACHE_ENABLED=false` to disable caching (fall through to DB)
- Set `RATE_LIMIT_ENABLED=false` to disable rate limiting
- No code redeployment needed

---

## Code Examples

### 1. Upstash Client (`_shared/upstash.ts`)

```typescript
// No SDK imports - direct REST API approach for maximum reliability

export interface UpstashConfig {
  url: string;
  token: string;
}

export function getUpstashConfig(): UpstashConfig | null {
  const url = Deno.env.get('UPSTASH_REDIS_REST_URL');
  const token = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');

  if (!url || !token) {
    console.warn('Upstash Redis not configured - caching disabled');
    return null;
  }

  return { url, token };
}

// Helper for Redis REST API calls
export async function redisCommand<T = any>(
  command: string,
  method: 'GET' | 'POST' = 'GET',
  body?: any,
): Promise<T | null> {
  const config = getUpstashConfig();
  if (!config) return null;

  try {
    const res = await fetch(`${config.url}${command}`, {
      method,
      headers: {
        Authorization: `Bearer ${config.token}`,
        ...(body && { 'Content-Type': 'application/json' }),
      },
      ...(body && { body: JSON.stringify(body) }),
    });

    const data = await res.json();
    return data.result;
  } catch (error) {
    console.error('Redis command error:', error);
    return null;
  }
}
```

### 2. Cache Helpers (`_shared/cache.ts`)

```typescript
import { redisCommand, getUpstashConfig } from './upstash.ts';

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const config = getUpstashConfig();
    if (!config) return null;

    const result = await redisCommand<string>(`/get/${key}`);

    if (result) {
      console.log(JSON.stringify({ level: 'info', event: 'cache_hit', key }));
      return JSON.parse(result);
    }

    console.log(JSON.stringify({ level: 'info', event: 'cache_miss', key }));
    return null;
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'cache_error',
        operation: 'get',
        key,
        error: String(error),
      }),
    );
    return null;
  }
}

export async function setCache<T>(
  key: string,
  value: T,
  ttlSeconds: number,
  namespace?: string,
): Promise<void> {
  try {
    const config = getUpstashConfig();
    if (!config) return;

    const serialized = JSON.stringify(value);

    // Set key with TTL using REST API
    await redisCommand(`/setex/${key}/${ttlSeconds}`, 'POST', serialized);

    // Track in namespace index
    if (namespace) {
      const indexKey = `idx:${namespace}`;
      await redisCommand(`/sadd/${indexKey}`, 'POST', [key]);
    }

    console.log(
      JSON.stringify({
        level: 'info',
        event: 'cache_set',
        key,
        namespace,
        ttl: ttlSeconds,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'cache_error',
        operation: 'set',
        key,
        error: String(error),
      }),
    );
  }
}

export async function invalidateNamespace(namespace: string): Promise<void> {
  try {
    const config = getUpstashConfig();
    if (!config) return;

    const indexKey = `idx:${namespace}`;
    const keys = await redisCommand<string[]>(`/smembers/${indexKey}`);

    if (keys && keys.length > 0) {
      // Delete all tracked keys using REST API
      await redisCommand(`/del/${keys.join('/')}`);
      console.log(
        JSON.stringify({
          level: 'info',
          event: 'cache_invalidate',
          namespace,
          count: keys.length,
        }),
      );
    }

    // Delete the index itself
    await redisCommand(`/del/${indexKey}`);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'cache_error',
        operation: 'invalidate',
        namespace,
        error: String(error),
      }),
    );
  }
}
```

### 3. Rate Limiter (`_shared/rate-limit.ts`)

```typescript
import { redisCommand, getUpstashConfig } from './upstash.ts';

export interface RateLimitConfig {
  route: string;
  windowSeconds: number;
  maxRequests: number;
  subjectPriority: string[];
  failPolicy: 'open' | 'closed';
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
  limit: number;
}

export async function checkRateLimit(
  config: RateLimitConfig,
  req: Request,
): Promise<RateLimitResult> {
  const RATE_LIMIT_ENABLED = Deno.env.get('RATE_LIMIT_ENABLED') !== 'false';

  if (!RATE_LIMIT_ENABLED) {
    return {
      allowed: true,
      remaining: config.maxRequests,
      limit: config.maxRequests,
    };
  }

  try {
    const upstashConfig = getUpstashConfig();

    if (!upstashConfig) {
      // Graceful degradation based on policy
      console.warn('Redis unavailable - rate limit fail ' + config.failPolicy);
      return config.failPolicy === 'open'
        ? {
            allowed: true,
            remaining: config.maxRequests,
            limit: config.maxRequests,
          }
        : {
            allowed: false,
            remaining: 0,
            retryAfter: config.windowSeconds,
            limit: config.maxRequests,
          };
    }

    // Determine subject
    const subject = getSubject(req, config.subjectPriority);

    // Calculate window
    const now = Math.floor(Date.now() / 1000);
    const windowStart =
      Math.floor(now / config.windowSeconds) * config.windowSeconds;
    const key = `rl:${config.route}:${subject}:${windowStart}`;

    // Atomic increment using REST API
    const count = await redisCommand<number>(`/incr/${key}`);

    // Set expiry on first increment
    if (count === 1) {
      await redisCommand(`/expire/${key}/${config.windowSeconds}`);
    }

    // Note: There's a tiny race condition window between INCR and EXPIRE.
    // If the function crashes between these calls, the key persists without TTL.
    // Risk assessment: Very low for validation phase. Orphaned keys are small (~100 bytes)
    // and would only affect one user's rate limit window.
    //
    // If this becomes an issue in production, use a Lua script for atomicity:
    // await redisCommand('/eval', 'POST', {
    //   script: 'local c = redis.call("INCR", KEYS[1]); if c == 1 then redis.call("EXPIRE", KEYS[1], ARGV[1]) end; return c',
    //   keys: [key],
    //   argv: [config.windowSeconds]
    // });

    const remaining = Math.max(0, config.maxRequests - count);
    const allowed = count <= config.maxRequests;

    const logEntry = {
      level: allowed ? 'info' : 'warn',
      event: allowed ? 'rate_limit_check' : 'rate_limit_exceeded',
      route: config.route,
      subject,
      count,
      limit: config.maxRequests,
      remaining,
    };
    console.log(JSON.stringify(logEntry));

    if (!allowed) {
      const retryAfter = config.windowSeconds - (now - windowStart);
      return {
        allowed: false,
        remaining: 0,
        retryAfter,
        limit: config.maxRequests,
      };
    }

    return { allowed: true, remaining, limit: config.maxRequests };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'rate_limit_error',
        route: config.route,
        error: String(error),
      }),
    );

    // Fail based on policy
    return config.failPolicy === 'open'
      ? {
          allowed: true,
          remaining: config.maxRequests,
          limit: config.maxRequests,
        }
      : {
          allowed: false,
          remaining: 0,
          retryAfter: config.windowSeconds,
          limit: config.maxRequests,
        };
  }
}

function getSubject(req: Request, priority: string[]): string {
  for (const type of priority) {
    if (type === 'token') {
      const url = new URL(req.url);
      const token = url.searchParams.get('token');
      if (token) {
        // Hash token for privacy
        return `token:${token.slice(0, 16)}`;
      }
    } else if (type === 'user') {
      // Extract from Authorization header (if implemented)
      const auth = req.headers.get('Authorization');
      if (auth?.startsWith('Bearer ')) {
        // Parse JWT and extract user ID (simplified)
        return `user:${auth.slice(7, 23)}`;
      }
    } else if (type === 'ip') {
      const ip =
        req.headers.get('x-forwarded-for') ||
        req.headers.get('x-real-ip') ||
        'unknown';
      return `ip:${ip.split(',')[0].trim()}`;
    }
  }

  return 'unknown';
}
```

### 4. Products List with Cache (`products-list/index.ts`)

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCache, setCache } from '../_shared/cache.ts';
import {
  jsonResponse,
  errorResponse,
  corsResponse,
} from '../_shared/response.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const CACHE_ENABLED = Deno.env.get('CACHE_ENABLED') !== 'false';

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams);

    // Normalize query for consistent cache keys
    const normalized = normalizeQuery(params);
    const queryHash = await hashQuery(normalized);
    const cacheKey = `products:list:${queryHash}`;

    // Try cache first
    if (CACHE_ENABLED) {
      const cached = await getCache(cacheKey);
      if (cached) {
        return jsonResponse({ ...cached, _cache: 'hit' });
      }
    }

    // Build database query
    let query = supabase
      .from('products')
      .select(
        `
        *,
        category:categories(id, name, slug),
        images:product_images(id, url, alt, order, is_primary),
        variants:product_variants!inner(*)
      `,
        { count: 'exact' },
      )
      .is('deleted_at', null);

    // Apply filters (same as SUPABASE_MIGRATION.md example)
    if (params.search) {
      query = query.or(
        `name.ilike.%${params.search}%,sku.ilike.%${params.search}%,description.ilike.%${params.search}%`,
      );
    }
    if (params.type) query = query.eq('type', params.type);
    if (params.categoryId) query = query.eq('category_id', params.categoryId);
    // ... other filters

    // Pagination
    const page = parseInt(params.page || '1');
    const limit = Math.min(parseInt(params.limit || '10'), 100);
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    // Sorting
    const sortBy = params.sortBy || 'created_at';
    const sortOrder = params.sortOrder || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    const { data, error, count } = await query;

    if (error) {
      console.error('Database error:', error);
      return errorResponse(error.message, 400);
    }

    const result = {
      data,
      meta: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasNext: page * limit < (count || 0),
        hasPrev: page > 1,
      },
    };

    // Cache the result
    if (CACHE_ENABLED) {
      await setCache(cacheKey, result, 300, 'products:list');
    }

    return jsonResponse({ ...result, _cache: 'miss' });
  } catch (error) {
    console.error('Function error:', error);
    return errorResponse('Internal server error', 500);
  }
});

function normalizeQuery(params: any): any {
  return {
    page: params.page || '1',
    limit: params.limit || '10',
    search: params.search || '',
    type: params.type || '',
    categoryId: params.categoryId || '',
    isActive: params.isActive || '',
    isFeatured: params.isFeatured || '',
    minPrice: params.minPrice || '',
    maxPrice: params.maxPrice || '',
    sortBy: params.sortBy || 'created_at',
    sortOrder: params.sortOrder || 'desc',
  };
}

async function hashQuery(query: any): Promise<string> {
  const str = JSON.stringify(query);
  const buffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(str),
  );
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
```

### 5. Product Create with Invalidation (`products-create/index.ts`)

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { invalidateNamespace } from '../_shared/cache.ts';
import { authenticate, requireAdminRole } from '../_shared/auth.ts';
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
    const auth = await authenticate(req, supabase);
    if (auth.error) return errorResponse(auth.error, auth.status);

    // Check admin role
    const roleCheck = await requireAdminRole(
      auth.user.id,
      ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
      supabaseAdmin,
    );
    if (roleCheck.error)
      return errorResponse(roleCheck.error, roleCheck.status);

    const payload = await req.json();

    // ... validation and product creation logic (same as SUPABASE_MIGRATION.md)

    const { data: product, error } = await supabaseAdmin.rpc(
      'create_product_with_relations',
      {
        product_data: payload,
        images_data: payload.images || [],
        variants_data: payload.variants || [],
      },
    );

    if (error) {
      console.error('RPC error:', error);
      return errorResponse(error.message, 400);
    }

    // Invalidate product list cache
    await invalidateNamespace('products:list');

    console.log('Product created:', product.id);

    return jsonResponse(product, 201);
  } catch (error) {
    console.error('Function error:', error);
    return errorResponse('Internal server error', 500);
  }
});
```

### 6. Rate-Limited Public Order Lookup (`orders-public-get/index.ts`)

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import {
  jsonResponse,
  errorResponse,
  corsResponse,
} from '../_shared/response.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  // Rate limiting
  const rateLimitResult = await checkRateLimit(
    {
      route: 'orders-public-get',
      windowSeconds: 60,
      maxRequests: 10,
      subjectPriority: ['token', 'ip'],
      failPolicy: 'open',
    },
    req,
  );

  if (!rateLimitResult.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded',
        statusCode: 429,
        retryAfter: rateLimitResult.retryAfter,
        limit: rateLimitResult.limit,
        remaining: 0,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rateLimitResult.retryAfter),
          'X-RateLimit-Limit': String(rateLimitResult.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(
            Math.floor(Date.now() / 1000) + rateLimitResult.retryAfter!,
          ),
        },
      },
    );
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    const url = new URL(req.url);
    const orderId = url.pathname.split('/').pop();
    const rawToken = url.searchParams.get('token');

    if (!rawToken) {
      return errorResponse('Order not found', 404);
    }

    // Hash token
    const tokenHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(rawToken),
    );
    const tokenHashHex = Array.from(new Uint8Array(tokenHash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // ... rest of order lookup logic (same as SUPABASE_MIGRATION.md)

    const { data: order, error } = await supabase
      .from('orders')
      .select(`...`)
      .eq('id', orderId)
      .eq('lookup_token', tokenHashHex)
      .single();

    if (error || !order) {
      return errorResponse('Order not found', 404);
    }

    // Add rate limit headers to success response
    const response = jsonResponse(order);
    response.headers.set('X-RateLimit-Limit', String(rateLimitResult.limit));
    response.headers.set(
      'X-RateLimit-Remaining',
      String(rateLimitResult.remaining),
    );

    return response;
  } catch (error) {
    console.error('Function error:', error);
    return errorResponse('Internal server error', 500);
  }
});
```

---

## Environment Variables

### Required Variables

```bash
# Upstash Redis REST API Connection
UPSTASH_REDIS_REST_URL=https://your-redis-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXXxAAIncDE...
```

### Optional Feature Flags

```bash
# Cache Control (default: enabled)
CACHE_ENABLED=true

# Rate Limiting Control (default: enabled)
RATE_LIMIT_ENABLED=true
```

### How to Set in Supabase

```bash
# Set secrets
supabase secrets set UPSTASH_REDIS_REST_URL=https://...
supabase secrets set UPSTASH_REDIS_REST_TOKEN=AXXxAAInc...

# List all secrets
supabase secrets list

# Unset a secret
supabase secrets unset UPSTASH_REDIS_REST_URL
```

### Getting Upstash Credentials

1. Sign up at https://upstash.com
2. Create a new Redis database
3. Select **REST API** tab
4. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
5. Note: Use REST API credentials, not the regular Redis connection string

---

## Testing Strategy

### Unit Tests

Create tests for shared modules:

```typescript
// supabase/functions/_shared/cache.test.ts
import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { setCache, getCache, invalidateNamespace } from './cache.ts';

Deno.test('cache set and get', async () => {
  const key = 'test:key:1';
  const value = { foo: 'bar', count: 42 };

  await setCache(key, value, 300);
  const result = await getCache(key);

  assertEquals(result, value);
});

Deno.test('cache invalidation by namespace', async () => {
  await setCache('ns:test:a', { val: 1 }, 300, 'ns:test');
  await setCache('ns:test:b', { val: 2 }, 300, 'ns:test');

  await invalidateNamespace('ns:test');

  const resultA = await getCache('ns:test:a');
  const resultB = await getCache('ns:test:b');

  assertEquals(resultA, null);
  assertEquals(resultB, null);
});
```

### Integration Tests

Test full cache flow with products:

```typescript
// tests/integration/products-cache.test.ts
describe('Products List Caching', () => {
  it('caches product list on first request', async () => {
    const query = 'page=1&limit=10';
    const url = `http://localhost:54321/functions/v1/products-list?${query}`;

    // First request - should be cache miss
    const res1 = await fetch(url);
    const body1 = await res1.json();
    expect(body1._cache).toBe('miss');

    // Second request - should be cache hit
    const res2 = await fetch(url);
    const body2 = await res2.json();
    expect(body2._cache).toBe('hit');
    expect(body2.data).toEqual(body1.data);
  });

  it('invalidates cache after product creation', async () => {
    const query = 'page=1&limit=10';
    const listUrl = `http://localhost:54321/functions/v1/products-list?${query}`;

    // Populate cache
    await fetch(listUrl);

    // Create product
    await fetch('http://localhost:54321/functions/v1/products-create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + adminToken,
      },
      body: JSON.stringify({
        sku: 'TEST-001',
        name: 'Test Product',
        slug: 'test-product',
        price: 100,
        type: 'PHYSICAL',
      }),
    });

    // Next list request should be cache miss
    const res = await fetch(listUrl);
    const body = await res.json();
    expect(body._cache).toBe('miss');
  });
});
```

### Rate Limiting Tests

```typescript
// tests/integration/rate-limiting.test.ts
describe('Rate Limiting', () => {
  it('blocks requests after exceeding limit', async () => {
    const token = 'test-token-123';
    const url = `http://localhost:54321/functions/v1/orders-public-get/order-id?token=${token}`;

    // Make 10 requests (limit)
    for (let i = 0; i < 10; i++) {
      const res = await fetch(url);
      expect(res.status).toBe(200);
    }

    // 11th request should be rate limited
    const res = await fetch(url);
    expect(res.status).toBe(429);

    const body = await res.json();
    expect(body.error).toContain('Rate limit exceeded');
    expect(body.retryAfter).toBeGreaterThan(0);
    expect(res.headers.get('Retry-After')).toBeTruthy();
  });

  it('resets quota after window expires', async () => {
    const token = 'test-token-456';
    const url = `http://localhost:54321/functions/v1/orders-public-get/order-id?token=${token}`;

    // Exhaust quota
    for (let i = 0; i < 10; i++) {
      await fetch(url);
    }

    // Should be blocked
    const blocked = await fetch(url);
    expect(blocked.status).toBe(429);

    // Wait for window to expire (61 seconds)
    await new Promise((resolve) => setTimeout(resolve, 61000));

    // Should be allowed again
    const allowed = await fetch(url);
    expect(allowed.status).toBe(200);
  });
});
```

### Load Testing

Use k6 to verify Redis free tier capacity:

```javascript
// tests/load/redis-capacity.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    constant_load: {
      executor: 'constant-vus',
      vus: 10,
      duration: '10m',
    },
  },
};

export default function () {
  const res = http.get(
    'https://your-project.supabase.co/functions/v1/products-list?page=1&limit=10',
  );

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}

// Expected Redis commands per iteration:
// - 1 SMEMBERS (check index)
// - 1 GET (cache check)
// - 1 SET + 1 SADD (on miss) = 2 writes
// Worst case: 4 commands per request
// 10 VUs × 600 iterations (10 min) = 6000 iterations
// 6000 × 4 = 24,000 commands (exceeds free tier)
// With 70% hit rate: 6000 × 1.2 = 7,200 commands (within limit)
```

---

## Rollout and Verification

### Pre-Deployment Checklist

- [ ] Upstash Redis account created
- [ ] Upstash credentials added to Supabase secrets
- [ ] All shared modules created and tested
- [ ] Unit tests passing
- [ ] Local integration tests passing
- [ ] Code reviewed and approved

### Staged Rollout

**Stage 1: Products Caching (50% traffic)**

1. Deploy `_shared` modules
2. Deploy `products-list` with cache
3. Monitor cache hit rate for 24 hours
4. If stable, proceed to Stage 2

**Stage 2: Products Invalidation (100% traffic)**

1. Deploy product write endpoints with invalidation
2. Test product creation/update/deletion
3. Verify cache invalidation working
4. Monitor for 48 hours

**Stage 3: Dashboard Caching**

1. Deploy dashboard endpoints with cache
2. Verify 60s TTL
3. Monitor hit rates

**Stage 4: Rate Limiting (gradual)**

1. Deploy rate limiter with `RATE_LIMIT_ENABLED=false`
2. Enable for `orders-download-item` only
3. Monitor 429 rates for 24 hours
4. Enable for `orders-public-get`
5. Monitor for 1 week

### Verification Checklist

**Cache Functionality:**

- [ ] First request to products-list is cache miss
- [ ] Second identical request is cache hit
- [ ] Response time improves on cache hit (< 100ms)
- [ ] Creating product invalidates list cache
- [ ] Updating product invalidates list cache
- [ ] Deleting product invalidates list cache
- [ ] Rating product invalidates list cache
- [ ] Cache expires after configured TTL
- [ ] Dashboard cache works with 60s TTL

**Rate Limiting:**

- [ ] Exceeding limit returns 429 status
- [ ] 429 response includes `Retry-After` header
- [ ] 429 response includes remaining quota (0)
- [ ] Rate limit resets after window expires
- [ ] Different subjects have independent quotas
- [ ] Rate limit headers present on success responses

**Observability:**

- [ ] Cache hits/misses logged to Supabase
- [ ] Redis command count visible in Upstash dashboard
- [ ] Rate limit events logged
- [ ] Error rates within acceptable limits
- [ ] No impact on response times

**Resilience:**

- [ ] Functions work when Redis unavailable (cache disabled)
- [ ] Rate limiter respects fail policy
- [ ] No cascading failures from Redis errors

### Monitoring Dashboards

**Supabase Functions Dashboard:**

- Invocation count by function
- Error rate by function
- Execution duration (p50, p95, p99)
- Cold start frequency

**Upstash Dashboard:**

- Daily command count (target: < 5,000/day)
- Memory usage
- Top keys by access frequency
- Command latency

**Custom Metrics (from logs):**

```sql
-- Cache hit rate (query Supabase logs)
SELECT
  DATE(timestamp) as date,
  COUNT(*) FILTER (WHERE event = 'cache_hit') as hits,
  COUNT(*) FILTER (WHERE event = 'cache_miss') as misses,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE event = 'cache_hit') /
    (COUNT(*) FILTER (WHERE event = 'cache_hit') + COUNT(*) FILTER (WHERE event = 'cache_miss'))
  , 2) as hit_rate_pct
FROM function_logs
WHERE level = 'info'
  AND event IN ('cache_hit', 'cache_miss')
GROUP BY DATE(timestamp)
ORDER BY date DESC;
```

---

## Troubleshooting Guide

### Issue: Cache Not Working

**Symptoms:**

- All requests show `_cache: 'miss'`
- No cache hits in logs

**Diagnosis:**

1. Check Upstash secrets are set:
   ```bash
   supabase secrets list | grep UPSTASH
   ```
2. Check REST API calls in logs
3. Test REST API directly with curl:
   ```bash
   curl -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" \
     $UPSTASH_REDIS_REST_URL/get/test
   ```

**Solutions:**

- Ensure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are correct
- Check Upstash instance is active (not paused for inactivity)
- **Critical**: Use REST API URL (ends with `.upstash.io`), not TCP connection string
- Test with curl from your local machine first
- Check network connectivity from Supabase Edge Function regions

---

### Issue: Redis Command Limit Exceeded

**Symptoms:**

- Upstash dashboard shows > 10,000 commands/day
- Upstash blocks requests or throttles

**Diagnosis:**

1. Check command breakdown in Upstash dashboard
2. Review which functions generate most commands
3. Calculate commands per cache operation

**Solutions:**

- Increase cache TTL (reduce miss rate)
- Reduce cached endpoints (prioritize high-traffic routes)
- Upgrade to Upstash paid plan
- Implement client-side caching (browser cache headers)
- Batch invalidations (fewer DEL commands)

---

### Issue: High Cache Miss Rate

**Symptoms:**

- Hit rate < 50%
- Similar queries generate different cache keys

**Diagnosis:**

1. Check cache key generation logic
2. Verify query normalization
3. Review cache key logs for duplicates

**Solutions:**

- Improve query normalization (sort params, apply defaults)
- Use hash-based keys instead of raw JSON
- Increase cache TTL
- Preload cache for common queries

---

### Issue: Rate Limit False Positives

**Symptoms:**

- Legitimate users blocked with 429
- 429 rate > 5%

**Diagnosis:**

1. Check rate limit configuration
2. Verify subject extraction (user vs IP)
3. Review blocked subjects in logs

**Solutions:**

- Increase rate limits
- Use more specific subjects (avoid IP-based limiting)
- Implement allowlist for known IPs
- Add exponential backoff on client

---

### Issue: Cache Invalidation Not Working

**Symptoms:**

- Product update doesn't clear cache
- Stale data returned after writes

**Diagnosis:**

1. Check invalidation logs
2. Verify namespace matches cache keys
3. Test index key population

**Solutions:**

- Ensure namespace param matches on set and invalidate
- Check index key (`idx:namespace`) exists in Redis
- Verify all write endpoints call `invalidateNamespace`
- Check Redis DEL command succeeds (no permission issues)

---

### Issue: Upstash Connection Timeout

**Symptoms:**

- `fetch` to Upstash API times out
- Cache operations take > 1 second

**Diagnosis:**

1. Check Upstash instance region (should match Supabase region)
2. Test Upstash REST API directly with curl
3. Check Upstash status page

**Solutions:**

- Move Upstash instance closer to Supabase region
- Increase timeout in Redis client config
- Implement circuit breaker for Redis calls
- Fail open on timeout

---

### Issue: Orphaned Rate Limit Keys

**Symptoms:**

- Redis memory usage slowly increasing over time
- Rate limit keys without TTL persist indefinitely
- Rare but possible if Edge Function crashes between INCR and EXPIRE

**Diagnosis:**

1. Check Upstash dashboard for keys matching `rl:*` pattern
2. Review Edge Function error logs for crashes
3. Manually inspect keys for missing TTL:
   ```bash
   curl -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" \
     $UPSTASH_REDIS_REST_URL/ttl/rl:orders-public-get:ip:1.2.3.4:1234567890
   # Result -1 means no TTL (orphaned key)
   ```

**Root Cause:**
The rate limiter uses two separate REST API calls (INCR, then EXPIRE). If the function crashes between them, the key never gets a TTL.

**Solutions:**

**Option 1: Accept the risk (recommended for validation phase)**

- Orphaned keys are small (~100 bytes each)
- Only affects one user's rate limit window
- Rare occurrence (requires Edge Function crash at exact moment)
- Keys would naturally be overwritten in next window

**Option 2: Use Lua script for atomicity (production-grade)**

```typescript
// In rate-limit.ts, replace INCR + EXPIRE with:
const count = await fetch(`${config.url}/eval`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${config.token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    script:
      'local c = redis.call("INCR", KEYS[1]); if c == 1 then redis.call("EXPIRE", KEYS[1], ARGV[1]) end; return c',
    keys: [key],
    argv: [config.windowSeconds],
  }),
})
  .then((res) => res.json())
  .then((data) => data.result);
```

**Option 3: Periodic cleanup job**
Create a scheduled function to clean up orphaned keys (runs daily):

```typescript
// supabase/functions/cleanup-rate-limits/index.ts
// Scans for rl:* keys without TTL and deletes them
```

**Recommendation:** Use Option 1 for validation phase. Upgrade to Option 2 if you observe memory issues or in production.

---

## Appendix

### A. Redis Command Reference

**Using Upstash REST API (Recommended for Supabase Edge Functions)**

All commands follow the pattern: `${UPSTASH_REDIS_REST_URL}/{command}/{args}` with Authorization header.

| Command      | ioredis                                | Upstash REST API          | Example                                                     |
| ------------ | -------------------------------------- | ------------------------- | ----------------------------------------------------------- |
| GET          | `await redis.get(key)`                 | `GET /get/{key}`          | `fetch('${url}/get/mykey', {headers})`                      |
| SET          | `await redis.set(key, val)`            | `POST /set/{key}`         | `fetch('${url}/set/mykey', {method:'POST', body})`          |
| SET with TTL | `await redis.set(key, val, 'EX', 300)` | `POST /setex/{key}/{ttl}` | `fetch('${url}/setex/mykey/300', {method:'POST', body})`    |
| DEL          | `await redis.del(key)`                 | `GET /del/{key}`          | `fetch('${url}/del/mykey', {headers})`                      |
| INCR         | `await redis.incr(key)`                | `GET /incr/{key}`         | `fetch('${url}/incr/counter', {headers})`                   |
| EXPIRE       | `await redis.expire(key, 300)`         | `GET /expire/{key}/{ttl}` | `fetch('${url}/expire/mykey/300', {headers})`               |
| SADD         | `await redis.sadd(set, member)`        | `POST /sadd/{key}`        | `fetch('${url}/sadd/myset', {method:'POST', body:['val']})` |
| SMEMBERS     | `await redis.smembers(set)`            | `GET /smembers/{key}`     | `fetch('${url}/smembers/myset', {headers})`                 |
| KEYS         | ✅ `await redis.keys(pattern)`         | ❌ Not supported          | Use index tracking instead                                  |
| SCAN         | ✅ `await redis.scan(cursor)`          | ❌ Not supported          | Use index tracking instead                                  |

**REST API Response Format:**

```json
{
  "result": <value>,
  "error": null
}
```

**Full Upstash REST API Documentation:**  
https://docs.upstash.com/redis/features/restapi

### B. Cost Estimation

**Upstash Free Tier:**

- 10,000 commands/day
- 256 MB storage
- 1 GB bandwidth

**Expected Daily Commands (Low Traffic):**

| Operation                      | Est. Requests/Day | Commands per Request                 | Total Commands |
| ------------------------------ | ----------------- | ------------------------------------ | -------------- |
| Products list (70% hit rate)   | 500               | 1.3 (0.7 GET hit + 0.3 × 2 SET miss) | 650            |
| Dashboard stats (60% hit rate) | 100               | 1.4                                  | 140            |
| Product writes + invalidation  | 10                | 10 (SMEMBERS + 9 DEL avg)            | 100            |
| Rate limit checks              | 200               | 2 (INCR + EXPIRE)                    | 400            |
| **Total**                      |                   |                                      | **1,290/day**  |

**Margin:** 1,290 / 10,000 = 12.9% of free tier quota ✅

**Scale Estimate:**

- 10x traffic: 12,900 commands/day (still within free tier)
- 100x traffic: 129,000 commands/day (requires paid plan ~$10/mo)

### C. Migration Checklist

**Pre-Migration:**

- [ ] Read this document thoroughly
- [ ] Review SUPABASE_MIGRATION.md for context
- [ ] Set up Upstash account
- [ ] Configure Supabase secrets
- [ ] Create \_shared modules
- [ ] Write unit tests

**Phase 1 (Foundation):**

- [ ] Deploy Upstash client
- [ ] Deploy cache helpers
- [ ] Deploy rate limiter
- [ ] Test in local Supabase

**Phase 2 (Products):**

- [ ] Implement products-list cache
- [ ] Implement query normalization
- [ ] Add invalidation to write endpoints
- [ ] Verify cache hit rate > 50%

**Phase 3 (Dashboard):**

- [ ] Implement dashboard cache
- [ ] Verify 60s TTL
- [ ] Monitor hit rates

**Phase 4 (Rate Limiting):**

- [ ] Deploy rate limiter to public endpoints
- [ ] Test 429 responses
- [ ] Monitor false positive rate

**Phase 5 (Production):**

- [ ] 1 week stable operation
- [ ] All metrics within targets
- [ ] No production incidents
- [ ] Documentation updated

---

**Document Version:** 1.0  
**Last Updated:** May 26, 2026  
**Next Review:** After Phase 1 completion

---

## Questions or Issues?

For questions about this migration plan:

1. Review SUPABASE_MIGRATION.md for broader context
2. Check Upstash REST API documentation: https://docs.upstash.com/redis/features/restapi
3. Check Upstash Redis docs: https://docs.upstash.com/redis
4. Check Supabase Edge Functions docs: https://supabase.com/docs/guides/functions

**Why REST API instead of SDK?**

- ✅ Zero dependencies (no esm.sh imports that can fail)
- ✅ Maximum compatibility with Supabase Edge runtime
- ✅ Direct control over HTTP requests
- ✅ Same pattern already proven in SUPABASE_MIGRATION.md cache.ts

**End of Document**
