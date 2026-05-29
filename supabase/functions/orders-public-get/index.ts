/**
 * orders-public-get — GET /functions/v1/orders-public-get
 *
 * Auth: Public (--no-verify-jwt). Token-gated by lookup token.
 *
 * Fetches a customer's order using the raw lookup token returned at
 * order creation time.  The raw token is never stored — only its SHA-256
 * hash is persisted in `orders.lookupToken`.  This function hashes the
 * supplied token and queries by hash + expiry.
 *
 * Query params:
 *   token  string  raw lookup token (required)
 *   id     string  optional — additional filter by order ID (extra safety)
 *
 * The response:
 *   - Masks customerPhone (shows last 4 digits only)
 *   - Strips `lookupToken` from the returned order
 *   - Annotates each digital item with `downloadEligible` + `downloadBlockedReason`
 *   - Never exposes `downloadUrl` in this endpoint (only orders-download-item uses it)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { jsonResponse, errorResponse, corsResponse } from '../_shared/response.ts';

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

// ---------------------------------------------------------------------------
// Hash helper
// ---------------------------------------------------------------------------

async function hashToken(raw: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'GET') return errorResponse('Method not allowed', 405);

  try {
    const url      = new URL(req.url);
    const rawToken = url.searchParams.get('token')?.trim();
    const orderId  = url.searchParams.get('id')?.trim();

    if (!rawToken) return errorResponse('token query parameter is required', 400);

    const tokenHashHex = await hashToken(rawToken);

    // Use anon client — the lookup_token IS NOT NULL policy (migration 20260529)
    // already allows reading the row
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let query = supabase
      .from('orders')
      .select(`
        id, orderNumber, status, paymentStatus, paymentMethod, currency,
        customerName, customerPhone,
        shippingName, shippingAddress, shippingCity, shippingProvince,
        shippingPostalCode, shippingCountry,
        subtotal, discount, shippingCost, tax, total,
        couponCode, trackingNumber, shippingProvider,
        createdAt, confirmedAt, shippedAt, deliveredAt, completedAt,
        lookupTokenExpiry,
        items:order_items(
          id, productName, productImage, variantName,
          quantity, unitPrice, totalPrice, productType,
          downloadCount, downloadLimit, downloadExpiry,
          isShipped, isDelivered
        )
      `)
      .eq('lookupToken', tokenHashHex);

    if (orderId) query = query.eq('id', orderId);

    const { data: order, error } = await query.maybeSingle();

    if (error) {
      console.error('[orders-public-get] DB error:', error.message);
      return errorResponse('Order not found', 404);
    }
    if (!order) return errorResponse('Order not found', 404);

    // Check token expiry
    if (order.lookupTokenExpiry && new Date(order.lookupTokenExpiry) < new Date()) {
      return errorResponse('Order not found', 404);
    }

    // Mask phone number (last 4 digits only)
    const phone      = order.customerPhone ?? '';
    const maskedPhone = phone.length > 4
      ? '*'.repeat(phone.length - 4) + phone.slice(-4)
      : phone;

    // Compute download eligibility per item (no URL exposed here)
    const isPaid    = order.paymentStatus === 'PAID';
    const isRevoked = ['CANCELLED', 'REFUNDED'].includes(order.status);

    const items = (order.items ?? []).map((item: any) => {
      let downloadEligible     = false;
      let downloadBlockedReason: string | null = null;

      if (item.productType === 'DIGITAL') {
        if (isRevoked) {
          downloadBlockedReason = 'ORDER_CANCELLED';
        } else if (!isPaid) {
          downloadBlockedReason = 'NOT_PAID';
        } else if (item.downloadExpiry && new Date(item.downloadExpiry) < new Date()) {
          downloadBlockedReason = 'LINK_EXPIRED';
        } else if (item.downloadLimit !== null && item.downloadCount >= item.downloadLimit) {
          downloadBlockedReason = 'LIMIT_REACHED';
        } else {
          downloadEligible = true;
        }
      }

      // Never expose downloadCount internals to the customer
      const { downloadCount: _dc, ...rest } = item;
      return { ...rest, downloadEligible, downloadBlockedReason };
    });

    const { lookupTokenExpiry: _exp, ...safeOrder } = order;

    return jsonResponse({
      data: {
        ...safeOrder,
        customerPhone: maskedPhone,
        items,
      },
    });

  } catch (err) {
    console.error('[orders-public-get] Unexpected error:', err);
    return errorResponse('Internal server error', 500);
  }
});
