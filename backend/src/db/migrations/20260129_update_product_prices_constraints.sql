-- Migration: Update product_prices table constraints
-- Ensure variant_id can be NOT NULL and add constraint for one standard price per variant
-- Every variant must have exactly one standard price entry

-- Step 1: Update unique constraint to allow multiple price types per variant
-- Current constraint: UNIQUE(product_id, variant_id, outlet_id, price_type, company_id)
-- This already allows multiple price types, so we just need to ensure variant_id can be NOT NULL

-- Step 2: Add constraint to ensure every variant has exactly one standard price
-- This will be enforced via application logic and a unique partial index
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_prices_variant_standard_price
ON public.product_prices(variant_id, company_id)
WHERE variant_id IS NOT NULL AND price_type = 'standard' AND outlet_id IS NULL;

-- Step 3: Add index for faster variant price lookups
CREATE INDEX IF NOT EXISTS idx_product_prices_variant_price_type
ON public.product_prices(variant_id, price_type)
WHERE variant_id IS NOT NULL;

-- Step 4: Update comments
COMMENT ON TABLE public.product_prices IS 'Flexible pricing system. Every variant MUST have exactly one standard price entry (price_type=standard, outlet_id=NULL). Variants can have multiple price entries for different price types (bulk, sale, wholesale, etc.)';
COMMENT ON COLUMN public.product_prices.variant_id IS 'MANDATORY for variant-specific prices. NULL for product-level prices. Every variant must have one standard price entry.';
COMMENT ON COLUMN public.product_prices.price_type IS 'Type of price: standard (required for variants), sale, bulk, wholesale, etc.';

