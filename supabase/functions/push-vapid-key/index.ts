/**
 * push-vapid-key — GET /functions/v1/push-vapid-key
 *
 * Auth: Public (--no-verify-jwt).
 *
 * Returns the VAPID public key for subscribing to push notifications.
 * The key is read from VAPID_PUBLIC_KEY environment variable.
 */

import { jsonResponse, errorResponse, corsResponse } from '../_shared/response.ts';

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'GET') return errorResponse('Method not allowed', 405);

  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  if (!publicKey) {
    return errorResponse('Push notifications are not configured', 503);
  }

  return jsonResponse({ data: { publicKey } });
});
