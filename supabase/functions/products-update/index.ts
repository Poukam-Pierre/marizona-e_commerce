/**
 * products-update — PATCH /functions/v1/products-update
 *
 * Auth: MANAGER+ (level 2)
 * Updates a product's scalar fields, images, and variants.
 *
 * Query params:
 *   id   string   CUID of the product to update  (required)
 *
 * Request body: partial product fields (all optional except id param).
 *   images   array?   Full replacement list. Existing images NOT in list are deleted.
 *   variants array?   Full replacement list. Existing variants NOT in list are soft-deactivated.
 *
 * Variant soft-delete: variants are only deactivated (isActive=false), never hard-deleted,
 * because CartItem.variantId and OrderItem.variantId reference them.
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
import { generateCuid } from '../_shared/validation.ts';

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
  if (req.method !== 'PATCH' && req.method !== 'PUT') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // -------------------------------------------------------------------------
    // Auth
    // -------------------------------------------------------------------------
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });

    const { user, error: authError, status: authStatus } = await authenticate(req, userClient);
    if (authError || !user) return errorResponse(authError!, authStatus ?? 401);

    const { error: roleError, status: roleStatus } = requireRole(user, AdminRole.MANAGER);
    if (roleError) return errorResponse(roleError, roleStatus ?? 403);

    // -------------------------------------------------------------------------
    // Parse params
    // -------------------------------------------------------------------------
    const url = new URL(req.url);
    const id  = url.searchParams.get('id')?.trim();
    if (!id) return errorResponse('id query parameter is required', 400);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    if (Object.keys(body).length === 0) {
      return errorResponse('Request body is empty', 400);
    }

    // -------------------------------------------------------------------------
    // Verify product exists
    // -------------------------------------------------------------------------
    const admin = createAdminClient();

    const { data: existing, error: findError } = await admin
      .from('products')
      .select('id, sku, slug, image, deletedAt')
      .eq('id', id)
      .is('deletedAt', null)
      .maybeSingle();

    if (findError || !existing) {
      return errorResponse(`Product with id "${id}" not found`, 404);
    }

    // -------------------------------------------------------------------------
    // Uniqueness checks for SKU / slug changes
    // -------------------------------------------------------------------------
    const { sku, slug, images, variants, categoryId: rawCategoryId, ...scalarFields } = body as Record<string, any>;
    // Normalize categoryId: empty string → null (same pattern as categories parentId)
    const categoryId =
      typeof rawCategoryId === 'string'
        ? (rawCategoryId.trim() || null)
        : (rawCategoryId ?? undefined);

    if (sku && sku !== existing.sku) {
      const { data: skuConflict } = await admin
        .from('products')
        .select('id, deletedAt')
        .eq('sku', sku)
        .maybeSingle();
      if (skuConflict && !skuConflict.deletedAt) {
        return errorResponse(`Product with SKU "${sku}" already exists`, 409);
      }
    }

    if (slug && slug !== existing.slug) {
      const { data: slugConflict } = await admin
        .from('products')
        .select('id, deletedAt')
        .eq('slug', slug)
        .maybeSingle();
      if (slugConflict && !slugConflict.deletedAt) {
        return errorResponse(`Product with slug "${slug}" already exists`, 409);
      }
    }

    // -------------------------------------------------------------------------
    // Update scalar fields (chained .select() for atomic update+return like categories-update)
    // -------------------------------------------------------------------------
    const updateData: Record<string, unknown> = {
      ...scalarFields,
      ...(sku        !== undefined && { sku }),
      ...(slug       !== undefined && { slug }),
      ...(categoryId !== undefined && { categoryId }),
      updatedAt: new Date().toISOString(),
    };

    const { error: updateError } = await admin
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select('id')
      .single();

    if (updateError) {
      console.error('[products-update] update error:', updateError.message, updateError.details, updateError.hint);
      return errorResponse(`Failed to update product: ${updateError.message}`, 500);
    }

    // -------------------------------------------------------------------------
    // Sync images (if provided) — full replacement
    // -------------------------------------------------------------------------
    if (images !== undefined) {
      if (!Array.isArray(images)) return errorResponse('images must be an array', 400);

      const incomingIds = images.filter((img: any) => img.id).map((img: any) => img.id as string);

      // Delete images not in new list
      let deleteQuery = admin.from('product_images').delete().eq('productId', id);
      if (incomingIds.length > 0) {
        deleteQuery = deleteQuery.not('id', 'in', `(${incomingIds.join(',')})`);
      }
      const { error: deleteError } = await deleteQuery;
      if (deleteError) {
        console.error('[products-update] image delete error:', deleteError.message);
        return errorResponse(`Failed to delete old images: ${deleteError.message}`, 500);
      }

      // Upsert images
      for (const [idx, img] of images.entries()) {
        if (img.id) {
          await admin.from('product_images').update({
            url: img.url,
            alt: img.alt ?? existing.slug,
            order: img.order ?? idx,
            isPrimary: img.isPrimary ?? false,
          }).eq('id', img.id);
        } else {
          await admin.from('product_images').insert({
            id: generateCuid(),
            productId: id,
            url: img.url,
            alt: img.alt ?? existing.slug,
            order: img.order ?? idx,
            isPrimary: img.isPrimary ?? false,
          });
        }
      }

      // Keep product.image in sync with primary image
      const primaryImg = images.find((img: any) => img.isPrimary) ?? images[0];
      if (primaryImg?.url !== undefined) {
        await admin.from('products').update({ image: primaryImg.url }).eq('id', id);
      }
    }

    // -------------------------------------------------------------------------
    // Sync variants (if provided) — soft-deactivate removed, upsert rest
    // -------------------------------------------------------------------------
    if (variants !== undefined) {
      if (!Array.isArray(variants)) return errorResponse('variants must be an array', 400);

      const incomingIds = variants.filter((v: any) => v.id).map((v: any) => v.id as string);

      // Soft-deactivate variants not in incoming list
      let deactivateQuery = admin
        .from('product_variants')
        .update({ isActive: false })
        .eq('productId', id);
      if (incomingIds.length > 0) {
        deactivateQuery = deactivateQuery.not('id', 'in', `(${incomingIds.join(',')})`);
      }
      const { error: deactivateError } = await deactivateQuery;
      if (deactivateError) {
        console.error('[products-update] variant deactivate error:', deactivateError.message);
        return errorResponse(`Failed to deactivate removed variants: ${deactivateError.message}`, 500);
      }

      // Upsert variants
      for (const v of variants) {
        const { id: variantId, ...variantData } = v;
        if (variantId) {
          await admin.from('product_variants').update(variantData).eq('id', variantId);
        } else {
          await admin.from('product_variants').insert({
            id: generateCuid(),
            productId: id,
            ...variantData,
          });
        }
      }
    }

    // -------------------------------------------------------------------------
    // Cache invalidation — products AND categories (counts change with isActive)
    // -------------------------------------------------------------------------
    await Promise.all([
      invalidateNamespace(CACHE_NAMESPACES.PRODUCTS_LIST),
      invalidateNamespace(CACHE_NAMESPACES.CATEGORIES_LIST),
      invalidateNamespace(CACHE_NAMESPACES.CATEGORIES_TREE),
      invalidateKey(`${CACHE_NAMESPACES.PRODUCTS_ID}:${id}`),
      invalidateKey(`${CACHE_NAMESPACES.PRODUCTS_SLUG}:${existing.slug}`),
      ...(slug ? [invalidateKey(`${CACHE_NAMESPACES.PRODUCTS_SLUG}:${slug}`)] : []),
    ]);

    // -------------------------------------------------------------------------
    // Return updated product
    // -------------------------------------------------------------------------
    const { data: updated } = await admin
      .from('products')
      .select(`
        id, sku, name, slug, description, type, price, comparePrice,
        inventoryQuantity, isActive, isFeatured, isBestSeller, updatedAt,
        category:categories!categoryId(id, name, slug),
        images:product_images(id, url, alt, order, isPrimary),
        variants:product_variants(id, sku, name, price, isActive)
      `)
      .eq('id', id)
      .single();

    return jsonResponse({ data: updated });

  } catch (err) {
    console.error('[products-update] Unexpected error:', err);
    return errorResponse('Internal server error', 500);
  }
});
