-- =============================================================================
-- Migration: Enable RLS + Realtime on all tables
-- File: 20260527_001_enable_rls_and_realtime.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- REPLICA IDENTITY FULL
-- Required by Supabase Realtime to broadcast full row data (not just the PK)
-- on INSERT / UPDATE / DELETE events.
-- ---------------------------------------------------------------------------
ALTER TABLE products              REPLICA IDENTITY FULL;
ALTER TABLE product_images        REPLICA IDENTITY FULL;
ALTER TABLE product_variants      REPLICA IDENTITY FULL;
ALTER TABLE categories            REPLICA IDENTITY FULL;
ALTER TABLE orders                REPLICA IDENTITY FULL;
ALTER TABLE order_items           REPLICA IDENTITY FULL;
ALTER TABLE inventory_movements   REPLICA IDENTITY FULL;
ALTER TABLE settings              REPLICA IDENTITY FULL;
ALTER TABLE customers             REPLICA IDENTITY FULL;
ALTER TABLE customer_addresses    REPLICA IDENTITY FULL;
ALTER TABLE admin_users           REPLICA IDENTITY FULL;
ALTER TABLE push_subscriptions    REPLICA IDENTITY FULL;

-- ---------------------------------------------------------------------------
-- ENABLE ROW LEVEL SECURITY
-- Default posture: deny all. Policies below grant access incrementally.
-- ---------------------------------------------------------------------------
ALTER TABLE products              ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images        ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants      ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories            ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_addresses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons               ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events        ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- HELPER FUNCTIONS (in public schema — auth schema is Supabase-managed)
-- ⚠️ CRITICAL: Role is stored at app_metadata.role in the JWT.
--    The correct path is: auth.jwt() -> 'app_metadata' ->> 'role'
--    NOT: auth.jwt() ->> 'role'
-- ---------------------------------------------------------------------------

-- Returns the current user's role string from app_metadata, or NULL.
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT auth.jwt() -> 'app_metadata' ->> 'role';
$$;

-- Returns the numeric level for the current user's role (0 = no role / anon).
CREATE OR REPLACE FUNCTION public.user_role_level()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT CASE auth.jwt() -> 'app_metadata' ->> 'role'
    WHEN 'SUPER_ADMIN' THEN 4
    WHEN 'ADMIN'       THEN 3
    WHEN 'MANAGER'     THEN 2
    WHEN 'VIEWER'      THEN 1
    ELSE 0
  END;
$$;

-- Returns true when the current user holds at least the given role level.
CREATE OR REPLACE FUNCTION public.has_min_role(min_level INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT public.user_role_level() >= min_level;
$$;

-- ---------------------------------------------------------------------------
-- VERIFICATION QUERY (run manually to confirm)
-- ---------------------------------------------------------------------------
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
