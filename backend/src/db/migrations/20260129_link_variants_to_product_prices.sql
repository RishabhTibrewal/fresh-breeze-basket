-- Migration: Ensure every product_variant has a mandatory standard price entry
-- Pricing is normalized into product_prices table

-- Step 1: Backfill price_id using existing standard price entries
UPDATE public.product_variants pv
SET price_id = (
  SELECT pp.id
  FROM public.product_prices pp
  WHERE pp.variant_id = pv.id
    AND pp.price_type = 'standard'
    AND pp.outlet_id IS NULL
    AND pp.company_id = pv.company_id
  LIMIT 1
)
WHERE pv.price_id IS NULL;

-- Step 2: Create standard price entries for variants still missing price_id
DO $$
DECLARE
  variant_record RECORD;
  new_price_id UUID;
BEGIN
  FOR variant_record IN
    SELECT
      pv.id AS variant_id,
      pv.product_id,
      pv.company_id,
      COALESCE(p.price, 0) AS base_price
    FROM public.product_variants pv
    JOIN public.products p
      ON p.id = pv.product_id
     AND p.company_id = pv.company_id
    WHERE pv.price_id IS NULL
  LOOP
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
    VALUES (
      variant_record.product_id,
      variant_record.variant_id,
      NULL,
      'standard',
      variant_record.base_price,
      variant_record.company_id,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    RETURNING id INTO new_price_id;

    UPDATE public.product_variants
    SET price_id = new_price_id
    WHERE id = variant_record.variant_id;
  END LOOP;
END $$;

-- Step 3: Verify integrity (should be zero)
DO $$
DECLARE
  missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM public.product_variants
  WHERE price_id IS NULL;

  IF missing_count > 0 THEN
    RAISE EXCEPTION
      'Migration failed: % product_variants still missing price_id',
      missing_count;
  END IF;
END $$;

-- Step 4: Enforce NOT NULL
ALTER TABLE public.product_variants
ALTER COLUMN price_id SET NOT NULL;

-- Step 5: Documentation
COMMENT ON COLUMN public.product_variants.price_id IS
'MANDATORY. References product_prices.id for the standard price of this variant. Pricing must never be stored on product_variants.';

COMMENT ON TABLE public.product_variants IS
'Every product must have at least one variant (DEFAULT). Each variant is linked to exactly one standard price entry in product_prices.';
