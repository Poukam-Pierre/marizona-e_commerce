-- ============================================================================
-- Migration: 20260602_fix_prisma_defaults.sql
--
-- Prisma's @default(cuid()) and @updatedAt are client-side only — PostgreSQL
-- never receives them. This migration:
--
--   1. Adds a generate_cuid() DB function that produces cXXXXXXXX… strings
--      matching the Prisma/Edge Function format (starts with 'c', lowercase
--      alphanumeric). Using gen_random_uuid()::text was intentionally avoided
--      because it produces UUID-format strings that break validateCuid() checks
--      and would create mixed ID formats alongside existing CUID rows.
--
--   2. Sets id DEFAULT to generate_cuid() on tables written by Edge Functions.
--
--   3. Sets createdAt DEFAULT to now() on INSERT.
--
--   4. Adds set_updated_at() trigger function + per-table triggers so that
--      updatedAt is automatically bumped on every UPDATE, replicating Prisma's
--      @updatedAt semantics. A plain DEFAULT now() on the column only fires on
--      INSERT, not UPDATE.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. CUID generator (matches Prisma / Edge Function generateCuid() format)
--    Produces: c + 24 lowercase base-36 chars
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_cuid()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_timestamp text;
  v_entropy   text;
  v_random    text;
BEGIN
  -- No pgcrypto dependency (gen_random_bytes); works on plain PostgreSQL/Supabase.
  v_timestamp := lpad(to_hex(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint), 11, '0');
  v_entropy   := md5(random()::text || clock_timestamp()::text || txid_current()::text);
  v_random    := lower(substring(v_entropy FROM 1 FOR 20));
  RETURN 'c' || substring(v_timestamp || v_random FROM 1 FOR 24);
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. ID defaults — generate_cuid() so all rows share the same CUID format
-- ---------------------------------------------------------------------------
ALTER TABLE orders
  ALTER COLUMN id SET DEFAULT generate_cuid(),
  ALTER COLUMN "createdAt" SET DEFAULT now();

ALTER TABLE order_items
  ALTER COLUMN id SET DEFAULT generate_cuid();

ALTER TABLE inventory_movements
  ALTER COLUMN id SET DEFAULT generate_cuid();

ALTER TABLE categories
  ALTER COLUMN id SET DEFAULT generate_cuid(),
  ALTER COLUMN "createdAt" SET DEFAULT now();

ALTER TABLE products
  ALTER COLUMN id SET DEFAULT generate_cuid(),
  ALTER COLUMN "createdAt" SET DEFAULT now();

ALTER TABLE settings
  ALTER COLUMN id SET DEFAULT generate_cuid(),
  ALTER COLUMN "createdAt" SET DEFAULT now();

-- ---------------------------------------------------------------------------
-- 3. updatedAt trigger — fires on every UPDATE, replicating Prisma @updatedAt
--    A column DEFAULT only fires on INSERT; this trigger covers UPDATE too.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."updatedAt" := now();
  RETURN NEW;
END;
$$;

-- orders
DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- categories
DROP TRIGGER IF EXISTS trg_categories_updated_at ON categories;
CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- products
DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- settings
DROP TRIGGER IF EXISTS trg_settings_updated_at ON settings;
CREATE TRIGGER trg_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
