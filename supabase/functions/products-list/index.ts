/**
 * products-list — GET /functions/v1/products-list
 *
 * Public endpoint. Returns a paginated, filtered list of active products.
 * Cache: 300 s per unique query (Upstash Redis, namespace-indexed for invalidation).
 *
 * Query parameters (all optional):
 *   page        number   default 1
 *   limit       number   default 10, max 100
 *   search      string   filter by name / sku / description (ILIKE)
 *   type        string   PHYSICAL | DIGITAL
 *   categoryId  string   CUID
 *   isActive    boolean  default true (public consumers always get active only)
 *   isFeatured  boolean
 *   isBestSeller boolean
 *   minPrice    number
 *   maxPrice    number
 *   sortBy      string   createdAt | price | name | soldCount | rating  (default createdAt)
 *   sortOrder   string   asc | desc  (default desc)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  jsonResponse,
  errorResponse,
  corsResponse,
  paginatedResponse,
} from '../_shared/response.ts';
import {
  getCached,
  setCache,
  buildCacheKey,
  CACHE_NAMESPACES,
  CACHE_TTL,
} from '../_shared/cache.ts';
import {
  validatePage,
  validateLimit,
  validateEnum,
  validatePositiveNumber,
  validateCuid,
} from '../_shared/validation.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const ALLOWED_SORT_FIELDS = ['createdAt', 'price', 'name', 'soldCount', 'rating'] as const;
type SortField = typeof ALLOWED_SORT_FIELDS[number];

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'GET') return errorResponse('Method not allowed', 405);

  try {
    const url = new URL(req.url);
    const p = url.searchParams;

    // -------------------------------------------------------------------------
    // Parse & validate query parameters
    // -------------------------------------------------------------------------
    const page  = validatePage(p.get('page'));
    const limit = validateLimit(p.get('limit'), 100, 10);

    const search      = p.has('search')      ? p.get('search')!.trim().slice(0, 200) : undefined;
    const categoryId  = p.has('categoryId')  ? p.get('categoryId')! : undefined;
    const minPrice    = p.has('minPrice')    ? parseFloat(p.get('minPrice')!) : undefined;
    const maxPrice    = p.has('maxPrice')    ? parseFloat(p.get('maxPrice')!) : undefined;

    // Parse booleans — only accept explicit 'true'/'false'
    const parseOptBool = (v: string | null): boolean | undefined =>
      v === 'true' ? true : v === 'false' ? false : undefined;

    const isActive     = parseOptBool(p.get('isActive'));
    const isFeatured   = parseOptBool(p.get('isFeatured'));
    const isBestSeller = parseOptBool(p.get('isBestSeller'));

    // type enum
    const rawType = p.get('type');
    if (rawType && rawType !== 'PHYSICAL' && rawType !== 'DIGITAL') {
      return errorResponse('Invalid type. Must be PHYSICAL or DIGITAL', 400);
    }
    const type = rawType as 'PHYSICAL' | 'DIGITAL' | undefined;

    // sortBy
    const rawSortBy = (p.get('sortBy') ?? 'createdAt') as SortField;
    if (!ALLOWED_SORT_FIELDS.includes(rawSortBy)) {
      return errorResponse(
        `Invalid sortBy. Allowed: ${ALLOWED_SORT_FIELDS.join(', ')}`, 400,
      );
    }

    // sortOrder
    const rawSortOrder = p.get('sortOrder') ?? 'desc';
    if (rawSortOrder !== 'asc' && rawSortOrder !== 'desc') {
      return errorResponse('Invalid sortOrder. Must be asc or desc', 400);
    }

    // Validate categoryId is CUID-ish (non-empty, reasonable length)
    if (categoryId && categoryId.length > 50) {
      return errorResponse('Invalid categoryId', 400);
    }

    // Validate price range
    if (minPrice !== undefined && isNaN(minPrice)) return errorResponse('Invalid minPrice', 400);
    if (maxPrice !== undefined && isNaN(maxPrice)) return errorResponse('Invalid maxPrice', 400);
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      return errorResponse('minPrice cannot be greater than maxPrice', 400);
    }

    // -------------------------------------------------------------------------
    // Build normalised cache key
    // -------------------------------------------------------------------------
    const queryParams: Record<string, unknown> = {
      page, limit,
      ...(search      !== undefined && { search }),
      ...(type        !== undefined && { type }),
      ...(categoryId  !== undefined && { categoryId }),
      ...(isActive    !== undefined && { isActive }),
      ...(isFeatured  !== undefined && { isFeatured }),
      ...(isBestSeller !== undefined && { isBestSeller }),
      ...(minPrice    !== undefined && { minPrice }),
      ...(maxPrice    !== undefined && { maxPrice }),
      sortBy: rawSortBy,
      sortOrder: rawSortOrder,
    };

    const cacheKey = await buildCacheKey(CACHE_NAMESPACES.PRODUCTS_LIST, queryParams);
    const cached = await getCached<unknown>(cacheKey);
    if (cached) {
      return new Response(JSON.stringify(cached), {
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

    // -------------------------------------------------------------------------
    // Query database
    // -------------------------------------------------------------------------
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const offset = (page - 1) * limit;

    // --- Products query ---
    let query = supabase
      .from('products')
      .select(
        `id, sku, name, slug, description, type, price, comparePrice, costPrice,
         inventoryQuantity, inventoryTracked, lowStockThreshold,
         weight, image, metaTitle, metaDescription,
         isActive, isFeatured, isBestSeller, viewCount, soldCount, rating, reviewCount,
         publishedAt, createdAt, updatedAt, categoryId, ownerName, ownerWhatsapp,
         category:categories!categoryId(id, name, slug),
         images:product_images(id, url, alt, order, isPrimary),
         variants:product_variants!inner(id, sku, name, price, comparePrice, inventoryQuantity, isActive, image,
           option1Name, option1Value, option2Name, option2Value, option3Name, option3Value)`,
        { count: 'exact' },
      )
      .is('deletedAt', null)
      .eq('variants.isActive', true);

    // Public callers always get active products unless explicitly filtered (admin)
    if (isActive !== undefined) {
      query = query.eq('isActive', isActive);
    } else {
      query = query.eq('isActive', true);
    }

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,sku.ilike.%${search}%,description.ilike.%${search}%`,
      );
    }
    if (type)        query = query.eq('type', type);
    if (categoryId)  query = query.eq('categoryId', categoryId);
    if (isFeatured   !== undefined) query = query.eq('isFeatured', isFeatured);
    if (isBestSeller !== undefined) query = query.eq('isBestSeller', isBestSeller);
    if (minPrice     !== undefined) query = query.gte('price', minPrice);
    if (maxPrice     !== undefined) query = query.lte('price', maxPrice);

    // Sorting
    const ascending = rawSortOrder === 'asc';
    query = query
      .order(rawSortBy, { ascending })
      .range(offset, offset + limit - 1);

    const { data: products, count, error } = await query;

    if (error) {
      console.error('[products-list] DB error:', error.message);
      return errorResponse('Failed to fetch products', 500);
    }

    const total      = count ?? 0;
    const totalPages = Math.ceil(total / limit);

    const meta = {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };

    const responsePayload = { data: products, meta };

    // -------------------------------------------------------------------------
    // Cache result
    // -------------------------------------------------------------------------
    await setCache(cacheKey, responsePayload, CACHE_TTL.PRODUCTS, CACHE_NAMESPACES.PRODUCTS_LIST);

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'X-Cache': 'MISS',
      },
    });
  } catch (err) {
    console.error('[products-list] Unexpected error:', err);
    return errorResponse('Internal server error', 500);
  }
});
