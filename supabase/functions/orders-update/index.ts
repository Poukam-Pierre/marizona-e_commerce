/**
 * orders-update — PATCH /functions/v1/orders-update?id=<orderId>
 *
 * Auth: MANAGER+ (level 2)
 * Updates order status and/or paymentStatus with state-machine enforcement.
 *
 * Query params:
 *   id   string  required — order ID
 *
 * Body (JSON):
 *   status?           OrderStatus
 *   paymentStatus?    PaymentStatus
 *   paymentId?        string
 *   trackingNumber?   string
 *   shippingProvider? string
 *   adminNotes?       string
 *   notes?            string (backward-compatible alias for adminNotes)
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

// ---------------------------------------------------------------------------
// Order state machine — mirrors admin/src/types/index.ts
// ---------------------------------------------------------------------------

type OrderStatus =
  | 'PENDING' | 'CONFIRMED' | 'PROCESSING'
  | 'SHIPPED' | 'DELIVERED' | 'COMPLETED'
  | 'CANCELLED' | 'REFUNDED';

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING:    ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:  ['PROCESSING', 'COMPLETED', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED:    ['DELIVERED'],
  DELIVERED:  ['COMPLETED', 'REFUNDED'],
  COMPLETED:  ['REFUNDED'],
  CANCELLED:  [],
  REFUNDED:   [],
};

const VALID_ORDER_STATUSES = new Set<string>(Object.keys(ALLOWED_TRANSITIONS));
const VALID_PAYMENT_STATUSES = new Set(['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIAL']);

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'PATCH') return errorResponse('Method not allowed', 405);

  try {
    // Auth
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });

    const { user, error: authError, status: authStatus } = await authenticate(req, userClient);
    if (authError || !user) return errorResponse(authError ?? 'Unauthorized', authStatus ?? 401);

    const { error: roleError, status: roleStatus } = requireRole(user, AdminRole.MANAGER);
    if (roleError) return errorResponse(roleError, roleStatus ?? 403);

    // Params
    const url     = new URL(req.url);
    const orderId = url.searchParams.get('id')?.trim();
    if (!orderId) return errorResponse('id query parameter is required', 400);

    // Body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    const {
      status,
      paymentStatus,
      paymentId,
      trackingNumber,
      shippingProvider,
      adminNotes,
      notes,
    } = body as {
      status?: string;
      paymentStatus?: string;
      paymentId?: string;
      trackingNumber?: string;
      shippingProvider?: string;
      adminNotes?: string;
      notes?: string;
    };

    if (
      !status &&
      !paymentStatus &&
      paymentId === undefined &&
      trackingNumber === undefined &&
      shippingProvider === undefined &&
      adminNotes === undefined &&
      notes === undefined
    ) {
      return errorResponse('At least one updatable field is required', 400);
    }

    const admin = createAdminClient();

    // Fetch current order
    const { data: current, error: fetchError } = await admin
      .from('orders')
      .select('id, status, paymentStatus, confirmedAt, shippedAt, deliveredAt, completedAt, cancelledAt, refundedAt, paidAt')
      .eq('id', orderId)
      .maybeSingle();

    if (fetchError || !current) return errorResponse('Order not found', 404);

    // Validate and enforce state machine
    if (status !== undefined) {
      if (!VALID_ORDER_STATUSES.has(status)) {
        return errorResponse(`Invalid status: ${status}`, 400);
      }
      const allowed = ALLOWED_TRANSITIONS[current.status as OrderStatus] ?? [];
      if (status !== current.status && !allowed.includes(status as OrderStatus)) {
        return errorResponse(
          `Cannot transition order from ${current.status} to ${status}`,
          422,
        );
      }
    }

    if (paymentStatus !== undefined && !VALID_PAYMENT_STATUSES.has(paymentStatus)) {
      return errorResponse(`Invalid paymentStatus: ${paymentStatus}`, 400);
    }

    // Build update payload — only include provided fields
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (status !== undefined) updates.status = status;
    if (paymentStatus !== undefined) updates.paymentStatus = paymentStatus;

    if (paymentId !== undefined) updates.paymentId = paymentId;
    if (trackingNumber !== undefined) updates.trackingNumber = trackingNumber;
    if (shippingProvider !== undefined) updates.shippingProvider = shippingProvider;

    const normalizedAdminNotes = adminNotes ?? notes;
    if (normalizedAdminNotes !== undefined) updates.adminNotes = normalizedAdminNotes;

    // Apply status-specific timestamps (set only if missing, matching NestJS service)
    const now = new Date().toISOString();
    if (status === 'CONFIRMED' && !current.confirmedAt) updates.confirmedAt = now;
    if (status === 'SHIPPED' && !current.shippedAt) updates.shippedAt = now;
    if (status === 'DELIVERED' && !current.deliveredAt) updates.deliveredAt = now;
    if (status === 'COMPLETED' && !current.completedAt) updates.completedAt = now;
    if (status === 'CANCELLED' && !current.cancelledAt) updates.cancelledAt = now;
    if (status === 'REFUNDED' && !current.refundedAt) updates.refundedAt = now;
    if (paymentStatus === 'PAID' && !current.paidAt) updates.paidAt = now;

    const { data: updated, error: updateError } = await admin
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .select(`
        id, orderNumber, status, paymentStatus, paymentId,
        trackingNumber, shippingProvider,
        notes:adminNotes,
        customerName, customerEmail, customerPhone, customerWhatsapp,
        subtotal, discount, shippingCost, tax, total, currency,
        shippingName, shippingPhone, shippingAddress,
        shippingCity, shippingProvince, shippingPostalCode, shippingCountry,
        createdAt, updatedAt, confirmedAt, paidAt, completedAt, deliveredAt,
        items:order_items(
          id, productId, productSku, productName, variantId, variantName,
          quantity, unitPrice, totalPrice, productType
        )
      `)
      .maybeSingle();

    if (updateError || !updated) {
      console.error('[orders-update] DB error:', updateError?.message);
      return errorResponse('Failed to update order', 500);
    }

    return jsonResponse({ data: updated });

  } catch (err) {
    console.error('[orders-update] Unexpected error:', err);
    return errorResponse('Internal server error', 500);
  }
});
