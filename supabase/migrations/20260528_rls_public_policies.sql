-- =============================================================================
-- Migration: Public (unauthenticated) read policies
-- File: 20260527_002_rls_public_policies.sql
-- These policies allow anonymous visitors to read the public product catalog
-- and public settings — no authentication required.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PRODUCTS: public can read active, non-deleted products
-- ---------------------------------------------------------------------------
CREATE POLICY "public_read_active_products"
  ON products
  FOR SELECT
  USING ("isActive" = true AND "deletedAt" IS NULL);

-- ---------------------------------------------------------------------------
-- PRODUCT IMAGES: public can read images of active products
-- ---------------------------------------------------------------------------
CREATE POLICY "public_read_product_images"
  ON product_images
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_images."productId"
        AND p."isActive" = true
        AND p."deletedAt" IS NULL
    )
  );

-- ---------------------------------------------------------------------------
-- PRODUCT VARIANTS: public can read variants of active products
-- ---------------------------------------------------------------------------
CREATE POLICY "public_read_product_variants"
  ON product_variants
  FOR SELECT
  USING (
    "isActive" = true
    AND EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_variants."productId"
        AND p."isActive" = true
        AND p."deletedAt" IS NULL
    )
  );

-- ---------------------------------------------------------------------------
-- CATEGORIES: public can read active, non-deleted categories
-- ---------------------------------------------------------------------------
CREATE POLICY "public_read_active_categories"
  ON categories
  FOR SELECT
  USING ("isActive" = true AND "deletedAt" IS NULL);

-- ---------------------------------------------------------------------------
-- SETTINGS: public can read settings in the 'general' or 'store' categories only
-- (Updated 20260601: 'public' category does not exist; seeded settings use
--  'general'/'store'/'checkout'/'notifications'. Only general+store are public.)
-- ---------------------------------------------------------------------------
CREATE POLICY "public_read_public_settings"
  ON settings
  FOR SELECT
  USING (category IN ('general', 'store'));

-- ---------------------------------------------------------------------------
-- COUPONS: public can read active coupons (needed at checkout to validate)
-- Sensitive fields (usage counts) are acceptable to expose on validation.
-- ---------------------------------------------------------------------------
CREATE POLICY "public_read_active_coupons"
  ON coupons
  FOR SELECT
  USING ("isActive" = true);
