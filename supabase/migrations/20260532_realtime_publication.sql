-- =============================================================================
-- Migration: Enable Supabase Realtime publication for business-event tables
-- File: 20260532_realtime_publication.sql
--
-- REPLICA IDENTITY FULL was already set in 20260527_001_enable_rls_and_realtime.sql.
-- This migration adds tables to the supabase_realtime PostgreSQL publication
-- so Supabase Realtime can broadcast INSERT / UPDATE / DELETE events to clients.
--
-- Tables included:
--   products            — product catalog changes (storefront + admin)
--   product_images      — image gallery changes
--   product_variants    — variant price/stock changes
--   categories          — category tree changes
--   orders              — order status changes (customer order tracking)
--   order_items         — order line-item changes
--   inventory_movements — stock level changes (admin dashboard)
--   settings            — public settings changes (storefront config)
--
-- Tables intentionally excluded from Realtime:
--   admin_users / admin_sessions / admin_audit_logs — security-sensitive
--   customers / customer_addresses — PII, accessed via RLS-protected queries
--   push_subscriptions — internal, no UI subscription needed
--   cart_items         — ephemeral, high-write, not broadcast to other clients
--   webhook_events     — internal processing table
--   coupons            — low-frequency changes, fetched on demand
-- =============================================================================

DO $$
DECLARE
  realtime_tables TEXT[] := ARRAY[
    'products',
    'product_images',
    'product_variants',
    'categories',
    'orders',
    'order_items',
    'inventory_movements',
    'settings'
  ];
  tbl            TEXT;
  already_added  BOOLEAN;
BEGIN
  -- Verify publication exists (Supabase creates it automatically)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    RAISE EXCEPTION 'Publication supabase_realtime does not exist. '
      'Ensure Supabase Realtime is enabled in the project dashboard.';
  END IF;

  FOREACH tbl IN ARRAY realtime_tables LOOP
    SELECT EXISTS (
      SELECT 1
      FROM   pg_publication_rel  pr
      JOIN   pg_publication      p  ON p.oid  = pr.prpubid
      JOIN   pg_class            c  ON c.oid  = pr.prrelid
      WHERE  p.pubname = 'supabase_realtime'
        AND  c.relname = tbl
    ) INTO already_added;

    IF already_added THEN
      RAISE NOTICE '  [SKIP] % already in supabase_realtime', tbl;
    ELSE
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', tbl);
      RAISE NOTICE '  [ADD]  % → supabase_realtime', tbl;
    END IF;
  END LOOP;

  RAISE NOTICE 'Realtime publication setup complete.';
END;
$$;

-- =============================================================================
-- VERIFICATION QUERY (run manually after migration to confirm state)
-- =============================================================================
-- SELECT
--   c.relname                                          AS "table",
--   c.relreplident                                     AS replica_identity,
--   CASE c.relreplident
--     WHEN 'f' THEN 'FULL  ✅'
--     WHEN 'd' THEN 'DEFAULT ⚠️'
--     WHEN 'n' THEN 'NOTHING ❌'
--     WHEN 'i' THEN 'INDEX ℹ️'
--   END                                                AS replica_identity_label,
--   EXISTS (
--     SELECT 1
--     FROM   pg_publication_rel  pr
--     JOIN   pg_publication      p  ON p.oid = pr.prpubid
--     WHERE  p.pubname = 'supabase_realtime'
--       AND  pr.prrelid = c.oid
--   )                                                  AS in_realtime_publication
-- FROM pg_class c
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public'
--   AND c.relkind = 'r'
-- ORDER BY c.relname;
