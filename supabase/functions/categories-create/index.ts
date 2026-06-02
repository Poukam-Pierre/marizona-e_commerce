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
import { generateCuid, validateRequired } from '../_shared/validation.ts';

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  try {
    console.log('[categories-create] Request received');
    
    // Auth
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { user, error: authError, status: authStatus } = await authenticate(req, userClient);
    if (authError || !user) return errorResponse(authError!, authStatus ?? 401);

    console.log('[categories-create] Auth passed, user:', user.email);
    const { error: roleError, status: roleStatus } = requireRole(user, AdminRole.MANAGER);
    if (roleError) return errorResponse(roleError, roleStatus ?? 403);

    // Parse body
    let body: Record<string, any>;
    try { body = await req.json(); } catch { return errorResponse('Invalid JSON body', 400); }

    console.log('[categories-create] Body parsed:', body);
    const missing = validateRequired(body, ['name', 'slug']);
    if (missing) return errorResponse(missing, 400);

    const {
      name, slug, description, image, parentId,
      order = 0, isActive = true, metaTitle, metaDescription,
    } = body;
    const normalizedParentId =
      typeof parentId === 'string' ? (parentId.trim() || null) : (parentId ?? null);

    console.log('[categories-create] Creating admin client...');
    const admin = createAdminClient();
    console.log('[categories-create] Admin client created');

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
    if (normalizedParentId) {
      const { data: parent } = await admin
        .from('categories')
        .select('id')
        .eq('id', normalizedParentId)
        .is('deletedAt', null)
        .maybeSingle();

      if (!parent) return errorResponse(`Parent category "${normalizedParentId}" not found`, 404);
    }

    // Insert
    console.log('[categories-create] Inserting:', { name, slug, parentId: normalizedParentId, order, isActive });
    const categoryId = generateCuid();
    const now = new Date().toISOString();
    const { data: inserted, error: insertError } = await admin
      .from('categories')
      .insert({
        id: categoryId,
        name, slug,
        description: description ?? null,
        image: image ?? null,
        parentId: normalizedParentId,
        order: order ?? 0,
        isActive,
        metaTitle: metaTitle ?? null,
        metaDescription: metaDescription ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .select(`
        id, name, slug, description, image, order, isActive,
        metaTitle, metaDescription, createdAt, updatedAt, parentId
      `)
      .single();

    if (insertError) {
      console.error('[categories-create] insert error:', insertError.message, insertError.details);
      return errorResponse(`Failed to create category: ${insertError.message}`, 500);
    }
    if (!inserted) {
      console.error('[categories-create] insert returned no data');
      return errorResponse('Failed to create category: no data returned', 500);
    }

    // Fetch parent relation separately
    let category = inserted as any;
    if (normalizedParentId) {
      console.log('[categories-create] Fetching parent:', normalizedParentId);
      const { data: parent, error: parentFetchError } = await admin
        .from('categories')
        .select('id, name, slug')
        .eq('id', normalizedParentId)
        .maybeSingle();
      
      if (parentFetchError) {
        console.error('[categories-create] parent fetch error:', parentFetchError.message);
      }
      category.parent = parent;
    } else {
      category.parent = null;
    }

    // Invalidate cache
    console.log('[categories-create] Invalidating cache...');
    try {
      console.log('[categories-create] About to call Promise.all with cache invalidations...');
      const cacheInv = await Promise.all([
        invalidateNamespace(CACHE_NAMESPACES.CATEGORIES_LIST),
        invalidateNamespace(CACHE_NAMESPACES.CATEGORIES_TREE),
      ]);
      console.log('[categories-create] Cache invalidated, results:', cacheInv);
    } catch (cacheErr) {
      console.error('[categories-create] Cache invalidation error:', cacheErr);
      // Don't fail the request for cache errors
    }

    console.log('[categories-create] Returning category:', category);
    return jsonResponse({ data: category }, 201);

  } catch (err) {
    console.error('[categories-create] Unexpected error caught:', {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      error: err,
    });
    return errorResponse('Internal server error', 500);
  }
});
