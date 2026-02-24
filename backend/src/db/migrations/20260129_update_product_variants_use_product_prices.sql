-- Migration: Update product_variants to use product_prices table
-- Remove price_override column and add price_id that references product_prices.id
-- Every variant must have a price_id pointing to its standard price entry

-- Step 1: Add price_id column (nullable initially for migration)
ALTER TABLE public.product_variants
ADD COLUMN IF NOT EXISTS price_id UUID REFERENCES public.product_prices(id) ON DELETE RESTRICT;

-- Step 2: Add index for price_id
CREATE INDEX IF NOT EXISTS idx_product_variants_price_id ON public.product_variants(price_id);

-- Step 3: Add comment
COMMENT ON COLUMN public.product_variants.price_id IS 'MANDATORY: References product_prices.id for the standard price entry. Every variant must have exactly one standard price entry in product_prices table.';

-- Note: price_id will be set to NOT NULL after backfill migration completes
-- price_override will be removed after linking variants to product_prices
-- See: 20260129_backfill_product_prices_for_variants.sql and 20260129_link_variants_to_product_prices.sql

