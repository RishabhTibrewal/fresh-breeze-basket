-- Migration: Create RPC function for atomic stock transfer between warehouses
-- Ensures transaction safety: both TRANSFER_OUT and TRANSFER_IN movements are created atomically
-- Prevents partial transfers and maintains data consistency

CREATE OR REPLACE FUNCTION public.transfer_stock(
  p_source_warehouse_id UUID,
  p_destination_warehouse_id UUID,
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
  -- Validate source ≠ destination
  IF p_source_warehouse_id = p_destination_warehouse_id THEN
    RAISE EXCEPTION 'Source and destination warehouses cannot be the same';
  END IF;
  
  -- Validate source warehouse exists
  IF NOT EXISTS (SELECT 1 FROM public.warehouses WHERE id = p_source_warehouse_id AND company_id = p_company_id) THEN
    RAISE EXCEPTION 'Source warehouse not found or does not belong to company';
  END IF;
  
  -- Validate destination warehouse exists
  IF NOT EXISTS (SELECT 1 FROM public.warehouses WHERE id = p_destination_warehouse_id AND company_id = p_company_id) THEN
    RAISE EXCEPTION 'Destination warehouse not found or does not belong to company';
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
    IF v_quantity <= 0 THEN
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
    
    -- Check source stock (prevent negative stock)
    SELECT COALESCE(stock_count, 0) INTO v_source_stock
    FROM public.warehouse_inventory
    WHERE warehouse_id = p_source_warehouse_id
      AND product_id = v_product_id
      AND variant_id = v_variant_id
      AND company_id = p_company_id;
    
    IF v_source_stock < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock in source warehouse. Available: %, Requested: %', v_source_stock, v_quantity;
    END IF;
    
    -- Create TRANSFER_OUT movement (negative quantity) for source warehouse
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
      created_by
    ) VALUES (
      v_product_id,
      v_variant_id,
      p_source_warehouse_id,
      'TRANSFER',
      -v_quantity, -- Negative for OUT
      'transfer',
      v_transfer_id,
      COALESCE(p_notes, 'Stock transfer'),
      p_company_id,
      p_created_by
    ) RETURNING id INTO v_out_movement_id;
    
    -- Create TRANSFER_IN movement (positive quantity) for destination warehouse
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
      created_by
    ) VALUES (
      v_product_id,
      v_variant_id,
      p_destination_warehouse_id,
      'TRANSFER',
      v_quantity, -- Positive for IN
      'transfer',
      v_transfer_id,
      COALESCE(p_notes, 'Stock transfer'),
      p_company_id,
      p_created_by
    ) RETURNING id INTO v_in_movement_id;
    
    -- Update source warehouse_inventory (decrease stock)
    UPDATE public.warehouse_inventory
    SET stock_count = stock_count - v_quantity,
        updated_at = CURRENT_TIMESTAMP
    WHERE warehouse_id = p_source_warehouse_id
      AND product_id = v_product_id
      AND variant_id = v_variant_id
      AND company_id = p_company_id;
    
    -- Update destination warehouse_inventory (increase stock, UPSERT if not exists)
    INSERT INTO public.warehouse_inventory (
      warehouse_id,
      product_id,
      variant_id,
      stock_count,
      company_id
    ) VALUES (
      p_destination_warehouse_id,
      v_product_id,
      v_variant_id,
      v_quantity, -- Initial stock if new record
      p_company_id
    )
    ON CONFLICT (warehouse_id, product_id, variant_id)
    DO UPDATE SET
      stock_count = warehouse_inventory.stock_count + v_quantity,
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

-- Add comment
COMMENT ON FUNCTION public.transfer_stock IS 'Atomically transfer stock between warehouses. Creates TRANSFER_OUT (source) and TRANSFER_IN (destination) movements with shared reference_id. Prevents negative stock and ensures both movements are created atomically.';

