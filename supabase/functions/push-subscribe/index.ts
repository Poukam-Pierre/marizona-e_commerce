/**
 * push-subscribe — POST /functions/v1/push-subscribe
 *
 * Auth: Public (--no-verify-jwt).
 *
 * Saves a browser push subscription to the push_subscriptions table.
 * If a subscription for the same endpoint already exists, it is updated
 * (keys may rotate on browser re-subscribe).
 *
 * Body (JSON):
 *   endpoint  string  required — browser-generated push endpoint URL
 *   p256dh    string  required — base64 encoded public encryption key
 *   auth      string  required — base64 encoded auth secret
 *   userAgent string  optional — browser/device info for debugging
 */

import { createAdminClient } from '../_shared/auth.ts';
import { jsonResponse, errorResponse, corsResponse } from '../_shared/response.ts';
import { generateCuid } from '../_shared/validation.ts';

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    const { endpoint, p256dh, auth, userAgent } = body as {
      endpoint?: string;
      p256dh?: string;
      auth?: string;
      userAgent?: string;
    };

    if (!endpoint || typeof endpoint !== 'string') {
      return errorResponse('endpoint is required', 400);
    }
    if (!p256dh || typeof p256dh !== 'string') {
      return errorResponse('p256dh is required', 400);
    }
    if (!auth || typeof auth !== 'string') {
      return errorResponse('auth is required', 400);
    }

    const admin = createAdminClient();

    // Check if subscription already exists for this endpoint
    const { data: existing } = await admin
      .from('push_subscriptions')
      .select('id')
      .eq('endpoint', endpoint)
      .maybeSingle();

    let result;

    if (existing) {
      // Update — endpoint is the same, keys may have changed
      const { data, error } = await admin
        .from('push_subscriptions')
        .update({
          p256dh,
          auth,
          ...(userAgent ? { userAgent } : {}),
          isActive: true,
          updatedAt: new Date().toISOString(),
        })
        .eq('endpoint', endpoint)
        .select('id, endpoint, isActive, createdAt, updatedAt')
        .single();

      if (error) {
        console.error('[push-subscribe] Update failed:', error);
        return errorResponse('Failed to update subscription', 500);
      }
      result = data;
    } else {
      // Insert new subscription
      const { data, error } = await admin
        .from('push_subscriptions')
        .insert({
          id: generateCuid(),
          endpoint,
          p256dh,
          auth,
          ...(userAgent ? { userAgent } : {}),
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .select('id, endpoint, isActive, createdAt, updatedAt')
        .single();

      if (error) {
        console.error('[push-subscribe] Insert failed:', error);
        return errorResponse('Failed to save subscription', 500);
      }
      result = data;
    }

    return jsonResponse({ data: result }, 201);
  } catch (err) {
    console.error('[push-subscribe] Unexpected error:', err);
    return errorResponse('Internal server error', 500);
  }
});
