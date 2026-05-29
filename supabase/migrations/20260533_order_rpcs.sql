-- ============================================================================
-- Migration: 20260533_order_rpcs.sql
--
-- Creates two SECURITY DEFINER functions used by Edge Functions:
--
--   1. create_order_atomic(order_payload JSONB)
--      Atomically inserts order + order_items, decrements inventory,
--      logs inventory_movements, and returns an order summary JSONB.
--      Called by: checkout-create-order Edge Function (service_role).
--
--   2. process_download(p_order_id TEXT, p_item_id TEXT, p_token_hash TEXT)
--      Validates token, checks eligibility (paid, not expired, not over limit),
--      increments download_count, and returns the download URL.
--      Called by: orders-download-item Edge Function (service_role).
--
-- NOTE: All column names are camelCase (Prisma default for PostgreSQL).
--       Enum casts use the Prisma-generated type names.
-- ============================================================================

-- ============================================================================
-- 1.  create_order_atomic
-- ============================================================================

CREATE OR REPLACE FUNCTION create_order_atomic(order_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id        TEXT;
  v_order_number    TEXT;
  v_item            JSONB;

  -- product fields
  v_product_id          TEXT;
  v_product_sku         TEXT;
  v_product_name        TEXT;
  v_product_image       TEXT;
  v_product_type        "ProductType";
  v_product_price       NUMERIC;
  v_product_inv_qty     INT;
  v_product_inv_tracked BOOLEAN;
  v_product_dl_url      TEXT;
  v_product_dl_limit    INT;
  v_product_dl_expiry   INT;

  -- variant fields (optional)
  v_variant_id    TEXT;
  v_variant_name  TEXT;
  v_variant_price NUMERIC;
  v_variant_inv   INT;

  -- working vars
  v_item_price    NUMERIC;
  v_item_qty      INT;
  v_item_total    NUMERIC;
  v_subtotal      NUMERIC := 0;
  v_shipping_cost NUMERIC;
  v_prev_stock    INT;
  v_result        JSONB;
BEGIN
  -- -------------------------------------------------------------------------
  -- Generate sequential order number: ORD-YYYYMMDD-NNNN
  -- -------------------------------------------------------------------------
  SELECT
    'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
    LPAD(
      (COUNT(*) FILTER (WHERE DATE("createdAt") = CURRENT_DATE) + 1)::TEXT,
      4, '0'
    )
  INTO v_order_number
  FROM orders;

  v_shipping_cost := COALESCE((order_payload->>'shippingCost')::NUMERIC, 0);

  -- -------------------------------------------------------------------------
  -- Insert order skeleton (totals updated at the end)
  -- -------------------------------------------------------------------------
  INSERT INTO orders (
    "orderNumber",
    "customerId",
    "customerName",
    "customerEmail",
    "customerPhone",
    "customerWhatsapp",
    "shippingName",
    "shippingPhone",
    "shippingAddress",
    "shippingCity",
    "shippingProvince",
    "shippingPostalCode",
    "shippingCountry",
    subtotal,
    discount,
    "shippingCost",
    tax,
    total,
    currency,
    status,
    "paymentStatus",
    "paymentMethod",
    "customerNotes",
    "lookupToken",
    "lookupTokenExpiry"
  )
  VALUES (
    v_order_number,
    (order_payload->>'customerId')::TEXT,
    (order_payload->>'customerName')::TEXT,
    (order_payload->>'customerEmail')::TEXT,
    (order_payload->>'customerPhone')::TEXT,
    (order_payload->>'customerWhatsapp')::TEXT,
    (order_payload->>'shippingName')::TEXT,
    (order_payload->>'shippingPhone')::TEXT,
    (order_payload->>'shippingAddress')::TEXT,
    (order_payload->>'shippingCity')::TEXT,
    (order_payload->>'shippingProvince')::TEXT,
    (order_payload->>'shippingPostalCode')::TEXT,
    COALESCE((order_payload->>'shippingCountry')::TEXT, 'Cameroon'),
    0,  -- subtotal: updated below
    COALESCE((order_payload->>'discount')::NUMERIC, 0),
    v_shipping_cost,
    COALESCE((order_payload->>'tax')::NUMERIC, 0),
    0,  -- total: updated below
    COALESCE((order_payload->>'currency')::TEXT, 'XAF'),
    'PENDING'::"OrderStatus",
    'PENDING'::"PaymentStatus",
    'WHATSAPP'::"PaymentMethod",
    (order_payload->>'customerNotes')::TEXT,
    (order_payload->>'lookupToken')::TEXT,
    (order_payload->>'lookupTokenExpiry')::TIMESTAMPTZ
  )
  RETURNING id INTO v_order_id;

  -- -------------------------------------------------------------------------
  -- Process each cart item
  -- -------------------------------------------------------------------------
  FOR v_item IN SELECT * FROM jsonb_array_elements(order_payload->'items')
  LOOP
    v_item_qty := (v_item->>'quantity')::INT;

    -- Fetch and validate product
    SELECT
      id,  sku,  name,  image,  type,  price,
      "inventoryQuantity",  "inventoryTracked",
      "downloadUrl",  "downloadLimit",  "downloadExpiry"
    INTO
      v_product_id,  v_product_sku,  v_product_name,  v_product_image,
      v_product_type,  v_product_price,
      v_product_inv_qty,  v_product_inv_tracked,
      v_product_dl_url,  v_product_dl_limit,  v_product_dl_expiry
    FROM products
    WHERE id = (v_item->>'productId')::TEXT
      AND "deletedAt" IS NULL
      AND "isActive" = TRUE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found or inactive', (v_item->>'productId')::TEXT;
    END IF;

    v_item_price   := v_product_price;
    v_variant_id   := NULL;
    v_variant_name := NULL;

    -- -----------------------------------------------------------------------
    -- Variant handling
    -- -----------------------------------------------------------------------
    IF (v_item->>'variantId') IS NOT NULL THEN
      v_variant_id := (v_item->>'variantId')::TEXT;

      SELECT name, price, "inventoryQuantity"
      INTO   v_variant_name, v_variant_price, v_variant_inv
      FROM   product_variants
      WHERE  id = v_variant_id
        AND  "productId" = v_product_id
        AND  "isActive"  = TRUE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Variant % not found or inactive', v_variant_id;
      END IF;

      v_item_price := v_variant_price;

      -- Variant inventory
      IF v_product_type = 'PHYSICAL'::"ProductType" AND v_product_inv_tracked THEN
        IF v_variant_inv < v_item_qty THEN
          RAISE EXCEPTION 'Insufficient stock for variant %', v_variant_name;
        END IF;

        UPDATE product_variants
        SET    "inventoryQuantity" = "inventoryQuantity" - v_item_qty
        WHERE  id = v_variant_id;
      END IF;

    ELSIF v_product_type = 'PHYSICAL'::"ProductType" AND v_product_inv_tracked THEN
      -- Product-level stock check (no variant)
      IF v_product_inv_qty < v_item_qty THEN
        RAISE EXCEPTION 'Insufficient stock for %. Available: %',
          v_product_name, v_product_inv_qty;
      END IF;
    END IF;

    v_item_total := v_item_price * v_item_qty;
    v_subtotal   := v_subtotal + v_item_total;

    -- -----------------------------------------------------------------------
    -- Insert order item with price/download snapshot
    -- -----------------------------------------------------------------------
    INSERT INTO order_items (
      "orderId",
      "productId",
      "productSku",
      "productName",
      "productImage",
      "variantId",
      "variantName",
      "unitPrice",
      "totalPrice",
      quantity,
      "downloadUrl",
      "downloadLimit",
      "downloadExpiry",
      "productType"
    )
    VALUES (
      v_order_id,
      v_product_id,
      v_product_sku,
      v_product_name,
      v_product_image,
      v_variant_id,
      v_variant_name,
      v_item_price,
      v_item_total,
      v_item_qty,
      v_product_dl_url,
      v_product_dl_limit,
      CASE
        WHEN v_product_dl_expiry IS NOT NULL
        THEN NOW() + (v_product_dl_expiry || ' days')::INTERVAL
        ELSE NULL
      END,
      v_product_type
    );

    -- -----------------------------------------------------------------------
    -- Product-level inventory decrement + audit log
    -- -----------------------------------------------------------------------
    IF v_product_type = 'PHYSICAL'::"ProductType" AND v_product_inv_tracked THEN
      v_prev_stock := v_product_inv_qty;

      UPDATE products
      SET    "inventoryQuantity" = "inventoryQuantity" - v_item_qty
      WHERE  id = v_product_id;

      INSERT INTO inventory_movements (
        "productId",
        "variantId",
        type,
        quantity,
        reason,
        "previousStock",
        "newStock"
      )
      VALUES (
        v_product_id,
        v_variant_id,
        'SALE'::"MovementType",
        v_item_qty,
        'Order ' || v_order_number,
        v_prev_stock,
        v_prev_stock - v_item_qty
      );
    END IF;
  END LOOP;

  -- -------------------------------------------------------------------------
  -- Update final totals
  -- -------------------------------------------------------------------------
  UPDATE orders
  SET subtotal = v_subtotal,
      total    = v_subtotal
                 + v_shipping_cost
                 + COALESCE((order_payload->>'tax')::NUMERIC,      0)
                 - COALESCE((order_payload->>'discount')::NUMERIC, 0)
  WHERE id = v_order_id;

  -- -------------------------------------------------------------------------
  -- Return order summary (raw token is NOT returned — caller adds it)
  -- -------------------------------------------------------------------------
  SELECT jsonb_build_object(
    'id',            o.id,
    'orderNumber',   o."orderNumber",
    'subtotal',      o.subtotal,
    'shippingCost',  o."shippingCost",
    'total',         o.total,
    'status',        o.status,
    'paymentStatus', o."paymentStatus",
    'currency',      o.currency,
    'createdAt',     o."createdAt"
  )
  INTO v_result
  FROM orders o
  WHERE o.id = v_order_id;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Raise with the original message so the Edge Function can forward it
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION create_order_atomic(JSONB) TO service_role;
REVOKE EXECUTE ON FUNCTION create_order_atomic(JSONB) FROM PUBLIC;

-- ============================================================================
-- 2.  process_download
-- ============================================================================

CREATE OR REPLACE FUNCTION process_download(
  p_order_id   TEXT,
  p_item_id    TEXT,
  p_token_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_status         "OrderStatus";
  v_order_payment_status "PaymentStatus";
  v_item_type            "ProductType";
  v_item_dl_url          TEXT;
  v_item_dl_limit        INT;
  v_item_dl_count        INT;
  v_item_dl_expiry       TIMESTAMPTZ;
BEGIN
  -- Validate order + token + expiry
  SELECT status, "paymentStatus"
  INTO   v_order_status, v_order_payment_status
  FROM   orders
  WHERE  id             = p_order_id
    AND  "lookupToken"  = p_token_hash
    AND  ("lookupTokenExpiry" IS NULL OR "lookupTokenExpiry" > NOW());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Fetch item
  SELECT "productType", "downloadUrl", "downloadLimit", "downloadCount", "downloadExpiry"
  INTO   v_item_type, v_item_dl_url, v_item_dl_limit, v_item_dl_count, v_item_dl_expiry
  FROM   order_items
  WHERE  id       = p_item_id
    AND  "orderId" = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order item not found';
  END IF;

  -- Must be a digital item
  IF v_item_type != 'DIGITAL'::"ProductType" THEN
    RAISE EXCEPTION 'Item is not a digital product';
  END IF;

  -- Order must not be cancelled or refunded
  IF v_order_status IN ('CANCELLED'::"OrderStatus", 'REFUNDED'::"OrderStatus") THEN
    RAISE EXCEPTION 'ORDER_CANCELLED';
  END IF;

  -- Payment must be confirmed
  IF v_order_payment_status != 'PAID'::"PaymentStatus" THEN
    RAISE EXCEPTION 'NOT_PAID';
  END IF;

  -- Check link expiry
  IF v_item_dl_expiry IS NOT NULL AND v_item_dl_expiry < NOW() THEN
    RAISE EXCEPTION 'LINK_EXPIRED';
  END IF;

  -- Check download count limit
  IF v_item_dl_limit IS NOT NULL AND v_item_dl_count >= v_item_dl_limit THEN
    RAISE EXCEPTION 'LIMIT_REACHED';
  END IF;

  -- URL must be configured
  IF v_item_dl_url IS NULL THEN
    RAISE EXCEPTION 'No download URL configured for this item';
  END IF;

  -- Atomic download count increment
  UPDATE order_items
  SET    "downloadCount" = "downloadCount" + 1
  WHERE  id = p_item_id;

  RETURN jsonb_build_object('download_url', v_item_dl_url);

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION process_download(TEXT, TEXT, TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION process_download(TEXT, TEXT, TEXT) FROM PUBLIC;
