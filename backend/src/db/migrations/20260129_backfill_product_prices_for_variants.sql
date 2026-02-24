-- Migration: Backfill product_prices entries for existing variants
-- Every variant MUST have exactly one standard price entry in product_prices table
-- This migration creates standard price entries for variants that don't have them

-- Step 1: Create standard price entries for variants without them
-- Use price_override if exists, otherwise use product.price
INSERT INTO public.product_prices (
  product_id,
  variant_id,
  outlet_id,
  price_type,
  amount,
  company_id,
  created_at,
  updated_at
)
SELECT DISTINCT
  pv.product_id,
  pv.id as variant_id,
  NULL as outlet_id, -- NULL = applies to all outlets
  'standard' as price_type,
  COALESCE(
    pv.price_override, -- Use variant price_override if exists
    p.price -- Fallback to product price
  ) as amount,
  pv.company_id,
  pv.created_at,
  pv.created_at
FROM public.product_variants pv
INNER JOIN public.products p ON p.id = pv.product_id AND p.company_id = pv.company_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.product_prices pp
  WHERE pp.variant_id = pv.id
  AND pp.price_type = 'standard'
  AND pp.outlet_id IS NULL
  AND pp.company_id = pv.company_id
)
ON CONFLICT DO NOTHING;

-- Step 2: Handle variants that might have price_override = NULL but product.price is also NULL
-- Set amount to 0 if both are NULL (shouldn't happen, but handle edge case)
UPDATE public.product_prices pp
SET amount = 0
WHERE pp.amount IS NULL
AND EXISTS (
  SELECT 1
  FROM public.product_variants pv
  WHERE pv.id = pp.variant_id
  AND pv.company_id = pp.company_id
);

-- Add comment
COMMENT ON TABLE public.product_prices IS 'Flexible pricing system. Every variant MUST have exactly one standard price entry (price_type=standard, outlet_id=NULL). Backfilled for existing variants.';

