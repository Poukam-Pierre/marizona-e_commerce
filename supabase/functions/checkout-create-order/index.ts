/**
 * checkout-create-order — POST /functions/v1/checkout-create-order
 *
 * Auth: Public (--no-verify-jwt). Guest checkout — no JWT required.
 *
 * Creates an order atomically via the `create_order_atomic` Postgres RPC,
 * which inserts the order + items, decrements inventory, and logs movements
 * inside a single transaction.
 *
 * The raw lookup token is generated here and its SHA-256 hash is stored in
 * the DB. The raw token is returned to the client ONCE — it must be saved
 * for order tracking.
 *
 * Request body (CreateOrderDto):
 *   customerName      string  required
 *   customerPhone     string  required
 *   customerEmail     string?
 *   customerWhatsapp  string?
 *   customerId        string? CUID (link to Customer record if logged in)
 *   shippingName      string  required
 *   shippingPhone     string  required
 *   shippingAddress   string  required
 *   shippingCity      string  required
 *   shippingProvince  string  required
 *   shippingPostalCode string?
 *   shippingCountry   string? default 'Cameroon'
 *   shippingCost      number? default 0
 *   discount          number? default 0
 *   tax               number? default 0
 *   currency          string? default 'XAF'
 *   customerNotes     string?
 *   items             Array<{ productId, variantId?, quantity }>  required, min 1
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { jsonResponse, errorResponse, corsResponse } from '../_shared/response.ts';
import { validateRequired } from '../_shared/validation.ts';
import { createAdminClient } from '../_shared/auth.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REQUIRED_FIELDS = [
  'customerName', 'customerPhone',
  'shippingName', 'shippingPhone', 'shippingAddress',
  'shippingCity', 'shippingProvince',
  'items',
];

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

async function generateLookupToken(): Promise<{ rawToken: string; tokenHashHex: string }> {
  // 72-char raw token (two UUIDs = 36 + 36)
  const rawToken = crypto.randomUUID() + crypto.randomUUID();

  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(rawToken),
  );
  const tokenHashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return { rawToken, tokenHashHex };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  try {
    let body: Record<string, any>;
    try { body = await req.json(); } catch { return errorResponse('Invalid JSON body', 400); }

    // Validate required fields
    const missing = validateRequired(body, REQUIRED_FIELDS);
    if (missing) return errorResponse(missing, 400);

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return errorResponse('Order must contain at least one item', 400);
    }

    // Validate each item
    for (const item of body.items) {
      if (!item.productId) return errorResponse('Each item must have a productId', 400);
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        return errorResponse('Each item quantity must be a positive integer', 400);
      }
    }

    // Generate secure lookup token (30-day expiry)
    const { rawToken, tokenHashHex } = await generateLookupToken();
    const tokenExpiry = new Date();
    tokenExpiry.setDate(tokenExpiry.getDate() + 30);

    // Call atomic RPC (service-role bypasses RLS)
    const admin = createAdminClient();

    const { data: order, error: rpcError } = await admin.rpc('create_order_atomic', {
      order_payload: {
        ...body,
        lookupToken: tokenHashHex,
        lookupTokenExpiry: tokenExpiry.toISOString(),
      },
    });

    if (rpcError || !order) {
      console.error('[checkout-create-order] RPC error:', rpcError?.message);
      return errorResponse(rpcError?.message ?? 'Failed to create order', 400);
    }

    console.log('[checkout-create-order] Order created:', order.orderNumber);

    // Return order + raw token (ONLY TIME raw token is visible — client must store it)
    return jsonResponse(
      {
        data: {
          ...order,
          lookupToken: rawToken,
          lookupTokenExpiry: tokenExpiry.toISOString(),
        },
      },
      201,
    );

  } catch (err) {
    console.error('[checkout-create-order] Unexpected error:', err);
    return errorResponse('Internal server error', 500);
  }
});
