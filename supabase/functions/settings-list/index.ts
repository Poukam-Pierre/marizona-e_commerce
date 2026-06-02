/**
 * settings-list — GET /functions/v1/settings-list
 *
 * Auth: MANAGER+ (level 2)
 * Returns admin settings data with optional filters.
 *
 * Query params:
 *   key       string  optional — return single setting
 *   category  string  optional — return flat key->value map for category
 *
 * Default response (no query):
 *   { data: { [category]: { [key]: parsedValue } } }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  authenticate,
  requireRole,
  createAdminClient,
  AdminRole,
} from '../_shared/auth.ts';
import {
  jsonResponse,
  errorResponse,
  corsResponse,
} from '../_shared/response.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

function parseValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'GET') return errorResponse('Method not allowed', 405);

  try {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });

    const { user, error: authError, status: authStatus } = await authenticate(req, userClient);
    if (authError || !user) return errorResponse(authError ?? 'Unauthorized', authStatus ?? 401);

    const { error: roleError, status: roleStatus } = requireRole(user, AdminRole.MANAGER);
    if (roleError) return errorResponse(roleError, roleStatus ?? 403);

    const url = new URL(req.url);
    const key = url.searchParams.get('key')?.trim();
    const category = url.searchParams.get('category')?.trim();

    const admin = createAdminClient();

    if (key) {
      const { data: setting, error } = await admin
        .from('settings')
        .select('id, key, value, category, createdAt, updatedAt')
        .eq('key', key)
        .maybeSingle();

      if (error) {
        console.error('[settings-list] DB error (single):', error.message);
        return errorResponse('Failed to fetch setting', 500);
      }
      if (!setting) return errorResponse(`Setting with key "${key}" not found`, 404);

      return jsonResponse({
        data: {
          ...setting,
          value: parseValue(setting.value),
        },
      });
    }

    if (category) {
      const { data: settings, error } = await admin
        .from('settings')
        .select('key, value')
        .eq('category', category)
        .order('key', { ascending: true });

      if (error) {
        console.error('[settings-list] DB error (category):', error.message);
        return errorResponse('Failed to fetch category settings', 500);
      }

      const map: Record<string, unknown> = {};
      for (const s of settings ?? []) {
        map[s.key] = parseValue(s.value);
      }

      return jsonResponse({ data: map });
    }

    const { data: settings, error } = await admin
      .from('settings')
      .select('category, key, value')
      .order('category', { ascending: true })
      .order('key', { ascending: true });

    if (error) {
      console.error('[settings-list] DB error (all):', error.message);
      return errorResponse('Failed to fetch settings', 500);
    }

    const grouped: Record<string, Record<string, unknown>> = {};

    for (const s of settings ?? []) {
      if (!grouped[s.category]) grouped[s.category] = {};
      grouped[s.category][s.key] = parseValue(s.value);
    }

    return jsonResponse({ data: grouped });
  } catch (err) {
    console.error('[settings-list] Unexpected error:', err);
    return errorResponse('Internal server error', 500);
  }
});
