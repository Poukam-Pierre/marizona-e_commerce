/**
 * categories-update — PATCH /functions/v1/categories-update
 *
 * Auth: MANAGER+ (level 2)
 * Validates circular reference protection before updating parentId.
 *
 * Query params:
 *   id   string  required
 *
 * Body: partial category fields (all optional)
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

// ---------------------------------------------------------------------------
// Circular reference check (mirrors NestJS checkCircularReference)
// ---------------------------------------------------------------------------

async function checkCircularReference(
  categoryId: string,
  newParentId: string,
  admin: ReturnType<typeof createAdminClient>,
): Promise<boolean> {
  let currentId: string | null = newParentId;

  while (currentId) {
    if (currentId === categoryId) return true;

    const { data } = await admin
      .from('categories')
      .select('parentId')
      .eq('id', currentId)
      .is('deletedAt', null)
      .maybeSingle();

    currentId = data?.parentId ?? null;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'PATCH' && req.method !== 'PUT') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // Auth
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { user, error: authError, status: authStatus } = await authenticate(req, userClient);
    if (authError || !user) return errorResponse(authError!, authStatus ?? 401);

    const { error: roleError, status: roleStatus } = requireRole(user, AdminRole.MANAGER);
    if (roleError) return errorResponse(roleError, roleStatus ?? 403);

    // Params
    const url = new URL(req.url);
    const id  = url.searchParams.get('id')?.trim();
    if (!id) return errorResponse('id query parameter is required', 400);

    let body: Record<string, any>;
    try { body = await req.json(); } catch { return errorResponse('Invalid JSON body', 400); }

    if (Object.keys(body).length === 0) return errorResponse('Request body is empty', 400);

    const admin = createAdminClient();

    // Verify category exists
    const { data: existing } = await admin
      .from('categories')
      .select('id, slug')
      .eq('id', id)
      .is('deletedAt', null)
      .maybeSingle();

    if (!existing) return errorResponse(`Category with id "${id}" not found`, 404);

    const { slug, parentId, ...rest } = body;

    // Slug uniqueness
    if (slug && slug !== existing.slug) {
      const { data: slugConflict } = await admin
        .from('categories')
        .select('id, deletedAt')
        .eq('slug', slug)
        .maybeSingle();

      if (slugConflict && !slugConflict.deletedAt) {
        return errorResponse(`Category with slug "${slug}" already exists`, 409);
      }
    }

    // Parent validation
    if (parentId !== undefined) {
      if (parentId === id) return errorResponse('Cannot set category as its own parent', 400);

      if (parentId !== null) {
        const { data: parent } = await admin
          .from('categories')
          .select('id')
          .eq('id', parentId)
          .is('deletedAt', null)
          .maybeSingle();

        if (!parent) return errorResponse(`Parent category "${parentId}" not found`, 404);

        const isCircular = await checkCircularReference(id, parentId, admin);
        if (isCircular) {
          return errorResponse('Circular reference detected in category hierarchy', 400);
        }
      }
    }

    // Update
    const { data: updated, error: updateError } = await admin
      .from('categories')
      .update({
        ...rest,
        ...(slug     !== undefined && { slug }),
        ...(parentId !== undefined && { parentId }),
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        id, name, slug, description, image, order, isActive,
        metaTitle, metaDescription, createdAt, updatedAt, parentId,
        parent:categories!parentId(id, name, slug)
      `)
      .single();

    if (updateError) {
      console.error('[categories-update] update error:', updateError.message);
      return errorResponse('Failed to update category', 500);
    }

    // Invalidate cache
    await Promise.all([
      invalidateNamespace(CACHE_NAMESPACES.CATEGORIES_LIST),
      invalidateNamespace(CACHE_NAMESPACES.CATEGORIES_TREE),
    ]);

    return jsonResponse({ data: updated });

  } catch (err) {
    console.error('[categories-update] Unexpected error:', err);
    return errorResponse('Internal server error', 500);
  }
});
