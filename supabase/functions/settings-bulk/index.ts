/**
 * settings-bulk — POST /functions/v1/settings-bulk
 *
 * Auth: ADMIN+ (level 3)
 * Upserts multiple settings.
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

type BulkItem = {
  key: string;
  value: unknown;
  category?: string;
};

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

    let body: { settings?: BulkItem[] };
    try {
      body = await req.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    const settings = body.settings ?? [];
    if (!Array.isArray(settings) || settings.length === 0) {
      return errorResponse('settings must be a non-empty array', 400);
    }

    const now = new Date().toISOString();
    const rows = settings.map((s) => ({
      id: generateCuid(),
      key: (s.key ?? '').trim(),
      value: typeof s.value === 'string' ? s.value : JSON.stringify(s.value ?? null),
      category: (s.category ?? 'general').toString().trim() || 'general',
      createdAt: now,
      updatedAt: now,
    }));

    if (rows.some((r) => !r.key)) return errorResponse('Every settings item must include key', 400);

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('settings')
      .upsert(rows, { onConflict: 'key', ignoreDuplicates: false })
      .select('id, key, value, category, createdAt, updatedAt');

    if (error) {
      console.error('[settings-bulk] DB error:', error.message);
      return errorResponse('Failed to bulk upsert settings', 500);
    }

    return jsonResponse({
      data: (data ?? []).map((s) => ({ ...s, value: parseValue(s.value) })),
    });
  } catch (err) {
    console.error('[settings-bulk] Unexpected error:', err);
    return errorResponse('Internal server error', 500);
  }
});
