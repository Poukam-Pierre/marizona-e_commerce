/**
 * settings-update — PUT /functions/v1/settings-update?key=<settingKey>
 *
 * Auth: ADMIN+ (level 3)
 * Updates value of an existing setting by key.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  authenticate,
  requireRole,
  createAdminClient,
  AdminRole,
} from '../_shared/auth.ts';
import { jsonResponse, errorResponse, corsResponse } from '../_shared/response.ts';

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
  if (req.method !== 'PUT' && req.method !== 'PATCH') return errorResponse('Method not allowed', 405);

  try {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });

    const { user, error: authError, status: authStatus } = await authenticate(req, userClient);
    if (authError || !user) return errorResponse(authError ?? 'Unauthorized', authStatus ?? 401);

    const { error: roleError, status: roleStatus } = requireRole(user, AdminRole.ADMIN);
    if (roleError) return errorResponse(roleError, roleStatus ?? 403);

    const key = new URL(req.url).searchParams.get('key')?.trim();
    if (!key) return errorResponse('key query parameter is required', 400);

    let body: { value?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    if (!Object.prototype.hasOwnProperty.call(body, 'value')) {
      return errorResponse('value is required', 400);
    }

    const admin = createAdminClient();
    const valueStr = typeof body.value === 'string' ? body.value : JSON.stringify(body.value);
    const { data, error } = await admin
      .from('settings')
      .update({ value: valueStr, updatedAt: new Date().toISOString() })
      .eq('key', key)
      .select('id, key, value, category, createdAt, updatedAt')
      .maybeSingle();

    if (error) {
      console.error('[settings-update] DB error:', error.message);
      return errorResponse('Failed to update setting', 500);
    }
    if (!data) return errorResponse(`Setting with key \"${key}\" not found`, 404);

    return jsonResponse({ data: { ...data, value: parseValue(data.value) } });
  } catch (err) {
    console.error('[settings-update] Unexpected error:', err);
    return errorResponse('Internal server error', 500);
  }
});
