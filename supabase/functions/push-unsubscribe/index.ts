/**
 * push-unsubscribe — DELETE /functions/v1/push-unsubscribe
 *
 * Auth: Public (--no-verify-jwt).
 *
 * Marks a push subscription as inactive (soft delete) by endpoint URL.
 *
 * Body (JSON):
 *   endpoint  string  required — the push endpoint URL to deactivate
 */

import { createAdminClient } from '../_shared/auth.ts';
import { jsonResponse, errorResponse, corsResponse } from '../_shared/response.ts';

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'DELETE') return errorResponse('Method not allowed', 405);

  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    const { endpoint } = body as { endpoint?: string };

    if (!endpoint || typeof endpoint !== 'string') {
      return errorResponse('endpoint is required', 400);
    }

    const admin = createAdminClient();

    const { data: existing } = await admin
      .from('push_subscriptions')
      .select('id')
      .eq('endpoint', endpoint)
      .maybeSingle();

    if (!existing) {
      // Already gone — treat as success (idempotent)
      return jsonResponse({ data: { message: 'Subscription not found' } });
    }

    const { error } = await admin
      .from('push_subscriptions')
      .update({
        isActive: false,
        updatedAt: new Date().toISOString(),
      })
      .eq('endpoint', endpoint);

    if (error) {
      console.error('[push-unsubscribe] Update failed:', error);
      return errorResponse('Failed to unsubscribe', 500);
    }

    return jsonResponse({ data: { message: 'Successfully unsubscribed' } });
  } catch (err) {
    console.error('[push-unsubscribe] Unexpected error:', err);
    return errorResponse('Internal server error', 500);
  }
});
