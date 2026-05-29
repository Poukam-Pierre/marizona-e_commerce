/**
 * categories-create — POST /functions/v1/categories-create
 *
 * Auth: MANAGER+ (level 2)
 *
 * Body:
 *   name         string  required
 *   slug         string  required, unique
 *   description  string?
 *   image        string? URL
 *   parentId     string? CUID of parent category
 *   order        number? display order (default 0)
 *   isActive     boolean? (default true)
 *   metaTitle    string?
 *   metaDescription string?
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
import { validateRequired } from '../_shared/validation.ts';

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  try {
    // Auth
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { user, error: authError, status: authStatus } = await authenticate(req, userClient);
    if (authError || !user) return errorResponse(authError!, authStatus ?? 401);

    const { error: roleError, status: roleStatus } = requireRole(user, AdminRole.MANAGER);
    if (roleError) return errorResponse(roleError, roleStatus ?? 403);

    // Parse body
    let body: Record<string, any>;
    try { body = await req.json(); } catch { return errorResponse('Invalid JSON body', 400); }

    const missing = validateRequired(body, ['name', 'slug']);
    if (missing) return errorResponse(missing, 400);

    const {
      name, slug, description, image, parentId,
      order = 0, isActive = true, metaTitle, metaDescription,
    } = body;

    const admin = createAdminClient();

    // Check slug uniqueness
    const { data: slugConflict } = await admin
      .from('categories')
      .select('id, deletedAt')
      .eq('slug', slug)
      .maybeSingle();

    if (slugConflict && !slugConflict.deletedAt) {
      return errorResponse(`Category with slug "${slug}" already exists`, 409);
    }

    // Verify parent exists if provided
    if (parentId) {
      const { data: parent } = await admin
        .from('categories')
        .select('id')
        .eq('id', parentId)
        .is('deletedAt', null)
        .maybeSingle();

      if (!parent) return errorResponse(`Parent category "${parentId}" not found`, 404);
    }

    // Insert
    const { data: category, error: insertError } = await admin
      .from('categories')
      .insert({
        name, slug,
        description: description ?? null,
        image: image ?? null,
        parentId: parentId ?? null,
        order: order ?? 0,
        isActive,
        metaTitle: metaTitle ?? null,
        metaDescription: metaDescription ?? null,
      })
      .select(`
        id, name, slug, description, image, order, isActive,
        metaTitle, metaDescription, createdAt, updatedAt, parentId,
        parent:categories!parentId(id, name, slug)
      `)
      .single();

    if (insertError || !category) {
      console.error('[categories-create] insert error:', insertError?.message);
      return errorResponse('Failed to create category', 500);
    }

    // Invalidate cache
    await Promise.all([
      invalidateNamespace(CACHE_NAMESPACES.CATEGORIES_LIST),
      invalidateNamespace(CACHE_NAMESPACES.CATEGORIES_TREE),
    ]);

    return jsonResponse({ data: category }, 201);

  } catch (err) {
    console.error('[categories-create] Unexpected error:', err);
    return errorResponse('Internal server error', 500);
  }
});
