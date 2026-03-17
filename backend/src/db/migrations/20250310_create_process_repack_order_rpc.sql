-- Migration: Create process_repack_order RPC for atomic package breakdown
-- Validates recipes, creates REPACK_OUT and REPACK_IN movements, updates warehouse_inventory

CREATE OR REPLACE FUNCTION public.process_repack_order(
  p_repack_order_id UUID,
  p_company_id UUID,
  p_created_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_total_input NUMERIC;
  v_input_int INTEGER;
  v_current_stock INTEGER;
  v_recipe RECORD;
  v_input_variant_unit NUMERIC;
  v_movements JSONB := '[]'::JSONB;
BEGIN
  -- Validate repack order exists and is draft
  SELECT * INTO v_order
  FROM public.repack_orders
  WHERE id = p_repack_order_id
    AND company_id = p_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Repack order not found or does not belong to company';
  END IF;

  IF v_order.status != 'draft' THEN
    RAISE EXCEPTION 'Repack order status is %, cannot process. Only draft orders can be processed.', v_order.status;
  END IF;

  -- Aggregate total input per (input_product_id, input_variant_id) and validate stock
  FOR v_item IN (
    SELECT
      input_product_id,
      input_variant_id,
      SUM(input_quantity) AS total_input
    FROM public.repack_order_items
    WHERE repack_order_id = p_repack_order_id
    GROUP BY input_product_id, input_variant_id
  )
  LOOP
    v_total_input := v_item.total_input;
    v_input_int := ROUND(v_total_input)::INTEGER;

    IF v_input_int <= 0 THEN
      RAISE EXCEPTION 'Invalid total input quantity for variant %: %', v_item.input_variant_id, v_total_input;
    END IF;

    -- Allow fractional only when sum rounds to whole (e.g. 0.5+0.5=1)
    IF ABS(v_total_input - v_input_int) > 0.001 THEN
      RAISE EXCEPTION 'Total input quantity must be whole number for variant %. Got: %', v_item.input_variant_id, v_total_input;
    END IF;

    SELECT COALESCE(stock_count, 0) INTO v_current_stock
    FROM public.warehouse_inventory
    WHERE warehouse_id = v_order.warehouse_id
      AND product_id = v_item.input_product_id
      AND variant_id = v_item.input_variant_id
      AND company_id = p_company_id;

    IF COALESCE(v_current_stock, 0) < v_input_int THEN
      RAISE EXCEPTION 'Insufficient stock for input variant %. Available: %, Required: %',
        v_item.input_variant_id, COALESCE(v_current_stock, 0), v_input_int;
    END IF;
  END LOOP;

  -- Validate each item has matching recipe and create REPACK_OUT (aggregate)
  -- First: create REPACK_OUT for each unique input variant (one movement per variant)
  FOR v_item IN (
    SELECT
      input_product_id,
      input_variant_id,
      ROUND(SUM(input_quantity))::INTEGER AS total_input
    FROM public.repack_order_items
    WHERE repack_order_id = p_repack_order_id
    GROUP BY input_product_id, input_variant_id
  )
  LOOP
    INSERT INTO public.stock_movements (
      product_id,
      variant_id,
      outlet_id,
      movement_type,
      quantity,
      reference_type,
      reference_id,
      notes,
      company_id,
      created_by,
      source_type
    ) VALUES (
      v_item.input_product_id,
      v_item.input_variant_id,
      v_order.warehouse_id,
      'REPACK_OUT',
      -v_item.total_input,
      'repack_order',
      p_repack_order_id,
      'Package breakdown - input consumed',
      p_company_id,
      p_created_by,
      'repack'
    );

    UPDATE public.warehouse_inventory
    SET stock_count = stock_count - v_item.total_input,
        updated_at = CURRENT_TIMESTAMP
    WHERE warehouse_id = v_order.warehouse_id
      AND product_id = v_item.input_product_id
      AND variant_id = v_item.input_variant_id
      AND company_id = p_company_id;
  END LOOP;

  -- Create REPACK_IN for each item and update warehouse_inventory
  FOR v_item IN (
    SELECT roi.*
    FROM public.repack_order_items roi
    WHERE roi.repack_order_id = p_repack_order_id
  )
  LOOP
    -- Validate recipe exists
    SELECT * INTO v_recipe
    FROM public.packaging_recipes
    WHERE input_variant_id = v_item.input_variant_id
      AND output_variant_id = v_item.output_variant_id
      AND company_id = p_company_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No packaging recipe found for input variant % to output variant %',
        v_item.input_variant_id, v_item.output_variant_id;
    END IF;

    INSERT INTO public.stock_movements (
      product_id,
      variant_id,
      outlet_id,
      movement_type,
      quantity,
      reference_type,
      reference_id,
      notes,
      company_id,
      created_by,
      source_type
    ) VALUES (
      v_item.output_product_id,
      v_item.output_variant_id,
      v_order.warehouse_id,
      'REPACK_IN',
      v_item.output_quantity,
      'repack_order',
      p_repack_order_id,
      'Package breakdown - output produced',
      p_company_id,
      p_created_by,
      'repack'
    );

    INSERT INTO public.warehouse_inventory (
      warehouse_id,
      product_id,
      variant_id,
      stock_count,
      company_id
    ) VALUES (
      v_order.warehouse_id,
      v_item.output_product_id,
      v_item.output_variant_id,
      v_item.output_quantity,
      p_company_id
    )
    ON CONFLICT (warehouse_id, product_id, variant_id)
    DO UPDATE SET
      stock_count = warehouse_inventory.stock_count + v_item.output_quantity,
      updated_at = CURRENT_TIMESTAMP;
  END LOOP;

  -- Mark repack order as completed
  UPDATE public.repack_orders
  SET status = 'completed',
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_repack_order_id
    AND company_id = p_company_id;

  RETURN jsonb_build_object(
    'success', true,
    'repack_order_id', p_repack_order_id,
    'status', 'completed'
  );
END;
$$;

COMMENT ON FUNCTION public.process_repack_order IS 'Atomically process a draft repack order: create REPACK_OUT/REPACK_IN movements, update warehouse_inventory, set status to completed.';
