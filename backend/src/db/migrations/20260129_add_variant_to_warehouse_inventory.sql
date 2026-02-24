-- Migration: Add variant_id to warehouse_inventory table
-- Inventory is now tracked at warehouse × product × variant level
-- variant_id is NOT NULL - every inventory entry must reference a variant

-- Step 1: Add variant_id column (nullable initially for migration)
ALTER TABLE public.warehouse_inventory
ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE;

-- Step 2: Drop old unique constraint
ALTER TABLE public.warehouse_inventory
DROP CONSTRAINT IF EXISTS warehouse_inventory_warehouse_id_product_id_key;

-- Step 3: Add new unique constraint including variant_id
ALTER TABLE public.warehouse_inventory
ADD CONSTRAINT warehouse_inventory_warehouse_product_variant_unique
UNIQUE(warehouse_id, product_id, variant_id);

-- Step 4: Update indexes to include variant_id
DROP INDEX IF EXISTS idx_warehouse_inventory_warehouse;
DROP INDEX IF EXISTS idx_warehouse_inventory_product;

CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_warehouse 
ON public.warehouse_inventory(warehouse_id);

CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_product 
ON public.warehouse_inventory(product_id);

CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_variant 
ON public.warehouse_inventory(variant_id);

CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_warehouse_product_variant 
ON public.warehouse_inventory(warehouse_id, product_id, variant_id);

-- Step 5: Add comment
COMMENT ON COLUMN public.warehouse_inventory.variant_id IS 'MANDATORY: Every inventory entry must reference a product variant (even if DEFAULT variant)';

-- Note: variant_id will be set to NOT NULL after backfill migration completes
-- See: 20260129_backfill_warehouse_inventory_variants.sql

