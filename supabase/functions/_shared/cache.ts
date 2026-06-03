/**
 * High-level cache helpers built on top of Upstash Redis (upstash.ts).
 *
 * Implements the **namespace key-index pattern** to work around the absence
 * of `KEYS` / `SCAN` in the Upstash REST API:
 *
 *   • Each cached entry is stored under a hashed key:
 *       <namespace>:<12-char-sha256-of-query>
 *
 *   • A companion Redis SET tracks every key written under a namespace:
 *       idx:<namespace>   →  { "products:list:abc123", "products:list:def456", … }
 *
 *   • Invalidating a namespace reads the index, bulk-deletes all tracked keys,
 *     then removes the index itself — no wildcard commands needed.
 *
 * Cache TTLs (from migration plan):
 *   • products-list / products-get     → 300 s
 *   • categories-list / categories-tree → 600 s
 *   • dashboard-*                       →  60 s
 */

import {
  redisGet,
  redisSetEx,
  redisDel,
  redisSAdd,
  redisSMembers,
} from './upstash.ts';

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Read a cached value and deserialise it from JSON.
 * Returns `null` on a cache miss, a Redis error, or a JSON parse failure
 * (fail-open — the caller should fall back to a live database query).
 */
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const raw = await redisGet(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Serialise `value` to JSON and store it under `key` with the given TTL.
 *
 * When `namespace` is provided the key is also registered in the namespace
 * index (`idx:<namespace>`) so that `invalidateNamespace()` can bulk-delete it.
 *
 * Failures are swallowed — cache writes must never block business logic.
 */
export async function setCache(
  key: string,
  value: unknown,
  ttlSeconds: number,
  namespace?: string,
): Promise<void> {
  try {
    const serialised = JSON.stringify(value);
    await redisSetEx(key, ttlSeconds, serialised);

    if (namespace) {
      // Track so we can invalidate the whole namespace later
      await redisSAdd(`idx:${namespace}`, key);
    }
  } catch {
    // Intentional no-op — cache layer must never throw
  }
}

// ---------------------------------------------------------------------------
// Invalidation
// ---------------------------------------------------------------------------

/**
 * Delete all cache keys that belong to `namespace` and remove the index.
 * Uses the key-index SET to avoid KEYS / SCAN (not supported by Upstash REST).
 *
 * Failures are swallowed — stale data is preferable to blocking a write path.
 */
export async function invalidateNamespace(namespace: string): Promise<void> {
  try {
    const indexKey = `idx:${namespace}`;
    const keys = await redisSMembers(indexKey);

    if (keys.length > 0) {
      await redisDel(...keys);
    }

    // Remove the index itself so it doesn't grow forever
    await redisDel(indexKey);
  } catch {
    // Intentional no-op
  }
}

/**
 * Delete a single cache key directly (no index lookup needed).
 */
export async function invalidateKey(key: string): Promise<void> {
  try {
    await redisDel(key);
  } catch {
    // Intentional no-op
  }
}

// ---------------------------------------------------------------------------
// Key helpers
// ---------------------------------------------------------------------------

/**
 * Build a stable, short cache key for a namespace + query object.
 *
 * Keys are normalised before hashing so that `{a:1, b:2}` and `{b:2, a:1}`
 * produce the same cache key (maximises hit rate).
 * Undefined / null values are stripped before normalisation.
 *
 * Returns `<namespace>:<12-hex-chars>` (e.g. `products:list:3f7a1c902b4d`).
 */
export async function buildCacheKey(
  namespace: string,
  query: Record<string, unknown>,
): Promise<string> {
  const normalised = Object.fromEntries(
    Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== null)
      .sort(([a], [b]) => a.localeCompare(b)),
  );

  const serialised = JSON.stringify(normalised);
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(serialised),
  );
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 12);

  return `${namespace}:${hashHex}`;
}

// ---------------------------------------------------------------------------
// Pre-defined namespaces (mirrors migration plan cache strategy table)
// ---------------------------------------------------------------------------

export const CACHE_NAMESPACES = {
  PRODUCTS_LIST: 'products:list',
  PRODUCTS_ID: 'products:id',
  PRODUCTS_SLUG: 'products:slug',
  CATEGORIES_LIST: 'categories:list',
  CATEGORIES_TREE: 'categories:tree',
  DASHBOARD_STATS: 'dashboard:stats',
  DASHBOARD_LOW_STOCK: 'dashboard:low-stock',
  DASHBOARD_RECENT_ORDERS: 'dashboard:recent-orders',
} as const;

export const CACHE_TTL = {
  PRODUCTS: 300,     // 5 minutes
  CATEGORIES: 600,   // 10 minutes
  DASHBOARD: 60,     // 1 minute
} as const;
