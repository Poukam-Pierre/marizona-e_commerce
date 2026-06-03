/**
 * settings-upsert — POST /functions/v1/settings-upsert
 *
 * Auth: ADMIN+ (level 3)
 * Upserts a single setting by key.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  authenticate,
  requireRole,
  createAdminClient,
  AdminRole,
} from '../_shared/auth.ts';
import { jsonResponse, errorResponse, corsResponse } from '../_shared/response.ts';
import { generateCuid } from '../_shared/validation.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

function parseValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function normalizeKey(key: string): string {
  return key.trim();
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  try {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });

    const { user, error: authError, status: authStatus } = await authenticate(req, userClient);
    if (authError || !user) return errorResponse(authError ?? 'Unauthorized', authStatus ?? 401);

    const { error: roleError, status: roleStatus } = requireRole(user, AdminRole.ADMIN);
    if (roleError) return errorResponse(roleError, roleStatus ?? 403);

    let body: { key?: string; value?: unknown; category?: string };
    try {
      body = await req.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    const key = normalizeKey(body.key ?? '');
    const category = (body.category ?? 'general').toString().trim() || 'general';

    if (!key) return errorResponse('key is required', 400);
    if (key.length > 100) return errorResponse('key is too long', 400);

    const admin = createAdminClient();
    const valueStr = typeof body.value === 'string'
      ? body.value
      : JSON.stringify(body.value ?? null);

    const now = new Date().toISOString();

    // Check if setting with this key already exists
    const { data: existing, error: checkError } = await admin
      .from('settings')
      .select('id, createdAt')
      .eq('key', key)
      .maybeSingle();

    if (checkError) {
      console.error('[settings-upsert] Check error:', checkError.message);
      return errorResponse('Failed to upsert setting', 500);
    }

    let data, error;

    if (existing) {
      // UPDATE: preserve id and createdAt, only update value/category/updatedAt
      const result = await admin
        .from('settings')
        .update({
          category,
          value: valueStr,
          updatedAt: now,
        })
        .eq('key', key)
        .select('id, key, value, category, createdAt, updatedAt')
        .single();
      data = result.data;
      error = result.error;
    } else {
      // INSERT: new setting with full payload
      const result = await admin
        .from('settings')
        .insert({
          id: generateCuid(),
          key,
          category,
          value: valueStr,
          createdAt: now,
          updatedAt: now,
        })
        .select('id, key, value, category, createdAt, updatedAt')
        .single();
      data = result.data;
      error = result.error;
    }

    if (error || !data) {
      console.error('[settings-upsert] DB error:', error?.message);
      return errorResponse('Failed to upsert setting', 500);
    }

    return jsonResponse({ data: { ...data, value: parseValue(data.value) } });
  } catch (err) {
    console.error('[settings-upsert] Unexpected error:', err);
    return errorResponse('Internal server error', 500);
  }
});
