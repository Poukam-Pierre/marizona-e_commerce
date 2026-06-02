/**
 * settings-delete — DELETE /functions/v1/settings-delete?key=<settingKey>
 *
 * Auth: SUPER_ADMIN only (level 4)
 * Deletes a setting by key.
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

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'DELETE') return errorResponse('Method not allowed', 405);

  try {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });

    const { user, error: authError, status: authStatus } = await authenticate(req, userClient);
    if (authError || !user) return errorResponse(authError ?? 'Unauthorized', authStatus ?? 401);

    const { error: roleError, status: roleStatus } = requireRole(user, AdminRole.SUPER_ADMIN);
    if (roleError) return errorResponse(roleError, roleStatus ?? 403);

    const key = new URL(req.url).searchParams.get('key')?.trim();
    if (!key) return errorResponse('key query parameter is required', 400);

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('settings')
      .delete()
      .eq('key', key)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('[settings-delete] DB error:', error.message);
      return errorResponse('Failed to delete setting', 500);
    }
    if (!data) return errorResponse(`Setting with key \"${key}\" not found`, 404);

    return jsonResponse({ data: { message: 'Setting deleted successfully' } });
  } catch (err) {
    console.error('[settings-delete] Unexpected error:', err);
    return errorResponse('Internal server error', 500);
  }
});
