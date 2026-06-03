/**
 * products-delete — DELETE /functions/v1/products-delete
 *
 * Auth: SUPER_ADMIN only (level 4) — matches NestJS @Roles(AdminRole.SUPER_ADMIN)
 * Soft-deletes a product (sets deletedAt). Never hard-deletes.
 *
 * Query params:
 *   id   string   CUID of the product to delete  (required)
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
  invalidateNamespace,
  invalidateKey,
  CACHE_NAMESPACES,
} from '../_shared/cache.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'DELETE') return errorResponse('Method not allowed', 405);

  try {
    // -------------------------------------------------------------------------
    // Auth — SUPER_ADMIN only
    // -------------------------------------------------------------------------
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });

    const { user, error: authError, status: authStatus } = await authenticate(req, userClient);
    if (authError || !user) return errorResponse(authError!, authStatus ?? 401);

    const { error: roleError, status: roleStatus } = requireRole(user, AdminRole.SUPER_ADMIN);
    if (roleError) return errorResponse(roleError, roleStatus ?? 403);

    // -------------------------------------------------------------------------
    // Parse params
    // -------------------------------------------------------------------------
    const url = new URL(req.url);
    const id  = url.searchParams.get('id')?.trim();
    if (!id) return errorResponse('id query parameter is required', 400);

    // -------------------------------------------------------------------------
    // Verify product exists
    // -------------------------------------------------------------------------
    const admin = createAdminClient();

    const { data: existing, error: findError } = await admin
      .from('products')
      .select('id, sku, slug')
      .eq('id', id)
      .is('deletedAt', null)
      .maybeSingle();

    if (findError || !existing) {
      return errorResponse(`Product with id "${id}" not found`, 404);
    }

    // -------------------------------------------------------------------------
    // Soft delete — never hard delete (order history, cart items reference products)
    // -------------------------------------------------------------------------
    const { error: deleteError } = await admin
      .from('products')
      .update({ deletedAt: new Date().toISOString(), isActive: false })
      .eq('id', id);

    if (deleteError) {
      console.error('[products-delete] delete error:', deleteError.message);
      return errorResponse('Failed to delete product', 500);
    }

    // -------------------------------------------------------------------------
    // Cache invalidation
    // -------------------------------------------------------------------------
    await Promise.all([
      invalidateNamespace(CACHE_NAMESPACES.PRODUCTS_LIST),
      invalidateKey(`${CACHE_NAMESPACES.PRODUCTS_ID}:${id}`),
      invalidateKey(`${CACHE_NAMESPACES.PRODUCTS_SLUG}:${existing.slug}`),
    ]);

    return jsonResponse({ data: { message: 'Product deleted successfully', id } });

  } catch (err) {
    console.error('[products-delete] Unexpected error:', err);
    return errorResponse('Internal server error', 500);
  }
});
