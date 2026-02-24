-- Migration: Backfill DEFAULT variants for existing products
-- Every product MUST have at least one variant (DEFAULT variant)
-- This migration creates DEFAULT variants for products that don't have any variants

-- Step 1: Create DEFAULT variants for products without any variants
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
SELECT 
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
WHERE NOT EXISTS (
  SELECT 1 
  FROM public.product_variants pv 
  WHERE pv.product_id = p.id 
  AND pv.company_id = p.company_id
)
ON CONFLICT DO NOTHING;

-- Step 2: Ensure products with variants have exactly one default variant
-- If a product has variants but no default, mark the first variant as default
UPDATE public.product_variants pv1
SET is_default = true
WHERE pv1.id IN (
  SELECT pv2.id
  FROM public.product_variants pv2
  WHERE pv2.product_id IN (
    -- Products that have variants but no default variant
    SELECT DISTINCT pv3.product_id
    FROM public.product_variants pv3
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.product_variants pv4
      WHERE pv4.product_id = pv3.product_id
      AND pv4.is_default = true
      AND pv4.company_id = pv3.company_id
    )
  )
  AND pv2.company_id = pv1.company_id
  AND pv2.id = (
    -- Get the first variant (by created_at) for each product
    SELECT pv5.id
    FROM public.product_variants pv5
    WHERE pv5.product_id = pv2.product_id
    AND pv5.company_id = pv2.company_id
    ORDER BY pv5.created_at ASC
    LIMIT 1
  )
);

-- Step 3: If multiple variants are marked as default for the same product, keep only the oldest one
-- This handles edge cases where the constraint might not have been enforced
UPDATE public.product_variants pv1
SET is_default = false
WHERE pv1.is_default = true
AND EXISTS (
  SELECT 1
  FROM public.product_variants pv2
  WHERE pv2.product_id = pv1.product_id
  AND pv2.company_id = pv1.company_id
  AND pv2.is_default = true
  AND pv2.id != pv1.id
  AND pv2.created_at < pv1.created_at -- Keep the older one as default
);

-- Add comment
COMMENT ON TABLE public.product_variants IS 'Product variants - every product MUST have at least one variant (DEFAULT variant). Backfilled for existing products.';

