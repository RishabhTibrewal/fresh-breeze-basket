-- Migration: Create RPC function for atomic stock transfer to POS pool
-- Ensures transaction safety: both TRANSFER_OUT and POS_TRANSFER_IN movements, along with
-- pos_outlet_inventory and warehouse_inventory updates are created atomically

CREATE OR REPLACE FUNCTION public.transfer_to_pos_pool(
  p_warehouse_id UUID,
  p_items JSONB,              -- required
  p_company_id UUID,          -- required
  p_notes TEXT DEFAULT NULL,  -- optional
  p_created_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_transfer_id UUID := gen_random_uuid();
  v_item JSONB;
  v_product_id UUID;
  v_variant_id UUID;
  v_quantity INTEGER;
  v_source_stock INTEGER;
  v_out_movement_id UUID;
  v_in_movement_id UUID;
  v_movements JSONB := '[]'::JSONB;
BEGIN
  -- Validate warehouse exists
  IF NOT EXISTS (SELECT 1 FROM public.warehouses WHERE id = p_warehouse_id AND company_id = p_company_id) THEN
    RAISE EXCEPTION 'Warehouse not found or does not belong to company';
  END IF;
  
  -- Validate items array is not empty
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Items array cannot be empty';
  END IF;
  
  -- Process each item in the transfer
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_variant_id := (v_item->>'variant_id')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;
    
    -- Validate quantity > 0
    IF COALESCE(v_quantity, 0) <= 0 THEN
      RAISE EXCEPTION 'Transfer quantity must be greater than 0';
    END IF;
    
    -- Validate product exists
    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = v_product_id AND company_id = p_company_id) THEN
      RAISE EXCEPTION 'Product % not found or does not belong to company', v_product_id;
    END IF;
    
    -- Validate variant exists
    IF NOT EXISTS (SELECT 1 FROM public.product_variants WHERE id = v_variant_id AND product_id = v_product_id AND company_id = p_company_id) THEN
      RAISE EXCEPTION 'Variant % not found or does not belong to product/company', v_variant_id;
    END IF;
    
    -- Check global stock (prevent negative stock)
    SELECT COALESCE(stock_count, 0) INTO v_source_stock
    FROM public.warehouse_inventory
    WHERE warehouse_id = p_warehouse_id
      AND product_id = v_product_id
      AND variant_id = v_variant_id
      AND company_id = p_company_id;
    
    IF COALESCE(v_source_stock, 0) < v_quantity THEN
      RAISE EXCEPTION 'Insufficient global stock for variant %. Available: %, Requested: %', v_variant_id, COALESCE(v_source_stock, 0), v_quantity;
    END IF;
    
    -- Create TRANSFER_OUT movement (negative quantity)
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
      v_product_id,
      v_variant_id,
      p_warehouse_id,
      'TRANSFER',
      -v_quantity, -- Negative for OUT
      'pos_transfer',
      v_transfer_id,
      COALESCE(p_notes, 'POS pool transfer to outlet ' || p_warehouse_id),
      p_company_id,
      p_created_by,
      'pos_transfer'
    ) RETURNING id INTO v_out_movement_id;
    
    -- Create POS_TRANSFER_IN movement (positive quantity)
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
      v_product_id,
      v_variant_id,
      p_warehouse_id,
      'POS_TRANSFER_IN',
      v_quantity, -- Positive for IN
      'pos_transfer',
      v_transfer_id,
      COALESCE(p_notes, 'POS pool transfer in for outlet ' || p_warehouse_id),
      p_company_id,
      p_created_by,
      'pos_transfer'
    ) RETURNING id INTO v_in_movement_id;
    
    -- Update warehouse_inventory (decrease global stock)
    UPDATE public.warehouse_inventory
    SET stock_count = stock_count - v_quantity,
        updated_at = CURRENT_TIMESTAMP
    WHERE warehouse_id = p_warehouse_id
      AND product_id = v_product_id
      AND variant_id = v_variant_id
      AND company_id = p_company_id;
    
    -- Update pos_outlet_inventory (increase POS pool stock, UPSERT if not exists)
    INSERT INTO public.pos_outlet_inventory (
      company_id,
      warehouse_id,
      product_id,
      variant_id,
      qty
    ) VALUES (
      p_company_id,
      p_warehouse_id,
      v_product_id,
      v_variant_id,
      v_quantity
    )
    ON CONFLICT (company_id, warehouse_id, variant_id)
    DO UPDATE SET
      qty = COALESCE(public.pos_outlet_inventory.qty, 0) + EXCLUDED.qty,
      updated_at = CURRENT_TIMESTAMP;
    
    -- Track movements for response
    v_movements := v_movements || jsonb_build_object(
      'product_id', v_product_id,
      'variant_id', v_variant_id,
      'quantity', v_quantity,
      'transfer_out_id', v_out_movement_id,
      'transfer_in_id', v_in_movement_id
    );
  END LOOP;
  
  RETURN jsonb_build_object(
    'transfer_id', v_transfer_id,
    'movements', v_movements
  );
END;
$$;

COMMENT ON FUNCTION public.transfer_to_pos_pool IS 'Atomically transfer stock from global warehouse inventory to the POS outlet pool.';
