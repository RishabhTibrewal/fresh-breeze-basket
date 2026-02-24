-- Migration: Backfill variant_id in warehouse_inventory
-- Every warehouse_inventory entry must reference a variant (DEFAULT variant)
-- This migration links existing warehouse_inventory rows to DEFAULT variants

-- Step 1: Update warehouse_inventory rows that don't have variant_id
-- Link them to the DEFAULT variant for each product
UPDATE public.warehouse_inventory wi
SET variant_id = (
  SELECT pv.id
  FROM public.product_variants pv
  WHERE pv.product_id = wi.product_id
  AND pv.company_id = wi.company_id
  AND pv.is_default = true
  LIMIT 1
)
WHERE wi.variant_id IS NULL;

-- Step 2: Handle duplicate rows (same warehouse + product but different variant_id)
-- Merge stock_count and reserved_stock, then delete duplicates
-- Keep the row with the DEFAULT variant
WITH duplicates AS (
  SELECT 
    warehouse_id,
    product_id,
    company_id,
    SUM(stock_count) as total_stock_count,
    SUM(reserved_stock) as total_reserved_stock,
    MAX(updated_at) as latest_updated_at
  FROM public.warehouse_inventory
  WHERE variant_id IS NOT NULL
  GROUP BY warehouse_id, product_id, company_id
  HAVING COUNT(*) > 1
),
default_variants AS (
  SELECT DISTINCT ON (pv.product_id, pv.company_id)
    pv.id as variant_id,
    pv.product_id,
    pv.company_id
  FROM public.product_variants pv
  WHERE pv.is_default = true
)
DELETE FROM public.warehouse_inventory wi
WHERE EXISTS (
  SELECT 1
  FROM duplicates d
  JOIN default_variants dv ON dv.product_id = d.product_id AND dv.company_id = d.company_id
  WHERE wi.warehouse_id = d.warehouse_id
  AND wi.product_id = d.product_id
  AND wi.company_id = d.company_id
  AND wi.variant_id != dv.variant_id
)
AND NOT EXISTS (
  -- Don't delete if this is the only row for this warehouse+product
  SELECT 1
  FROM public.warehouse_inventory wi2
  WHERE wi2.warehouse_id = wi.warehouse_id
  AND wi2.product_id = wi.product_id
  AND wi2.company_id = wi.company_id
  AND wi2.id != wi.id
);

-- Step 3: Update remaining rows to use DEFAULT variant if variant_id is still NULL
UPDATE public.warehouse_inventory wi
SET variant_id = (
  SELECT pv.id
  FROM public.product_variants pv
  WHERE pv.product_id = wi.product_id
  AND pv.company_id = wi.company_id
  AND pv.is_default = true
  LIMIT 1
)
WHERE wi.variant_id IS NULL;

-- Step 4: Set variant_id to NOT NULL after backfill
ALTER TABLE public.warehouse_inventory
ALTER COLUMN variant_id SET NOT NULL;

-- Add comment
COMMENT ON COLUMN public.warehouse_inventory.variant_id IS 'MANDATORY: Every inventory entry must reference a product variant (even if DEFAULT variant). Backfilled for existing data.';

