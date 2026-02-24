-- Migration: Backfill variant_id in stock_movements
-- Every stock_movement must reference a variant (DEFAULT variant)
-- This migration links existing stock_movements rows to DEFAULT variants

-- Step 1: Update stock_movements rows that don't have variant_id
-- Link them to the DEFAULT variant for each product
UPDATE public.stock_movements sm
SET variant_id = (
  SELECT pv.id
  FROM public.product_variants pv
  WHERE pv.product_id = sm.product_id
  AND pv.company_id = sm.company_id
  AND pv.is_default = true
  LIMIT 1
)
WHERE sm.variant_id IS NULL;

-- Step 2: Verify all rows have variant_id (should be none after step 1)
-- If any rows still have NULL variant_id, it means the product doesn't have a variant
-- This should not happen after the backfill_default_variants migration, but handle it anyway
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM public.stock_movements
  WHERE variant_id IS NULL;
  
  IF null_count > 0 THEN
    RAISE WARNING 'Found % stock_movements rows with NULL variant_id. These will be linked to DEFAULT variants.', null_count;
    
    -- Create DEFAULT variants for products that somehow don't have them
    -- Note: price_id will be set later by backfill_product_prices_for_variants.sql migration
    INSERT INTO public.product_variants (
      product_id,
      name,
      sku,
      is_default,
      company_id,
      created_at,
      updated_at
    )
    SELECT DISTINCT
      p.id as product_id,
      'DEFAULT' as name,
      CASE 
        WHEN p.product_code IS NOT NULL AND p.product_code != '' 
        THEN p.product_code || '-DEFAULT'
        ELSE SUBSTRING(p.id::text, 1, 8) || '-DEFAULT'
      END as sku,
      true as is_default,
      p.company_id,
      p.created_at,
      p.created_at
    FROM public.products p
    WHERE EXISTS (
      SELECT 1
      FROM public.stock_movements sm
      WHERE sm.product_id = p.id
      AND sm.variant_id IS NULL
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.product_variants pv
      WHERE pv.product_id = p.id
      AND pv.company_id = p.company_id
    )
    ON CONFLICT DO NOTHING;
    
    -- Update remaining NULL variant_id rows
    UPDATE public.stock_movements sm
    SET variant_id = (
      SELECT pv.id
      FROM public.product_variants pv
      WHERE pv.product_id = sm.product_id
      AND pv.company_id = sm.company_id
      AND pv.is_default = true
      LIMIT 1
    )
    WHERE sm.variant_id IS NULL;
  END IF;
END $$;

-- Step 3: Set variant_id to NOT NULL after backfill
ALTER TABLE public.stock_movements
ALTER COLUMN variant_id SET NOT NULL;

-- Add comment
COMMENT ON COLUMN public.stock_movements.variant_id IS 'MANDATORY: Every stock movement must reference a product variant (even if DEFAULT variant). Backfilled for existing data.';

