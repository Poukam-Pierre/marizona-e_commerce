/**
 * Low-level Upstash Redis REST API primitives.
 *
 * Uses native Deno `fetch` — zero SDK dependencies.
 * Every function fails gracefully (returns null / 0 / false / []) so that
 * callers can implement fail-open behaviour without try/catch boilerplate.
 *
 * ⚠️ IMPORTANT: Upstash does NOT support the `KEYS` or `SCAN` commands.
 *    Use the namespace key-index pattern in cache.ts for pattern-based
 *    invalidation instead.
 *
 * Required environment variables:
 *   UPSTASH_REDIS_REST_URL    — e.g. https://<id>.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN  — REST token from Upstash dashboard
 */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface RedisConfig {
  url: string;
  token: string;
}

function getConfig(): RedisConfig | null {
  const url = Deno.env.get('UPSTASH_REDIS_REST_URL');
  const token = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');
  if (!url || !token) return null;
  return { url, token };
}

function authHeader(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

async function restGet<T>(
  cfg: RedisConfig,
  path: string,
): Promise<T | null> {
  try {
    const res = await fetch(`${cfg.url}${path}`, {
      headers: authHeader(cfg.token),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.result as T;
  } catch {
    return null;
  }
}

async function restPost<T>(
  cfg: RedisConfig,
  path: string,
  body: unknown,
): Promise<T | null> {
  try {
    const res = await fetch(`${cfg.url}${path}`, {
      method: 'POST',
      headers: {
        ...authHeader(cfg.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.result as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// String commands
// ---------------------------------------------------------------------------

/**
 * `GET <key>` — returns the raw string value, or null on miss / error.
 */
export async function redisGet(key: string): Promise<string | null> {
  const cfg = getConfig();
  if (!cfg) return null;
  return restGet<string>(cfg, `/get/${encodeURIComponent(key)}`);
}

/**
 * `SETEX <key> <ttl> <value>` — set a string value with a TTL in seconds.
 * Returns true on success.
 */
export async function redisSetEx(
  key: string,
  ttlSeconds: number,
  value: string,
): Promise<boolean> {
  const cfg = getConfig();
  if (!cfg) return false;
  const result = await restPost<string>(
    cfg,
    `/setex/${encodeURIComponent(key)}/${ttlSeconds}`,
    value,
  );
  return result === 'OK';
}

/**
 * `DEL <key> [<key> ...]` — delete one or more keys.
 * Returns the number of keys that were deleted.
 */
export async function redisDel(...keys: string[]): Promise<number> {
  if (keys.length === 0) return 0;
  const cfg = getConfig();
  if (!cfg) return 0;
  const keyPath = keys.map(encodeURIComponent).join('/');
  const result = await restGet<number>(cfg, `/del/${keyPath}`);
  return result ?? 0;
}

// ---------------------------------------------------------------------------
// Numeric commands
// ---------------------------------------------------------------------------

/**
 * `INCR <key>` — atomically increment and return the new integer value.
 * Returns null when Redis is unavailable (caller should fail-open).
 */
export async function redisIncr(key: string): Promise<number | null> {
  const cfg = getConfig();
  if (!cfg) return null;
  return restGet<number>(cfg, `/incr/${encodeURIComponent(key)}`);
}

/**
 * `EXPIRE <key> <seconds>` — set a TTL on an existing key.
 * Returns true if the TTL was set, false if the key does not exist or on error.
 */
export async function redisExpire(
  key: string,
  ttlSeconds: number,
): Promise<boolean> {
  const cfg = getConfig();
  if (!cfg) return false;
  const result = await restGet<number>(
    cfg,
    `/expire/${encodeURIComponent(key)}/${ttlSeconds}`,
  );
  return result === 1;
}

// ---------------------------------------------------------------------------
// Set commands (used by the namespace-index invalidation pattern)
// ---------------------------------------------------------------------------

/**
 * `SADD <key> <member> [<member> ...]` — add members to a Redis set.
 * Returns the number of members actually added (0 if all existed already).
 */
export async function redisSAdd(
  setKey: string,
  ...members: string[]
): Promise<number> {
  if (members.length === 0) return 0;
  const cfg = getConfig();
  if (!cfg) return 0;
  const result = await restPost<number>(
    cfg,
    `/sadd/${encodeURIComponent(setKey)}`,
    members,
  );
  return result ?? 0;
}

/**
 * `SMEMBERS <key>` — return all members of a Redis set.
 * Returns an empty array when Redis is unavailable or the key does not exist.
 */
export async function redisSMembers(setKey: string): Promise<string[]> {
  const cfg = getConfig();
  if (!cfg) return [];
  const result = await restGet<string[]>(
    cfg,
    `/smembers/${encodeURIComponent(setKey)}`,
  );
  return result ?? [];
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/** Returns true when Upstash credentials are present in the environment. */
export function redisAvailable(): boolean {
  return getConfig() !== null;
}
