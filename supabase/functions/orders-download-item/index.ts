/**
 * orders-download-item — GET /functions/v1/orders-download-item
 *
 * Auth: Public (--no-verify-jwt). Token-gated by lookup token.
 *
 * Validates that the customer is eligible to download a digital order item,
 * atomically increments the download counter via `process_download` RPC,
 * then issues a 302 redirect to the actual download URL.
 *
 * The download URL is NEVER returned in the body — only a redirect is issued,
 * preventing the URL from being cached by clients or intermediaries.
 *
 * Query params:
 *   orderId  string  required — order CUID
 *   itemId   string  required — order_item CUID
 *   token    string  required — raw lookup token
 *
 * Possible error messages forwarded from the `process_download` RPC:
 *   ORDER_CANCELLED, NOT_PAID, LINK_EXPIRED, LIMIT_REACHED,
 *   Order not found, Order item not found
 */

import { createAdminClient } from '../_shared/auth.ts';
import { errorResponse, corsResponse } from '../_shared/response.ts';

// ---------------------------------------------------------------------------
// Hash helper
// ---------------------------------------------------------------------------

async function hashToken(raw: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Map known RPC exception messages to HTTP status codes
const ERROR_STATUS_MAP: Record<string, number> = {
  'Order not found':       404,
  'Order item not found':  404,
  'ORDER_CANCELLED':       403,
  'NOT_PAID':              403,
  'LINK_EXPIRED':          410,  // Gone
  'LIMIT_REACHED':         429,  // Too Many Requests
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'GET') return errorResponse('Method not allowed', 405);

  try {
    const url      = new URL(req.url);
    const orderId  = url.searchParams.get('orderId')?.trim();
    const itemId   = url.searchParams.get('itemId')?.trim();
    const rawToken = url.searchParams.get('token')?.trim();

    if (!orderId)  return errorResponse('orderId query parameter is required', 400);
    if (!itemId)   return errorResponse('itemId query parameter is required', 400);
    if (!rawToken) return errorResponse('token query parameter is required', 400);

    const tokenHashHex = await hashToken(rawToken);

    // process_download is a SECURITY DEFINER function (service_role only)
    const admin = createAdminClient();

    const { data, error: rpcError } = await admin.rpc('process_download', {
      p_order_id:   orderId,
      p_item_id:    itemId,
      p_token_hash: tokenHashHex,
    });

    if (rpcError) {
      console.error('[orders-download-item] RPC error:', rpcError.message);
      const status = ERROR_STATUS_MAP[rpcError.message] ?? 403;
      return errorResponse(rpcError.message, status);
    }

    if (!data?.download_url) {
      return errorResponse('No download URL configured for this item', 500);
    }

    // Redirect — URL is never exposed in the response body
    return new Response(null, {
      status: 302,
      headers: {
        Location:                        data.download_url,
        'Access-Control-Allow-Origin':   '*',
        'Cache-Control':                 'no-store',
      },
    });

  } catch (err) {
    console.error('[orders-download-item] Unexpected error:', err);
    return errorResponse('Internal server error', 500);
  }
});
