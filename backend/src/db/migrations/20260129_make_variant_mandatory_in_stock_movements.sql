-- Migration: Make variant_id mandatory in stock_movements
-- All stock movements must reference a variant (even if DEFAULT variant)

-- Step 1: Update indexes to remove WHERE variant_id IS NOT NULL clauses
DROP INDEX IF EXISTS idx_stock_movements_variant;

CREATE INDEX IF NOT EXISTS idx_stock_movements_variant 
ON public.stock_movements(variant_id);

-- Step 2: Add comment
COMMENT ON COLUMN public.stock_movements.variant_id IS 'MANDATORY: Every stock movement must reference a product variant (even if DEFAULT variant)';

-- Note: variant_id will be set to NOT NULL after backfill migration completes
-- See: 20260129_backfill_stock_movements_variants.sql

