/**
 * categories-delete — DELETE /functions/v1/categories-delete
 *
 * Auth: ADMIN+ (level 3) — matches NestJS @Roles(AdminRole.ADMIN)
 * Soft-deletes a category. Blocks deletion if category has active children.
 * Products in the category have their categoryId set to NULL (SetNull FK behavior).
 *
 * Query params:
 *   id   string  required
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
  CACHE_NAMESPACES,
} from '../_shared/cache.ts';

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'DELETE') return errorResponse('Method not allowed', 405);

  try {
    // Auth — ADMIN+
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { user, error: authError, status: authStatus } = await authenticate(req, userClient);
    if (authError || !user) return errorResponse(authError!, authStatus ?? 401);

    const { error: roleError, status: roleStatus } = requireRole(user, AdminRole.ADMIN);
    if (roleError) return errorResponse(roleError, roleStatus ?? 403);

    // Params
    const url = new URL(req.url);
    const id  = url.searchParams.get('id')?.trim();
    if (!id) return errorResponse('id query parameter is required', 400);

    const admin = createAdminClient();

    // Verify category exists
    const { data: existing } = await admin
      .from('categories')
      .select('id, slug')
      .eq('id', id)
      .is('deletedAt', null)
      .maybeSingle();

    if (!existing) return errorResponse(`Category with id "${id}" not found`, 404);

    // Block if has active children
    const { count: childCount } = await admin
      .from('categories')
      .select('id', { count: 'exact', head: true })
      .eq('parentId', id)
      .is('deletedAt', null);

    if (childCount && childCount > 0) {
      return errorResponse(
        'Cannot delete category with children. Remove or reassign children first.',
        400,
      );
    }

    // Soft delete
    const { error: deleteError } = await admin
      .from('categories')
      .update({ deletedAt: new Date().toISOString(), isActive: false })
      .eq('id', id);

    if (deleteError) {
      console.error('[categories-delete] delete error:', deleteError.message);
      return errorResponse('Failed to delete category', 500);
    }

    // Invalidate cache
    await Promise.all([
      invalidateNamespace(CACHE_NAMESPACES.CATEGORIES_LIST),
      invalidateNamespace(CACHE_NAMESPACES.CATEGORIES_TREE),
      invalidateNamespace(CACHE_NAMESPACES.PRODUCTS_LIST),
    ]);

    return jsonResponse({ data: { message: 'Category deleted successfully', id } });

  } catch (err) {
    console.error('[categories-delete] Unexpected error:', err);
    return errorResponse('Internal server error', 500);
  }
});
