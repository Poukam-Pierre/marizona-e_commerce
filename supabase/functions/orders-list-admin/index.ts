/**
 * orders-list-admin — GET /functions/v1/orders-list-admin
 *
 * Auth: MANAGER+ (level 2)
 * Returns paginated orders with full customer and line-item data.
 * Admin view — no RLS customer filter applied (uses service-role client).
 *
 * Query parameters (all optional):
 *   page          number  default 1
 *   limit         number  default 10, max 100
 *   status        string  OrderStatus enum
 *   paymentStatus string  PaymentStatus enum
 *   customerId    string  CUID
 *   search        string  order number / customer name / email / phone
 *   startDate     string  ISO 8601 date
 *   endDate       string  ISO 8601 date
 *   sortOrder     string  asc | desc  (default desc, always sorted by createdAt)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  authenticate,
  requireRole,
  createAdminClient,
  AdminRole,
} from '../_shared/auth.ts';
import {
  jsonResponse,
  errorResponse,
  corsResponse,
} from '../_shared/response.ts';
import {
  validatePage,
  validateLimit,
} from '../_shared/validation.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const VALID_ORDER_STATUSES = [
  'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED',
  'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED',
];
const VALID_PAYMENT_STATUSES = [
  'PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIAL',
];

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'GET') return errorResponse('Method not allowed', 405);

  try {
    // Auth — MANAGER+
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { user, error: authError, status: authStatus } = await authenticate(req, userClient);
    if (authError || !user) return errorResponse(authError!, authStatus ?? 401);

    const { error: roleError, status: roleStatus } = requireRole(user, AdminRole.MANAGER);
    if (roleError) return errorResponse(roleError, roleStatus ?? 403);

    // -------------------------------------------------------------------------
    // Parse & validate query params
    // -------------------------------------------------------------------------
    const url = new URL(req.url);
    const p   = url.searchParams;

    const page  = validatePage(p.get('page'));
    const limit = validateLimit(p.get('limit'), 100, 10);

    const status        = p.get('status')?.toUpperCase();
    const paymentStatus = p.get('paymentStatus')?.toUpperCase();
    const customerId    = p.get('customerId')?.trim();
    const search        = p.get('search')?.trim().slice(0, 200);
    const startDate     = p.get('startDate')?.trim();
    const endDate       = p.get('endDate')?.trim();
    const sortOrder     = p.get('sortOrder') ?? 'desc';

    if (status && !VALID_ORDER_STATUSES.includes(status)) {
      return errorResponse(`Invalid status. Allowed: ${VALID_ORDER_STATUSES.join(', ')}`, 400);
    }
    if (paymentStatus && !VALID_PAYMENT_STATUSES.includes(paymentStatus)) {
      return errorResponse(
        `Invalid paymentStatus. Allowed: ${VALID_PAYMENT_STATUSES.join(', ')}`, 400,
      );
    }
    if (sortOrder !== 'asc' && sortOrder !== 'desc') {
      return errorResponse('sortOrder must be asc or desc', 400);
    }
    if (startDate && isNaN(Date.parse(startDate))) {
      return errorResponse('Invalid startDate format (ISO 8601 expected)', 400);
    }
    if (endDate && isNaN(Date.parse(endDate))) {
      return errorResponse('Invalid endDate format (ISO 8601 expected)', 400);
    }

    // -------------------------------------------------------------------------
    // Build and execute query (service-role bypasses customer RLS)
    // -------------------------------------------------------------------------
    const admin  = createAdminClient();
    const offset = (page - 1) * limit;

    let query = admin
      .from('orders')
      .select(
        `id, orderNumber, status, paymentStatus, paymentMethod,
         customerName, customerEmail, customerPhone, customerWhatsapp,
         shippingCity, shippingProvince, shippingCountry,
         subtotal, discount, shippingCost, tax, total, currency,
         couponCode, trackingNumber,
         createdAt, updatedAt, confirmedAt, cancelledAt, completedAt,
         customerId,
         customer:customers!customerId(id, name, email, phone),
         items:order_items(
           id, productName, productSku, variantName,
           quantity, unitPrice, totalPrice, productType,
           isShipped, isDelivered,
           product:products!productId(id, name, sku, image)
         )`,
        { count: 'exact' },
      )
      .order('createdAt', { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    // Filters
    if (status)        query = query.eq('status', status);
    if (paymentStatus) query = query.eq('paymentStatus', paymentStatus);
    if (customerId)    query = query.eq('customerId', customerId);
    if (startDate)     query = query.gte('createdAt', new Date(startDate).toISOString());
    if (endDate)       query = query.lte('createdAt', new Date(endDate).toISOString());

    // Search across order number, customer name, email, phone
    if (search) {
      query = query.or(
        `orderNumber.ilike.%${search}%,customerName.ilike.%${search}%,customerEmail.ilike.%${search}%,customerPhone.ilike.%${search}%`,
      );
    }

    const { data: orders, count, error: queryError } = await query;

    if (queryError) {
      console.error('[orders-list-admin] DB error:', queryError.message);
      return errorResponse('Failed to fetch orders', 500);
    }

    const total      = count ?? 0;
    const totalPages = Math.ceil(total / limit);

    return jsonResponse({
      data: orders,
      meta: {
        page, limit, total, totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });

  } catch (err) {
    console.error('[orders-list-admin] Unexpected error:', err);
    return errorResponse('Internal server error', 500);
  }
});
