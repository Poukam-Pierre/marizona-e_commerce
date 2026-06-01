/**
 * settings-public — GET /functions/v1/settings-public
 *
                                                                                                                                                                                         * Public endpoint. Returns settings from the 'general' and 'store' categories
 * (storefront-relevant configuration). Values are JSON-parsed and returned as
 * a flat key→value map.
 * Cache: 300 s.
 *
 * Query parameters (optional):
 *   key  string   Return a single setting by key (must be in 'general' or 'store' category).
 *                                                                                  
 * Response shape:
 *   { data: { storeName: "ShopPk", currency: "XAF", ... } }
 *
 * or for a single key:
 *   { data: { key: "storeName", value: "ShopPk", category: "general", ... } }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  jsonResponse,
  errorResponse,
  corsResponse,
} from '../_shared/response.ts';
import {
  getCached,
  setCache,
  CACHE_TTL,
} from '../_shared/cache.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const CACHE_NAMESPACE   = 'settings:public';
const CACHE_KEY_ALL     = `${CACHE_NAMESPACE}:all`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Attempt to parse a JSON string; fall back to raw string on failure. */
function parseValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'GET') return errorResponse('Method not allowed', 405);

  try {
    const url = new URL(req.url);
    const key = url.searchParams.get('key')?.trim();

    // Use anon key — RLS policy "public_read_public_settings" (migration 20260528,
    // updated 20260601) enforces category IN ('general','store') at the DB level
    // as defense-in-depth. Function further filters to the same categories.
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // =========================================================================
    // Single setting lookup
    // =========================================================================
    if (key) {
      if (key.length > 100) return errorResponse('Invalid key', 400);

      const cacheKey = `${CACHE_NAMESPACE}:key:${key}`;
      const cached   = await getCached<unknown>(cacheKey);
      if (cached) {
        return new Response(JSON.stringify({ data: cached }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
            'X-Cache': 'HIT',
          },
        });
      }

      const { data: setting, error } = await supabase
        .from('settings')
        .select('id, key, value, category, createdAt, updatedAt')
        .eq('key', key)
        .in('category', ['general', 'store'])  // RLS also enforces this; belt-and-suspenders
        .maybeSingle();

      if (error) {
        console.error('[settings-public] DB error (single):', error.message);
        return errorResponse('Failed to fetch setting', 500);
      }

      if (!setting) {
        return errorResponse(`Public setting with key "${key}" not found`, 404);
      }

      const parsed = { ...setting, value: parseValue(setting.value) };
      await setCache(cacheKey, parsed, CACHE_TTL.PRODUCTS);
      return jsonResponse({ data: parsed });
    }

    // =========================================================================
    // All public settings — returned as flat key→value map
    // =========================================================================
    const cached = await getCached<unknown>(CACHE_KEY_ALL);
    if (cached) {
      return new Response(JSON.stringify({ data: cached }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
          'X-Cache': 'HIT',
        },
      });
    }

    const { data: settings, error } = await supabase
      .from('settings')
      .select('key, value')
      .in('category', ['general', 'store'])
      .order('key', { ascending: true });

    if (error) {
      console.error('[settings-public] DB error (all):', error.message);
      return errorResponse('Failed to fetch settings', 500);
    }

    // Collapse into { key: parsedValue } map
    const map: Record<string, unknown> = {};
    for (const s of settings ?? []) {
      map[s.key] = parseValue(s.value);
    }

    await setCache(CACHE_KEY_ALL, map, CACHE_TTL.PRODUCTS, CACHE_NAMESPACE);
    return jsonResponse({ data: map });

  } catch (err) {
    console.error('[settings-public] Unexpected error:', err);
    return errorResponse('Internal server error', 500);
  }
});
