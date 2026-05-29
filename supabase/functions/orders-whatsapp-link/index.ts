/**
 * orders-whatsapp-link — GET /functions/v1/orders-whatsapp-link
 *
 * Auth: Public (--no-verify-jwt).
 *
 * Generates a pre-filled WhatsApp checkout link for an order.
 * Phone number priority (mirrors NestJS NotificationsService):
 *   1. First product's ownerWhatsapp
 *   2. order.customerWhatsapp
 *   3. order.customerPhone
 *
 * Also records whatsappSentAt on the order for audit purposes.
 *
 * Query params:
 *   id     string  required — order CUID
 *   token  string  required — raw lookup token (prevents order ID enumeration)
 */

import { createAdminClient } from '../_shared/auth.ts';
import { jsonResponse, errorResponse, corsResponse } from '../_shared/response.ts';

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
// Price formatter (XAF/FCFA — integer amounts, no decimals)
// ---------------------------------------------------------------------------

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('fr-CM', {
    style:    'currency',
    currency: 'XAF',
    maximumFractionDigits: 0,
  }).format(amount);
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'GET') return errorResponse('Method not allowed', 405);

  try {
    const url      = new URL(req.url);
    const orderId  = url.searchParams.get('id')?.trim();
    const rawToken = url.searchParams.get('token')?.trim();

    if (!orderId)  return errorResponse('id query parameter is required', 400);
    if (!rawToken) return errorResponse('token query parameter is required', 400);

    const tokenHashHex = await hashToken(rawToken);

    // Service-role client — reads all fields including ownerWhatsapp on products
    const admin = createAdminClient();

    // Validate token + fetch order data in one query
    const { data: order, error: orderError } = await admin
      .from('orders')
      .select(`
        id, orderNumber, total, subtotal, shippingCost, currency,
        customerName, customerPhone, customerWhatsapp,
        shippingName, shippingPhone, shippingAddress,
        shippingCity, shippingProvince, shippingPostalCode, shippingCountry,
        customerNotes,
        lookupTokenExpiry,
        items:order_items(
          id, productName, productSku, variantName,
          quantity, unitPrice, totalPrice,
          product:products!productId(id, ownerName, ownerWhatsapp)
        )
      `)
      .eq('id', orderId)
      .eq('lookupToken', tokenHashHex)
      .maybeSingle();

    if (orderError || !order) return errorResponse('Order not found', 404);

    // Check token expiry
    if (order.lookupTokenExpiry && new Date(order.lookupTokenExpiry) < new Date()) {
      return errorResponse('Order not found', 404);
    }

    // Determine WhatsApp recipient number
    // Priority: product owner → customer WhatsApp → customer phone
    const firstProductOwner = (order.items ?? [])[0]?.product;
    const rawPhone =
      firstProductOwner?.ownerWhatsapp ||
      order.customerWhatsapp ||
      order.customerPhone;

    if (!rawPhone) {
      return errorResponse('No WhatsApp number available for this order', 400);
    }

    const formattedPhone = rawPhone.replace(/\D/g, '');

    // Build order summary lines
    const itemLines = (order.items ?? [])
      .map((item: any) => {
        const label = item.variantName
          ? `${item.productName} (${item.variantName})`
          : item.productName;
        return `- ${label} x${item.quantity} = ${formatPrice(item.totalPrice)}`;
      })
      .join('\n');

    const message =
`Halo, saya ingin memesan:

📄 *Order ID:* ${order.orderNumber}

📦 *Item Pesanan:*
${itemLines}

💰 *Subtotal:* ${formatPrice(order.subtotal)}
🚚 *Ongkir:* ${formatPrice(order.shippingCost)}
💸 *Total:* ${formatPrice(order.total)}

👤 *Nama:* ${order.shippingName}
📱 *Telepon:* ${order.shippingPhone}
📍 *Alamat:*
${order.shippingAddress}
${order.shippingCity}, ${order.shippingProvince}${order.shippingPostalCode ? ' ' + order.shippingPostalCode : ''}
${order.shippingCountry}${order.customerNotes ? `\n\n📝 *Catatan:* ${order.customerNotes}` : ''}

Mohon konfirmasi pesanan saya. Terima kasih! 🙏`;

    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;

    // Record whatsappSentAt (non-blocking — fire and forget)
    admin
      .from('orders')
      .update({ whatsappSentAt: new Date().toISOString() })
      .eq('id', orderId)
      .then(({ error }) => {
        if (error) console.warn('[orders-whatsapp-link] whatsappSentAt update failed:', error.message);
      });

    return jsonResponse({ data: { url: waUrl, message } });

  } catch (err) {
    console.error('[orders-whatsapp-link] Unexpected error:', err);
    return errorResponse('Internal server error', 500);
  }
});
