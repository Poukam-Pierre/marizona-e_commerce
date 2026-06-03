/**
 * products-create — POST /functions/v1/products-create
 *
 * Auth: MANAGER+ (level 2)
 * Creates a product with optional images and variants in a single request.
 * Invalidates the products cache on success.
 *
 * Request body (JSON):
 *   sku          string   required, unique
 *   name         string   required
 *   slug         string   required, unique
 *   price        number   required
 *   type         string   PHYSICAL | DIGITAL  (default PHYSICAL)
 *   description  string?
 *   categoryId   string?  CUID
 *   comparePrice number?
 *   costPrice    number?
 *   inventoryQuantity number? (default 0)
 *   inventoryTracked  boolean? (default true)
 *   lowStockThreshold number? (default 10)
 *   weight/length/width/height number?
 *   downloadUrl/downloadLimit/downloadExpiry  (digital products)
 *   ownerName/ownerWhatsapp  string?
 *   isActive     boolean? (default true)
 *   isFeatured   boolean? (default false)
 *   isBestSeller boolean? (default false)
 *   metaTitle/metaDescription string?
 *   images       Array<{ url, alt?, order?, isPrimary? }>
 *   variants     Array<{ sku, name, price, comparePrice?, inventoryQuantity?,
 *                        isActive?, weight?, image?,
 *                        option1Name?, option1Value?, ... option3 }>
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
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

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
    // Parse body
    // -------------------------------------------------------------------------
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    // Required fields
    const missing = validateRequired(body, ['sku', 'name', 'slug', 'price']);
    if (missing) return errorResponse(missing, 400);

    const {
      sku, name, slug, price, type = 'PHYSICAL',
      description, categoryId, comparePrice, costPrice,
      inventoryQuantity = 0, inventoryTracked = true, lowStockThreshold = 10,
      weight, length, width, height,
      downloadUrl, downloadLimit, downloadExpiry,
      ownerName, ownerWhatsapp,
      isActive = true, isFeatured = false, isBestSeller = false,
      metaTitle, metaDescription,
      images = [], variants = [],
    } = body as Record<string, any>;

    // Validate type enum
    if (type !== 'PHYSICAL' && type !== 'DIGITAL') {
      return errorResponse('type must be PHYSICAL or DIGITAL', 400);
    }

    if (typeof price !== 'number' || price < 0) {
      return errorResponse('price must be a non-negative number', 400);
    }

    if (!Array.isArray(images)) return errorResponse('images must be an array', 400);
    if (!Array.isArray(variants)) return errorResponse('variants must be an array', 400);

    // -------------------------------------------------------------------------
    // Business rules — check uniqueness via service-role client
    // -------------------------------------------------------------------------
    const admin = createAdminClient();
    const productId = generateCuid();

    const [skuCheck, slugCheck] = await Promise.all([
      admin.from('products').select('id, deletedAt').eq('sku', sku).maybeSingle(),
      admin.from('products').select('id, deletedAt').eq('slug', slug).maybeSingle(),
    ]);

    if (skuCheck.data && !skuCheck.data.deletedAt) {
      return errorResponse(`Product with SKU "${sku}" already exists`, 409);
    }
    if (slugCheck.data && !slugCheck.data.deletedAt) {
      return errorResponse(`Product with slug "${slug}" already exists`, 409);
    }

    // -------------------------------------------------------------------------
    // Insert product
    // -------------------------------------------------------------------------
    const primaryImageUrl = Array.isArray(images)
      ? (images.find((img: any) => img.isPrimary) ?? images[0])?.url
      : undefined;
    const now = new Date().toISOString();

    const { data: product, error: insertError } = await admin
      .from('products')
      .insert({
        id: productId,
        sku, name, slug, description: description ?? null, type, price,
        comparePrice: comparePrice ?? null,
        costPrice: costPrice ?? null,
        inventoryQuantity: inventoryQuantity ?? 0,
        inventoryTracked: inventoryTracked ?? true,
        lowStockThreshold: lowStockThreshold ?? 10,
        weight: weight ?? null, length: length ?? null,
        width: width ?? null, height: height ?? null,
        downloadUrl: downloadUrl ?? null,
        downloadLimit: downloadLimit ?? null,
        downloadExpiry: downloadExpiry ?? null,
        ownerName: ownerName ?? null,
        ownerWhatsapp: ownerWhatsapp ?? null,
        categoryId: categoryId ?? null,
        image: primaryImageUrl ?? null,
        isActive, isFeatured, isBestSeller,
        metaTitle: metaTitle ?? null,
        metaDescription: metaDescription ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .select('id, sku, name, slug')
      .single();

    if (insertError || !product) {
      console.error('[products-create] insert error:', insertError?.message);
      return errorResponse('Failed to create product', 500);
    }

    // -------------------------------------------------------------------------
    // Insert images
    // -------------------------------------------------------------------------
    if (images.length > 0) {
      const imageRows = images.map((img: any, idx: number) => ({
        id: generateCuid(),
        productId: product.id,
        url: img.url,
        alt: img.alt ?? name,
        order: img.order ?? idx,
        isPrimary: img.isPrimary ?? idx === 0,
      }));

      const { error: imgError } = await admin.from('product_images').insert(imageRows);
      if (imgError) {
        console.error('[products-create] image insert error:', imgError.message);
        // Don't fail the whole request — product is already created
      }
    }

    // -------------------------------------------------------------------------
    // Insert variants
    // -------------------------------------------------------------------------
    if (variants.length > 0) {
      const variantRows = variants.map((v: any) => ({
        id: generateCuid(),
        productId: product.id,
        sku: v.sku,
        name: v.name,
        price: v.price,
        comparePrice: v.comparePrice ?? null,
        inventoryQuantity: v.inventoryQuantity ?? 0,
        isActive: v.isActive ?? true,
        weight: v.weight ?? null,
        image: v.image ?? null,
        option1Name: v.option1Name ?? null, option1Value: v.option1Value ?? null,
        option2Name: v.option2Name ?? null, option2Value: v.option2Value ?? null,
        option3Name: v.option3Name ?? null, option3Value: v.option3Value ?? null,
      }));

      const { error: varError } = await admin.from('product_variants').insert(variantRows);
      if (varError) {
        console.error('[products-create] variant insert error:', varError.message);
      }
    }

    // -------------------------------------------------------------------------
    // Cache invalidation
    // -------------------------------------------------------------------------
    await Promise.all([
      invalidateNamespace(CACHE_NAMESPACES.PRODUCTS_LIST),
      invalidateNamespace(CACHE_NAMESPACES.PRODUCTS_ID),
      invalidateNamespace(CACHE_NAMESPACES.PRODUCTS_SLUG),
    ]);

    // -------------------------------------------------------------------------
    // Return created product (with relations)
    // -------------------------------------------------------------------------
    const { data: created } = await admin
      .from('products')
      .select(`
        id, sku, name, slug, description, type, price, comparePrice,
        inventoryQuantity, isActive, isFeatured, isBestSeller, createdAt,
        category:categories!categoryId(id, name, slug),
        images:product_images(id, url, alt, order, isPrimary),
        variants:product_variants(id, sku, name, price, isActive)
      `)
      .eq('id', product.id)
      .single();

    return jsonResponse({ data: created }, 201);

  } catch (err) {
    console.error('[products-create] Unexpected error:', err);
    return errorResponse('Internal server error', 500);
  }
});
