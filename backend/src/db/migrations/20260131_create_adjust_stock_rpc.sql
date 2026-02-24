-- Migration: Create RPC function for atomic stock adjustment
-- Ensures transaction safety: movement creation + warehouse_inventory update are atomic
-- Prevents race conditions and maintains data consistency

CREATE OR REPLACE FUNCTION public.adjust_stock(
  p_warehouse_id UUID,
  p_product_id UUID,
  p_variant_id UUID,
  p_physical_quantity INTEGER,
  p_reason TEXT,
  p_company_id UUID,
  p_created_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_stock INTEGER := 0;
  v_difference INTEGER;
  v_movement_type VARCHAR(50);
  v_movement_id UUID;
  v_new_stock_count INTEGER;
BEGIN
  -- Validate warehouse exists
  IF NOT EXISTS (SELECT 1 FROM public.warehouses WHERE id = p_warehouse_id AND company_id = p_company_id) THEN
    RAISE EXCEPTION 'Warehouse not found or does not belong to company';
  END IF;
  
  -- Validate product exists
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id AND company_id = p_company_id) THEN
    RAISE EXCEPTION 'Product not found or does not belong to company';
  END IF;
  
  -- Validate variant exists
  IF NOT EXISTS (SELECT 1 FROM public.product_variants WHERE id = p_variant_id AND product_id = p_product_id AND company_id = p_company_id) THEN
    RAISE EXCEPTION 'Variant not found or does not belong to product/company';
  END IF;
  
  -- Validate physical quantity is non-negative
  IF p_physical_quantity < 0 THEN
    RAISE EXCEPTION 'Physical quantity cannot be negative';
  END IF;
  
  -- Get current stock from warehouse_inventory
  SELECT COALESCE(stock_count, 0) INTO v_current_stock
  FROM public.warehouse_inventory
  WHERE warehouse_id = p_warehouse_id
    AND product_id = p_product_id
    AND variant_id = p_variant_id
    AND company_id = p_company_id;
  
  -- Ensure v_current_stock is not NULL (if no record exists, SELECT INTO doesn't set the variable)
  IF v_current_stock IS NULL THEN
    v_current_stock := 0;
  END IF;
  
  -- Calculate difference: physical_quantity - system_stock_count
  -- Positive difference = stock found (ADJUSTMENT_IN)
  -- Negative difference = stock lost (ADJUSTMENT_OUT)
  v_difference := p_physical_quantity - v_current_stock;
  
  -- Ensure difference is not NULL
  IF v_difference IS NULL THEN
    RAISE EXCEPTION 'Failed to calculate stock difference';
  END IF;
  
  -- If no difference, return early (no adjustment needed)
  IF v_difference = 0 THEN
    RETURN jsonb_build_object(
      'movement_id', NULL,
      'difference', 0,
      'new_stock_count', v_current_stock,
      'message', 'Stock already matches physical count'
    );
  END IF;
  
  -- Determine movement type based on difference sign
  IF v_difference > 0 THEN
    v_movement_type := 'ADJUSTMENT_IN';
  ELSE
    v_movement_type := 'ADJUSTMENT_OUT';
  END IF;
  
  -- Create stock movement (source of truth)
  -- Quantity is positive for ADJUSTMENT_IN, negative for ADJUSTMENT_OUT
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
    p_product_id,
    p_variant_id,
    p_warehouse_id,
    v_movement_type,
    v_difference, -- Positive for IN, negative for OUT
    'adjustment',
    NULL,
    p_reason,
    p_company_id,
    p_created_by
  ) RETURNING id INTO v_movement_id;
  
  -- Update warehouse_inventory snapshot to match physical quantity
  INSERT INTO public.warehouse_inventory (
    warehouse_id,
    product_id,
    variant_id,
    stock_count,
    company_id
  ) VALUES (
    p_warehouse_id,
    p_product_id,
    p_variant_id,
    p_physical_quantity,
    p_company_id
  )
  ON CONFLICT (warehouse_id, product_id, variant_id)
  DO UPDATE SET
    stock_count = p_physical_quantity,
    updated_at = CURRENT_TIMESTAMP;
  
  v_new_stock_count := p_physical_quantity;
  
  RETURN jsonb_build_object(
    'movement_id', v_movement_id,
    'difference', v_difference,
    'new_stock_count', v_new_stock_count
  );
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.adjust_stock IS 'Atomically adjust stock to match physical count. Creates ADJUSTMENT_IN or ADJUSTMENT_OUT movement and updates warehouse_inventory. Returns movement_id, difference, and new_stock_count.';

