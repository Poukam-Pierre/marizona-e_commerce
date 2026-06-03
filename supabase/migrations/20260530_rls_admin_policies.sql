-- =============================================================================
-- Migration: Admin policies
-- File: 20260527_004_rls_admin_policies.sql
--
-- Role hierarchy (from auth.user_role_level()):
--   SUPER_ADMIN = 4  — full access including destructive operations
--   ADMIN       = 3  — manage users, orders, products, settings
--   MANAGER     = 2  — manage products, categories, inventory; read orders
--   VIEWER      = 1  — read-only across all admin data
--
-- ⚠️ CRITICAL: Role is stored at app_metadata.role in the JWT.
--    Uses auth.has_min_role(level) helper from migration 001.
--
-- Edge Functions that write data use the service role (bypasses RLS).
-- These policies primarily protect direct Supabase client access from
-- the admin frontend and Supabase Realtime subscriptions.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PRODUCTS: read (VIEWER+), write (MANAGER+), delete (SUPER_ADMIN only)
-- ---------------------------------------------------------------------------
CREATE POLICY "admin_read_all_products"
  ON products
  FOR SELECT
  USING (public.has_min_role(1)); -- VIEWER+

CREATE POLICY "admin_insert_products"
  ON products
  FOR INSERT
  WITH CHECK (public.has_min_role(2)); -- MANAGER+

CREATE POLICY "admin_update_products"
  ON products
  FOR UPDATE
  USING (public.has_min_role(2))       -- MANAGER+
  WITH CHECK (public.has_min_role(2));

CREATE POLICY "admin_delete_products"
  ON products
  FOR DELETE
  USING (public.has_min_role(4)); -- SUPER_ADMIN only

-- ---------------------------------------------------------------------------
-- PRODUCT IMAGES: read (VIEWER+), write (MANAGER+)
-- ---------------------------------------------------------------------------
CREATE POLICY "admin_read_all_product_images"
  ON product_images FOR SELECT USING (public.has_min_role(1));

CREATE POLICY "admin_write_product_images"
  ON product_images FOR ALL
  USING (public.has_min_role(2))
  WITH CHECK (public.has_min_role(2));

-- ---------------------------------------------------------------------------
-- PRODUCT VARIANTS: read (VIEWER+), write (MANAGER+)
-- ---------------------------------------------------------------------------
CREATE POLICY "admin_read_all_product_variants"
  ON product_variants FOR SELECT USING (public.has_min_role(1));

CREATE POLICY "admin_write_product_variants"
  ON product_variants FOR ALL
  USING (public.has_min_role(2))
  WITH CHECK (public.has_min_role(2));

-- ---------------------------------------------------------------------------
-- CATEGORIES: read (VIEWER+), write (MANAGER+), delete (ADMIN+)
-- ---------------------------------------------------------------------------
CREATE POLICY "admin_read_all_categories"
  ON categories FOR SELECT USING (public.has_min_role(1));

CREATE POLICY "admin_insert_categories"
  ON categories FOR INSERT WITH CHECK (public.has_min_role(2));

CREATE POLICY "admin_update_categories"
  ON categories FOR UPDATE
  USING (public.has_min_role(2))
  WITH CHECK (public.has_min_role(2));

CREATE POLICY "admin_delete_categories"
  ON categories FOR DELETE USING (public.has_min_role(3)); -- ADMIN+

-- ---------------------------------------------------------------------------
-- ORDERS: read (VIEWER+), update status (MANAGER+), delete (SUPER_ADMIN)
-- ---------------------------------------------------------------------------
CREATE POLICY "admin_read_all_orders"
  ON orders FOR SELECT USING (public.has_min_role(1));

CREATE POLICY "admin_update_orders"
  ON orders FOR UPDATE
  USING (public.has_min_role(2))
  WITH CHECK (public.has_min_role(2));

CREATE POLICY "admin_delete_orders"
  ON orders FOR DELETE USING (public.has_min_role(4)); -- SUPER_ADMIN only

-- ---------------------------------------------------------------------------
-- ORDER ITEMS: read (VIEWER+)
-- ---------------------------------------------------------------------------
CREATE POLICY "admin_read_all_order_items"
  ON order_items FOR SELECT USING (public.has_min_role(1));

CREATE POLICY "admin_update_order_items"
  ON order_items FOR UPDATE
  USING (public.has_min_role(2))
  WITH CHECK (public.has_min_role(2));

-- ---------------------------------------------------------------------------
-- CUSTOMERS: read (VIEWER+), update (ADMIN+), delete (SUPER_ADMIN)
-- ---------------------------------------------------------------------------
CREATE POLICY "admin_read_all_customers"
  ON customers FOR SELECT USING (public.has_min_role(1));

CREATE POLICY "admin_update_customers"
  ON customers FOR UPDATE
  USING (public.has_min_role(3))
  WITH CHECK (public.has_min_role(3));

CREATE POLICY "admin_delete_customers"
  ON customers FOR DELETE USING (public.has_min_role(4));

-- ---------------------------------------------------------------------------
-- CUSTOMER ADDRESSES: read (VIEWER+)
-- ---------------------------------------------------------------------------
CREATE POLICY "admin_read_customer_addresses"
  ON customer_addresses FOR SELECT USING (public.has_min_role(1));

-- ---------------------------------------------------------------------------
-- INVENTORY MOVEMENTS: read (VIEWER+), write (MANAGER+)
-- ---------------------------------------------------------------------------
CREATE POLICY "admin_read_inventory_movements"
  ON inventory_movements FOR SELECT USING (public.has_min_role(1));

CREATE POLICY "admin_write_inventory_movements"
  ON inventory_movements FOR INSERT WITH CHECK (public.has_min_role(2));

-- ---------------------------------------------------------------------------
-- SETTINGS: read all (VIEWER+), write (ADMIN+), delete (SUPER_ADMIN)
-- ---------------------------------------------------------------------------
CREATE POLICY "admin_read_all_settings"
  ON settings FOR SELECT USING (public.has_min_role(1));

CREATE POLICY "admin_write_settings"
  ON settings FOR ALL
  USING (public.has_min_role(3))
  WITH CHECK (public.has_min_role(3));

-- ---------------------------------------------------------------------------
-- ADMIN USERS: read own record (VIEWER+), read all (ADMIN+), write (SUPER_ADMIN)
-- ---------------------------------------------------------------------------
CREATE POLICY "admin_users_read_own"
  ON admin_users
  FOR SELECT
  USING (auth.uid()::text = id);

CREATE POLICY "admin_users_read_all"
  ON admin_users
  FOR SELECT
  USING (public.has_min_role(3)); -- ADMIN+

CREATE POLICY "admin_users_write"
  ON admin_users
  FOR ALL
  USING (public.has_min_role(4))
  WITH CHECK (public.has_min_role(4)); -- SUPER_ADMIN only

-- ---------------------------------------------------------------------------
-- ADMIN SESSIONS: own record only (any admin)
-- ---------------------------------------------------------------------------
CREATE POLICY "admin_sessions_own"
  ON admin_sessions FOR ALL
  USING (auth.uid()::text = "adminUserId")
  WITH CHECK (auth.uid()::text = "adminUserId");

-- ---------------------------------------------------------------------------
-- ADMIN AUDIT LOGS: read (ADMIN+), no direct writes (service role only)
-- ---------------------------------------------------------------------------
CREATE POLICY "admin_read_audit_logs"
  ON admin_audit_logs FOR SELECT USING (public.has_min_role(3));

-- ---------------------------------------------------------------------------
-- WEBHOOK EVENTS: read (ADMIN+), no direct writes
-- ---------------------------------------------------------------------------
CREATE POLICY "admin_read_webhook_events"
  ON webhook_events FOR SELECT USING (public.has_min_role(3));

-- ---------------------------------------------------------------------------
-- PUSH SUBSCRIPTIONS: admin can read all (ADMIN+) for broadcast purposes
-- ---------------------------------------------------------------------------
CREATE POLICY "admin_read_push_subscriptions"
  ON push_subscriptions FOR SELECT USING (public.has_min_role(3));

-- ---------------------------------------------------------------------------
-- SET USER ROLE function — called by Edge Functions (service role)
-- Sets app_metadata.role on an auth.users record.
-- ⚠️ SECURITY DEFINER + GRANT to service_role only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_user_role(user_id UUID, new_role TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF new_role NOT IN ('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'VIEWER') THEN
    RAISE EXCEPTION 'Invalid role: %. Must be one of SUPER_ADMIN, ADMIN, MANAGER, VIEWER', new_role;
  END IF;

  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new_role)
  WHERE id = user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found in auth.users', user_id;
  END IF;
END;
$$;

-- Only service_role can call this function — never anon or authenticated roles
REVOKE EXECUTE ON FUNCTION set_user_role FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION set_user_role FROM authenticated;
REVOKE EXECUTE ON FUNCTION set_user_role FROM anon;
GRANT  EXECUTE ON FUNCTION set_user_role TO service_role;
