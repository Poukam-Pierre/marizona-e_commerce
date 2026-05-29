/**
 * categories-list — GET /functions/v1/categories-list
 *
 * Public endpoint. Returns all active categories.
 * Cache: 600 s (10 minutes) — categories change infrequently.
 *
 * Query parameters (all optional):
 *   tree   boolean   If "true", returns a nested tree (root categories + children).
 *                    Default: flat list.
 *   id     string    Return a single category by CUID (flat detail view).
 *   slug   string    Return a single category by slug (flat detail view).
 *
 * When fetching a single item (id or slug), the tree parameter is ignored.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
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

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'GET') return errorResponse('Method not allowed', 405);

  try {
    const url  = new URL(req.url);
    const id   = url.searchParams.get('id')?.trim();
    const slug = url.searchParams.get('slug')?.trim();
    const tree = url.searchParams.get('tree') === 'true';

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // =========================================================================
    // Single category lookup
    // =========================================================================
    if (id || slug) {
      const cacheKey = id
        ? `categories:id:${id}`
        : `categories:slug:${slug}`;

      const cached = await getCached<unknown>(cacheKey);
      if (cached) {
        return new Response(JSON.stringify({ data: cached }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
            'X-Cache': 'HIT',
          },
        });
      }

      let query = supabase
        .from('categories')
        .select(`
          id, name, slug, description, image, order,
          isActive, metaTitle, metaDescription,
          createdAt, updatedAt, parentId,
          parent:categories!parentId(id, name, slug),
          children:categories!parentId(id, name, slug, order, isActive, image)
        `)
        .is('deletedAt', null)
        .eq('isActive', true);

      if (id)   query = query.eq('id', id);
      else      query = query.eq('slug', slug!);

      const { data, error } = await query.maybeSingle();

      if (error) {
        console.error('[categories-list] DB error (single):', error.message);
        return errorResponse('Failed to fetch category', 500);
      }

      if (!data) {
        return errorResponse(
          id ? `Category with id "${id}" not found` : `Category with slug "${slug}" not found`,
          404,
        );
      }

      await setCache(cacheKey, data, CACHE_TTL.CATEGORIES);
      return jsonResponse({ data });
    }

    // =========================================================================
    // Tree view — nested root → children → grandchildren (2 levels deep)
    // =========================================================================
    if (tree) {
      const cacheKey = `${CACHE_NAMESPACES.CATEGORIES_TREE}:all`;
      const cached = await getCached<unknown>(cacheKey);
      if (cached) {
        return new Response(JSON.stringify({ data: cached }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
            'X-Cache': 'HIT',
          },
        });
      }

      const { data, error } = await supabase
        .from('categories')
        .select(`
          id, name, slug, description, image, order,
          isActive, metaTitle, metaDescription, createdAt,
          children:categories!parentId(
            id, name, slug, description, image, order, isActive, createdAt,
            children:categories!parentId(
              id, name, slug, image, order, isActive
            )
          )
        `)
        .is('deletedAt', null)
        .is('parentId', null)           // root categories only
        .eq('isActive', true)
        .order('order', { ascending: true })
        .order('name', { ascending: true });

      if (error) {
        console.error('[categories-list] DB error (tree):', error.message);
        return errorResponse('Failed to fetch categories', 500);
      }

      await setCache(
        cacheKey, data, CACHE_TTL.CATEGORIES, CACHE_NAMESPACES.CATEGORIES_TREE,
      );
      return jsonResponse({ data });
    }

    // =========================================================================
    // Flat list — all active categories, ordered by display order then name
    // =========================================================================
    const cacheKey = `${CACHE_NAMESPACES.CATEGORIES_LIST}:all`;
    const cached   = await getCached<unknown>(cacheKey);
    if (cached) {
      return new Response(JSON.stringify({ data: cached }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
          'X-Cache': 'HIT',
        },
      });
    }

    const { data, error } = await supabase
      .from('categories')
      .select(`
        id, name, slug, description, image, order,
        isActive, metaTitle, metaDescription, createdAt, updatedAt, parentId,
        parent:categories!parentId(id, name, slug)
      `)
      .is('deletedAt', null)
      .eq('isActive', true)
      .order('order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('[categories-list] DB error (flat):', error.message);
      return errorResponse('Failed to fetch categories', 500);
    }

    await setCache(
      cacheKey, data, CACHE_TTL.CATEGORIES, CACHE_NAMESPACES.CATEGORIES_LIST,
    );
    return jsonResponse({ data });

  } catch (err) {
    console.error('[categories-list] Unexpected error:', err);
    return errorResponse('Internal server error', 500);
  }
});
