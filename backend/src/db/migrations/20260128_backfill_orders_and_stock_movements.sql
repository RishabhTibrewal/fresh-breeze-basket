-- Migration: Backfill existing data
-- 1. Ensure all orders have order_type, industry_context, and outlet_id
-- 2. Create initial stock_movements records from warehouse_inventory.stock_count

-- Step 1: Ensure all orders have required fields (redundant but safe)
UPDATE public.orders 
SET order_type = 'SALE', industry_context = 'retail' 
WHERE order_type IS NULL OR industry_context IS NULL;

-- Step 2: Set outlet_id for orders that still don't have it
UPDATE public.orders o
SET outlet_id = (
  SELECT w.id 
  FROM public.warehouses w 
  WHERE w.company_id = o.company_id 
    AND w.is_active = true 
  ORDER BY w.created_at ASC 
  LIMIT 1
)
WHERE o.outlet_id IS NULL;

-- Step 3: Create initial stock_movements from warehouse_inventory
-- This creates a RECEIPT movement for existing stock_count
-- Only create movements for non-zero stock to avoid cluttering the table
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
  created_at
)
SELECT 
  wi.product_id,
  NULL as variant_id, -- No variants in existing data
  wi.warehouse_id as outlet_id,
  'RECEIPT' as movement_type,
  wi.stock_count as quantity,
  'initial_migration' as reference_type,
  NULL as reference_id,
  'Initial stock from warehouse_inventory migration' as notes,
  wi.company_id,
  wi.created_at
FROM public.warehouse_inventory wi
WHERE wi.stock_count > 0
  AND NOT EXISTS (
    -- Avoid duplicates if migration runs multiple times
    SELECT 1 FROM public.stock_movements sm
    WHERE sm.product_id = wi.product_id
      AND sm.outlet_id = wi.warehouse_id
      AND sm.reference_type = 'initial_migration'
  );

-- Step 4: Create stock movements for reserved stock
-- Reserved stock represents pending orders, so we create SALE movements
-- Note: This is a simplified approach - in production, you might want to link to actual orders
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
  created_at
)
SELECT 
  wi.product_id,
  NULL as variant_id,
  wi.warehouse_id as outlet_id,
  'SALE' as movement_type,
  -wi.reserved_stock as quantity, -- Negative because it reduces available stock
  'reserved_stock' as reference_type,
  NULL as reference_id,
  'Reserved stock from warehouse_inventory migration' as notes,
  wi.company_id,
  wi.updated_at
FROM public.warehouse_inventory wi
WHERE wi.reserved_stock > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.stock_movements sm
    WHERE sm.product_id = wi.product_id
      AND sm.outlet_id = wi.warehouse_id
      AND sm.reference_type = 'reserved_stock'
  );

-- Step 5: Create stock movements from order_items for completed orders
-- This creates SALE movements for orders that have been processed
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
  created_at
)
SELECT 
  oi.product_id,
  oi.variant_id,
  COALESCE(oi.warehouse_id, o.outlet_id) as outlet_id,
  CASE 
    WHEN o.order_type = 'RETURN' THEN 'RETURN'
    ELSE 'SALE'
  END as movement_type,
  CASE 
    WHEN o.order_type = 'RETURN' THEN oi.quantity -- Positive for returns
    ELSE -oi.quantity -- Negative for sales
  END as quantity,
  'order' as reference_type,
  oi.order_id as reference_id,
  CONCAT('Order ', o.id, ' - ', o.order_type) as notes,
  oi.company_id,
  o.created_at
FROM public.order_items oi
INNER JOIN public.orders o ON oi.order_id = o.id
WHERE o.status IN ('processing', 'shipped', 'delivered')
  AND o.inventory_updated = true
  AND NOT EXISTS (
    SELECT 1 FROM public.stock_movements sm
    WHERE sm.reference_type = 'order'
      AND sm.reference_id = oi.order_id
      AND sm.product_id = oi.product_id
  );

-- Add comment
COMMENT ON TABLE public.stock_movements IS 'Backfilled from existing warehouse_inventory and orders data';

