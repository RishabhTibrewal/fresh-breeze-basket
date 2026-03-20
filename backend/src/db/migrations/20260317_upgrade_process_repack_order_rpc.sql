-- Migration: Upgrade process_repack_order RPC with full pricing formula
-- Adds: wastage tracking, unit cost computation, and weighted-average product_prices update

CREATE OR REPLACE FUNCTION public.process_repack_order(
  p_repack_order_id UUID,
  p_company_id      UUID,
  p_created_by      UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_order           RECORD;
  v_item            RECORD;
  v_input_variant   RECORD;
  v_input_price     NUMERIC;
  v_current_stock   NUMERIC;
  v_usable          NUMERIC;
  v_actual_wastage  NUMERIC;
  v_total_raw_cost  NUMERIC;
  v_base_cost       NUMERIC;
  v_final_unit_cost NUMERIC;
  v_existing_stock  NUMERIC;
  v_old_price       NUMERIC;
  v_new_price       NUMERIC;
  v_summary         JSONB := '[]'::JSONB;
BEGIN
  -- ── 1. Validate order ─────────────────────────────────────────────────────
  SELECT * INTO v_order
  FROM public.repack_orders
  WHERE id = p_repack_order_id
    AND company_id = p_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Repack order not found or does not belong to company';
  END IF;

  IF v_order.status NOT IN ('draft', 'confirmed') THEN
    RAISE EXCEPTION 'Repack order status is %, cannot process. Only draft/confirmed orders can be processed.', v_order.status;
  END IF;

  -- ── 2. Process each item ──────────────────────────────────────────────────
  FOR v_item IN (
    SELECT roi.*
    FROM public.repack_order_items roi
    WHERE roi.repack_order_id = p_repack_order_id
  )
  LOOP
    -- Fetch input variant metadata (unit = capacity per bag)
    SELECT pv.unit
    INTO v_input_variant
    FROM public.product_variants pv
    WHERE pv.id = v_item.input_variant_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Input variant % not found', v_item.input_variant_id;
    END IF;

    -- Fetch input variant sale price (standard price, no outlet)
    SELECT pp.sale_price INTO v_input_price
    FROM public.product_prices pp
    WHERE pp.variant_id = v_item.input_variant_id
      AND pp.price_type = 'standard'
      AND pp.outlet_id IS NULL
    LIMIT 1;

    IF v_input_price IS NULL THEN
      v_input_price := 0;
    END IF;

    -- ── 2a. Validate input stock ──────────────────────────────────────────
    SELECT COALESCE(stock_count, 0) INTO v_current_stock
    FROM public.warehouse_inventory
    WHERE warehouse_id = v_order.warehouse_id
      AND product_id   = v_item.input_product_id
      AND variant_id   = v_item.input_variant_id
      AND company_id   = p_company_id;

    IF COALESCE(v_current_stock, 0) < v_item.input_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for input variant %. Available: %, Required: %',
        v_item.input_variant_id, COALESCE(v_current_stock, 0), v_item.input_quantity;
    END IF;

    -- ── 2b. Price calculation ─────────────────────────────────────────────
    v_total_raw_cost := v_item.input_quantity * v_input_price;

    IF v_item.output_quantity > 0 THEN
      v_base_cost := v_total_raw_cost / v_item.output_quantity;
    ELSE
      v_base_cost := 0;
    END IF;

    v_final_unit_cost := v_base_cost + COALESCE(v_item.additional_cost_per_unit, 0);

    -- Update item with computed unit_cost
    UPDATE public.repack_order_items
    SET unit_cost = v_final_unit_cost
    WHERE id = v_item.id;

    -- ── 2c. REPACK_OUT: Deduct input stock ────────────────────────────────
    INSERT INTO public.stock_movements (
      product_id, variant_id, outlet_id,
      movement_type, quantity,
      reference_type, reference_id, notes,
      company_id, created_by, source_type
    ) VALUES (
      v_item.input_product_id, v_item.input_variant_id, v_order.warehouse_id,
      'REPACK_OUT', -v_item.input_quantity,
      'repack_order', p_repack_order_id,
      format('Repack: deducted %s units of input variant', v_item.input_quantity),
      p_company_id, p_created_by, 'repack'
    );

    UPDATE public.warehouse_inventory
    SET stock_count = stock_count - v_item.input_quantity,
        updated_at  = CURRENT_TIMESTAMP
    WHERE warehouse_id = v_order.warehouse_id
      AND product_id   = v_item.input_product_id
      AND variant_id   = v_item.input_variant_id
      AND company_id   = p_company_id;

    -- ── 2d. REPACK_IN: Add output stock ───────────────────────────────────
    -- Fetch existing output stock first (for weighted-average calculation)
    SELECT COALESCE(stock_count, 0) INTO v_existing_stock
    FROM public.warehouse_inventory
    WHERE warehouse_id = v_order.warehouse_id
      AND product_id   = v_item.output_product_id
      AND variant_id   = v_item.output_variant_id
      AND company_id   = p_company_id;

    INSERT INTO public.stock_movements (
      product_id, variant_id, outlet_id,
      movement_type, quantity,
      reference_type, reference_id, notes,
      company_id, created_by, source_type
    ) VALUES (
      v_item.output_product_id, v_item.output_variant_id, v_order.warehouse_id,
      'REPACK_IN', v_item.output_quantity,
      'repack_order', p_repack_order_id,
      format('Repack: produced %s output units @ cost %s', v_item.output_quantity, ROUND(v_final_unit_cost, 4)),
      p_company_id, p_created_by, 'repack'
    );

    -- Upsert output warehouse_inventory
    INSERT INTO public.warehouse_inventory (
      warehouse_id, product_id, variant_id, stock_count, company_id
    ) VALUES (
      v_order.warehouse_id, v_item.output_product_id, v_item.output_variant_id,
      v_item.output_quantity, p_company_id
    )
    ON CONFLICT (warehouse_id, product_id, variant_id)
    DO UPDATE SET
      stock_count = warehouse_inventory.stock_count + v_item.output_quantity,
      updated_at  = CURRENT_TIMESTAMP;

    -- ── 2e. Weighted-average price update ─────────────────────────────────
    SELECT pp.sale_price INTO v_old_price
    FROM public.product_prices pp
    WHERE pp.variant_id  = v_item.output_variant_id
      AND pp.price_type  = 'standard'
      AND pp.outlet_id IS NULL
    LIMIT 1;

    IF v_old_price IS NOT NULL AND v_final_unit_cost > 0 THEN
      v_existing_stock := COALESCE(v_existing_stock, 0);
      IF (v_existing_stock + v_item.output_quantity) > 0 THEN
        v_new_price := ((v_existing_stock * v_old_price) + (v_item.output_quantity * v_final_unit_cost))
                       / (v_existing_stock + v_item.output_quantity);
      ELSE
        v_new_price := v_final_unit_cost;
      END IF;

      UPDATE public.product_prices
      SET sale_price  = ROUND(v_new_price::NUMERIC, 4),
          updated_at  = CURRENT_TIMESTAMP
      WHERE variant_id = v_item.output_variant_id
        AND price_type = 'standard'
        AND outlet_id IS NULL;
    ELSIF v_final_unit_cost > 0 THEN
      -- No existing price: set directly
      UPDATE public.product_prices
      SET sale_price  = ROUND(v_final_unit_cost::NUMERIC, 4),
          updated_at  = CURRENT_TIMESTAMP
      WHERE variant_id = v_item.output_variant_id
        AND price_type = 'standard'
        AND outlet_id IS NULL;
    END IF;

    -- Accumulate summary
    v_summary := v_summary || jsonb_build_object(
      'item_id',          v_item.id,
      'input_quantity',   v_item.input_quantity,
      'output_quantity',  v_item.output_quantity,
      'wastage_quantity', v_item.wastage_quantity,
      'final_unit_cost',  ROUND(v_final_unit_cost::NUMERIC, 4)
    );
  END LOOP;

  -- ── 3. Mark order completed ───────────────────────────────────────────────
  UPDATE public.repack_orders
  SET status = 'completed', updated_at = CURRENT_TIMESTAMP
  WHERE id = p_repack_order_id AND company_id = p_company_id;

  RETURN jsonb_build_object(
    'success',          true,
    'repack_order_id',  p_repack_order_id,
    'status',           'completed',
    'items',            v_summary
  );
END;
$$;

COMMENT ON FUNCTION public.process_repack_order IS
  'v2: Atomically process a repack order. Computes unit cost, deducts input stock (REPACK_OUT), adds output stock (REPACK_IN), and updates product_prices with weighted-average cost.';
