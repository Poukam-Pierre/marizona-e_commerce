/**
 * dashboard-stats — GET /functions/v1/dashboard-stats
 *
 * Auth: VIEWER+ (level 1)
 * Returns aggregated dashboard statistics. Cache TTL: 60 s.
 *
 * Query params:
 *   type   string   stats | low-stock | recent-orders | all  (default: all)
 *
 * Note: Supabase JS client doesn't natively support comparing two columns
 * (inventoryQuantity <= lowStockThreshold) in a single .filter() call.
 * We use a raw RPC or a subquery-style check via a Postgres function.
 * As a pragmatic fallback we fetch all tracked products and filter in JS —
 * acceptable for typical catalog sizes (<10 k products).
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
  getCached,
  setCache,
  CACHE_NAMESPACES,
  CACHE_TTL,
} from '../_shared/cache.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

// Order statuses counted toward revenue (mirrors NestJS)
const REVENUE_STATUSES = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'];

// ---------------------------------------------------------------------------
// Data fetchers
// ---------------------------------------------------------------------------

async function fetchStats(admin: ReturnType<typeof createAdminClient>) {
  const cacheKey = `${CACHE_NAMESPACES.DASHBOARD_STATS}:v1`;
  const cached = await getCached<unknown>(cacheKey);
  if (cached) return { data: cached, cached: true };

  const [
    productsRes,
    ordersRes,
    revenueRes,
    pendingRes,
  ] = await Promise.all([
    admin
      .from('products')
      .select('id', { count: 'exact', head: true })
      .is('deletedAt', null)
      .eq('isActive', true),

    admin
      .from('orders')
      .select('id', { count: 'exact', head: true }),

    admin
      .from('orders')
      .select('total')
      .in('status', REVENUE_STATUSES),

    admin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'PENDING'),
  ]);

  // Low-stock: fetch tracked products and compare columns in JS
  const { data: trackedProducts } = await admin
    .from('products')
    .select('id, inventoryQuantity, lowStockThreshold')
    .is('deletedAt', null)
    .eq('isActive', true)
    .eq('inventoryTracked', true);

  const lowStockCount = (trackedProducts ?? []).filter(
    (p) => p.inventoryQuantity <= p.lowStockThreshold,
  ).length;

  const totalRevenue = (revenueRes.data ?? []).reduce(
    (sum: number, o: any) => sum + (o.total ?? 0), 0,
  );

  const stats = {
    totalProducts:   productsRes.count  ?? 0,
    totalOrders:     ordersRes.count    ?? 0,
    totalRevenue,
    lowStockProducts: lowStockCount,
    pendingOrders:   pendingRes.count   ?? 0,
  };

  await setCache(cacheKey, stats, CACHE_TTL.DASHBOARD, CACHE_NAMESPACES.DASHBOARD_STATS);
  return { data: stats, cached: false };
}

async function fetchLowStock(admin: ReturnType<typeof createAdminClient>) {
  const cacheKey = `${CACHE_NAMESPACES.DASHBOARD_LOW_STOCK}:v1`;
  const cached = await getCached<unknown>(cacheKey);
  if (cached) return { data: cached, cached: true };

  const { data: products } = await admin
    .from('products')
    .select('id, name, sku, inventoryQuantity, lowStockThreshold, image')
    .is('deletedAt', null)
    .eq('isActive', true)
    .eq('inventoryTracked', true)
    .order('inventoryQuantity', { ascending: true })
    .limit(50); // fetch enough to filter in JS

  const lowStock = (products ?? [])
    .filter((p) => p.inventoryQuantity <= p.lowStockThreshold)
    .slice(0, 10);

  await setCache(cacheKey, lowStock, CACHE_TTL.DASHBOARD, CACHE_NAMESPACES.DASHBOARD_LOW_STOCK);
  return { data: lowStock, cached: false };
}

async function fetchRecentOrders(admin: ReturnType<typeof createAdminClient>) {
  const cacheKey = `${CACHE_NAMESPACES.DASHBOARD_RECENT_ORDERS}:v1`;
  const cached = await getCached<unknown>(cacheKey);
  if (cached) return { data: cached, cached: true };

  const { data: orders } = await admin
    .from('orders')
    .select('id, orderNumber, customerName, total, status, createdAt')
    .order('createdAt', { ascending: false })
    .limit(10);

  await setCache(
    cacheKey, orders ?? [], CACHE_TTL.DASHBOARD, CACHE_NAMESPACES.DASHBOARD_RECENT_ORDERS,
  );
  return { data: orders ?? [], cached: false };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'GET') return errorResponse('Method not allowed', 405);

  try {
    // Auth — VIEWER+
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { user, error: authError, status: authStatus } = await authenticate(req, userClient);
    if (authError || !user) return errorResponse(authError!, authStatus ?? 401);

    const { error: roleError, status: roleStatus } = requireRole(user, AdminRole.VIEWER);
    if (roleError) return errorResponse(roleError, roleStatus ?? 403);

    // Params
    const url  = new URL(req.url);
    const type = url.searchParams.get('type') ?? 'all';

    const validTypes = ['stats', 'low-stock', 'recent-orders', 'all'];
    if (!validTypes.includes(type)) {
      return errorResponse(`Invalid type. Allowed: ${validTypes.join(', ')}`, 400);
    }

    const admin = createAdminClient();

    // Fetch requested data
    if (type === 'stats') {
      const { data } = await fetchStats(admin);
      return jsonResponse({ data });
    }

    if (type === 'low-stock') {
      const { data } = await fetchLowStock(admin);
      return jsonResponse({ data });
    }

    if (type === 'recent-orders') {
      const { data } = await fetchRecentOrders(admin);
      return jsonResponse({ data });
    }

    // type === 'all' — return everything in one response
    const [statsResult, lowStockResult, recentOrdersResult] = await Promise.all([
      fetchStats(admin),
      fetchLowStock(admin),
      fetchRecentOrders(admin),
    ]);

    return jsonResponse({
      data: {
        stats:        statsResult.data,
        lowStock:     lowStockResult.data,
        recentOrders: recentOrdersResult.data,
      },
    });

  } catch (err) {
    console.error('[dashboard-stats] Unexpected error:', err);
    return errorResponse('Internal server error', 500);
  }
});
