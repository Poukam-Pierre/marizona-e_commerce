/**
 * products-get — GET /functions/v1/products-get
 *
 * Public endpoint. Fetch a single product by CUID (id) or slug.
 * Cache: 300 s per product (keyed by id or slug separately).
 *
 * Query parameters (one required):
 *   id    string   CUID of the product
 *   slug  string   URL slug of the product
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

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

/** Columns to select on every product-get request (includes relations). */
const PRODUCT_SELECT = `
  id, sku, name, slug, description, type,
  price, comparePrice, costPrice,
  inventoryQuantity, inventoryTracked, lowStockThreshold,
  weight, length, width, height,
  downloadUrl, downloadLimit, downloadExpiry,
  image, metaTitle, metaDescription,
  isActive, isFeatured, isBestSeller,
  viewCount, soldCount, rating, reviewCount,
  publishedAt, createdAt, updatedAt,
  categoryId, ownerName, ownerWhatsapp,
  category:categories!categoryId(id, name, slug),
  images:product_images(id, url, alt, order, isPrimary),
  variants:product_variants(
    id, sku, name, price, comparePrice, inventoryQuantity, isActive, image, weight,
    option1Name, option1Value,
    option2Name, option2Value,
    option3Name, option3Value
  )
`;

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

    if (!id && !slug) {
      return errorResponse('Either id or slug query parameter is required', 400);
    }

    // -------------------------------------------------------------------------
    // Cache lookup
    // -------------------------------------------------------------------------
    let cacheKey: string;
    if (id) {
      cacheKey = `${CACHE_NAMESPACES.PRODUCTS_ID}:${id}`;
    } else {
      cacheKey = `${CACHE_NAMESPACES.PRODUCTS_SLUG}:${slug}`;
    }

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

    // -------------------------------------------------------------------------
    // Database query
    // -------------------------------------------------------------------------
    // Use anon key — RLS policy "public_read_active_products" (migration 20260528)
    // enforces isActive=true AND deletedAt IS NULL at the DB level as defense-in-depth.
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let dbQuery = supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .is('deletedAt', null)
      .eq('isActive', true)
      // Only return active variants
      .eq('variants.isActive', true)
      // Images sorted by display order
      .order('order', { referencedTable: 'product_images', ascending: true });

    if (id) {
      dbQuery = dbQuery.eq('id', id);
    } else {
      dbQuery = dbQuery.eq('slug', slug!);
    }

    const { data, error } = await dbQuery.maybeSingle();

    if (error) {
      console.error('[products-get] DB error:', error.message);
      return errorResponse('Failed to fetch product', 500);
    }

    if (!data) {
      return errorResponse(
        id ? `Product with id "${id}" not found` : `Product with slug "${slug}" not found`,
        404,
      );
    }

    // -------------------------------------------------------------------------
    // Cache result — track under both id and slug namespaces
    // -------------------------------------------------------------------------
    await setCache(
      `${CACHE_NAMESPACES.PRODUCTS_ID}:${data.id}`,
      data,
      CACHE_TTL.PRODUCTS,
      CACHE_NAMESPACES.PRODUCTS_ID,
    );
    await setCache(
      `${CACHE_NAMESPACES.PRODUCTS_SLUG}:${data.slug}`,
      data,
      CACHE_TTL.PRODUCTS,
      CACHE_NAMESPACES.PRODUCTS_SLUG,
    );

    return jsonResponse({ data });
  } catch (err) {
    console.error('[products-get] Unexpected error:', err);
    return errorResponse('Internal server error', 500);
  }
});
