/**
 * Distributed rate limiter for Edge Functions backed by Upstash Redis.
 *
 * Algorithm: **fixed-window counter** using atomic INCR.
 *
 * Key format:  rl:<route>:<subject>:<windowStart>
 * Example:     rl:products-list:ip-1.2.3.4:1748390400
 *
 * Subject priority (caller's responsibility to resolve):
 *   1. Authenticated user ID  (most specific, prevents cross-user pollution)
 *   2. Lookup token hash      (for public order-status endpoints)
 *   3. Client IP address      (fallback for fully anonymous endpoints)
 *
 * ⚠️ Known race: Two separate HTTP calls are made for INCR and EXPIRE.
 *    If the function crashes between them the key persists without a TTL.
 *    Impact is negligible: one stale key per affected user, <100 bytes memory,
 *    and the counter resets naturally on the next successful call.
 *    A Lua-script atomic solution can replace this if it becomes an issue.
 *
 * Fail-open policy: if Upstash is unavailable, `checkRateLimit` returns
 * `allowed: true` so legitimate traffic is never blocked during Redis outages.
 * Sensitive endpoints that require fail-closed behaviour should check
 * `RateLimitResult.redisAvailable` and handle the outage explicitly.
 */

import { redisIncr, redisExpire, redisAvailable } from './upstash.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RateLimitConfig {
  /** Maximum number of requests allowed per window. */
  limit: number;
  /** Window duration in seconds. */
  windowSeconds: number;
}

export interface RateLimitResult {
  /** Whether the request is within the allowed limit. */
  allowed: boolean;
  /** Requests remaining in the current window. */
  remaining: number;
  /** The configured maximum for this tier. */
  limit: number;
  /** Unix timestamp (seconds) when the current window resets. */
  resetAt: number;
  /** False when Upstash was unreachable — caller may choose to fail-closed. */
  redisAvailable: boolean;
}

// ---------------------------------------------------------------------------
// Core check
// ---------------------------------------------------------------------------

/**
 * Check and increment the rate limit counter for a route + subject.
 * Returns the result immediately — no blocking.
 */
export async function checkRateLimit(
  route: string,
  subject: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const { limit, windowSeconds } = config;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  const resetAt = windowStart + windowSeconds;
  const key = `rl:${route}:${subject}:${windowStart}`;

  if (!redisAvailable()) {
    // Fail-open: Redis not configured
    return { allowed: true, remaining: limit, limit, resetAt, redisAvailable: false };
  }

  try {
    const count = await redisIncr(key);

    if (count === null) {
      // Fail-open: Redis returned null (transient error)
      return { allowed: true, remaining: limit, limit, resetAt, redisAvailable: false };
    }

    if (count === 1) {
      // First request in this window — set TTL (+1 s buffer to avoid premature expiry)
      await redisExpire(key, windowSeconds + 1);
    }

    if (count > limit) {
      return { allowed: false, remaining: 0, limit, resetAt, redisAvailable: true };
    }

    return {
      allowed: true,
      remaining: limit - count,
      limit,
      resetAt,
      redisAvailable: true,
    };
  } catch {
    // Fail-open on any unexpected error
    return { allowed: true, remaining: limit, limit, resetAt, redisAvailable: false };
  }
}

// ---------------------------------------------------------------------------
// Rate limit response header helper
// ---------------------------------------------------------------------------

/**
 * Build standard rate-limit response headers from a `RateLimitResult`.
 * Attach these to every response so clients can adapt their request rate.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.resetAt),
    ...(result.allowed ? {} : { 'Retry-After': String(result.resetAt - Math.floor(Date.now() / 1000)) }),
  };
}

// ---------------------------------------------------------------------------
// Pre-configured tiers (from migration plan)
// ---------------------------------------------------------------------------

/**
 * Rate limit tiers matching the migration plan spec.
 *
 * | Tier    | Limit        | Endpoint examples                       |
 * |---------|------------- |-----------------------------------------|
 * | lenient | 100 req/60 s | products-list (public read, low risk)   |
 * | medium  | 10 req/60 s  | orders-public-get (prevent enumeration) |
 * | strict  | 5 req/60 s   | orders-download-item (prevent abuse)    |
 */
export const RATE_LIMIT_TIERS = {
  lenient: { limit: 100, windowSeconds: 60 } satisfies RateLimitConfig,
  medium:  { limit: 10,  windowSeconds: 60 } satisfies RateLimitConfig,
  strict:  { limit: 5,   windowSeconds: 60 } satisfies RateLimitConfig,
} as const;
