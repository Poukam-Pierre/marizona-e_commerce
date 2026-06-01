-- ============================================================================
-- Migration: 20260602_fix_prisma_defaults.sql
--
-- Prisma's @default(cuid()) and @updatedAt are client-side only — PostgreSQL
-- never receives them. This migration adds proper DB-level defaults so that
-- INSERT statements in Edge Functions / RPCs work without explicit values.
-- ============================================================================

-- orders table
ALTER TABLE orders
  ALTER COLUMN id        SET DEFAULT (gen_random_uuid())::text,
  ALTER COLUMN "createdAt" SET DEFAULT now(),
  ALTER COLUMN "updatedAt" SET DEFAULT now();

-- order_items and inventory_movements already got id + createdAt defaults
-- from the Prisma migration, but add them idempotently here for safety:
ALTER TABLE order_items
  ALTER COLUMN id SET DEFAULT (gen_random_uuid())::text;

ALTER TABLE inventory_movements
  ALTER COLUMN id SET DEFAULT (gen_random_uuid())::text;

-- Also fix any other tables that may be missing id defaults
-- (admin_users, categories, products — these are written by Edge Functions too)
ALTER TABLE categories
  ALTER COLUMN id        SET DEFAULT (gen_random_uuid())::text,
  ALTER COLUMN "createdAt" SET DEFAULT now(),
  ALTER COLUMN "updatedAt" SET DEFAULT now();

ALTER TABLE products
  ALTER COLUMN id        SET DEFAULT (gen_random_uuid())::text,
  ALTER COLUMN "createdAt" SET DEFAULT now(),
  ALTER COLUMN "updatedAt" SET DEFAULT now();
