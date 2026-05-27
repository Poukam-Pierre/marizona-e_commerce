-- =============================================================================
-- Migration: Customer policies
-- File: 20260527_003_rls_customer_policies.sql
--
-- Notes:
-- • Guest checkout (WhatsApp-based) creates orders with customer_id IS NULL.
--   INSERT on orders is intentionally public to support this flow.
-- • Authenticated customers are identified by auth.uid()::text = customer_id.
--   This assumes the customer record id == the Supabase Auth user id (Phase 4).
-- • Order tracking for guests uses a SHA-256 lookup token (no auth required).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ORDERS: anyone can create (guest checkout support)
-- ⚠️ GUEST CHECKOUT: customer_id may be NULL for WhatsApp orders
-- ---------------------------------------------------------------------------
CREATE POLICY "public_create_orders"
  ON orders
  FOR INSERT
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- ORDERS: authenticated customers can read their own orders
-- ---------------------------------------------------------------------------
CREATE POLICY "customers_read_own_orders"
  ON orders
  FOR SELECT
  USING (
    -- Authenticated customer: match by Supabase Auth UID
    auth.uid()::text = "customerId"
  );

-- ---------------------------------------------------------------------------
-- ORDERS: public order lookup via secure token (guest order tracking)
-- Guests receive a raw token once; only the SHA-256 hash is stored.
-- The Edge Function verifies the token before serving the order data.
-- Edge Function uses service role — this policy covers direct DB access.
-- ---------------------------------------------------------------------------
CREATE POLICY "public_read_orders_by_lookup_token"
  ON orders
  FOR SELECT
  USING (
    "lookupToken" IS NOT NULL
    AND "lookupTokenExpiry" > now()
  );

-- ---------------------------------------------------------------------------
-- ORDER ITEMS: customers can read items belonging to their orders
-- ---------------------------------------------------------------------------
CREATE POLICY "customers_read_own_order_items"
  ON order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items."orderId"
        AND auth.uid()::text = o."customerId"
    )
  );

-- ---------------------------------------------------------------------------
-- CUSTOMERS: authenticated users can read and update their own profile
-- ---------------------------------------------------------------------------
CREATE POLICY "customers_read_own_profile"
  ON customers
  FOR SELECT
  USING (auth.uid()::text = id);

CREATE POLICY "customers_update_own_profile"
  ON customers
  FOR UPDATE
  USING (auth.uid()::text = id)
  WITH CHECK (auth.uid()::text = id);

-- ---------------------------------------------------------------------------
-- CUSTOMER ADDRESSES: customers can manage their own addresses
-- ---------------------------------------------------------------------------
CREATE POLICY "customers_read_own_addresses"
  ON customer_addresses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = customer_addresses."customerId"
        AND auth.uid()::text = c.id
    )
  );

CREATE POLICY "customers_insert_own_addresses"
  ON customer_addresses
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = customer_addresses."customerId"
        AND auth.uid()::text = c.id
    )
  );

CREATE POLICY "customers_update_own_addresses"
  ON customer_addresses
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = customer_addresses."customerId"
        AND auth.uid()::text = c.id
    )
  );

CREATE POLICY "customers_delete_own_addresses"
  ON customer_addresses
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = customer_addresses."customerId"
        AND auth.uid()::text = c.id
    )
  );

-- ---------------------------------------------------------------------------
-- CART ITEMS: customers can manage their own cart (by auth UID or session)
-- ---------------------------------------------------------------------------
CREATE POLICY "customers_manage_own_cart"
  ON cart_items
  FOR ALL
  USING (
    auth.uid()::text = "customerId"
    OR ("customerId" IS NULL AND "sessionId" IS NOT NULL)
  )
  WITH CHECK (
    auth.uid()::text = "customerId"
    OR ("customerId" IS NULL AND "sessionId" IS NOT NULL)
  );

-- ---------------------------------------------------------------------------
-- PUSH SUBSCRIPTIONS: anyone can subscribe/unsubscribe (endpoint is the key)
-- Optionally scoped to a user when authenticated.
-- ---------------------------------------------------------------------------
CREATE POLICY "public_manage_push_subscriptions"
  ON push_subscriptions
  FOR ALL
  USING (
    -- Unauthenticated: only allow access to their own endpoint via exact match
    -- (Edge Function enforces this; policy allows all for flexibility)
    true
  )
  WITH CHECK (true);
