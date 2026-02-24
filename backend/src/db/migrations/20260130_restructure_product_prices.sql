-- Migration: Restructure product_prices table
-- Replace amount with mrp_price and sale_price
-- Add brand_id for brand-specific pricing

-- Step 1: Add new columns as nullable initially
ALTER TABLE public.product_prices
ADD COLUMN IF NOT EXISTS mrp_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS sale_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL;

-- Step 2: Migrate existing amount data to sale_price and mrp_price
-- For now, set both to amount value (can be updated later)
UPDATE public.product_prices
SET sale_price = amount,
    mrp_price = amount
WHERE sale_price IS NULL OR mrp_price IS NULL;

-- Step 3: Set default values for any remaining NULLs (shouldn't happen, but safety check)
UPDATE public.product_prices
SET sale_price = 0
WHERE sale_price IS NULL;

UPDATE public.product_prices
SET mrp_price = 0
WHERE mrp_price IS NULL;

-- Step 4: Make sale_price and mrp_price NOT NULL
ALTER TABLE public.product_prices
ALTER COLUMN sale_price SET NOT NULL,
ALTER COLUMN mrp_price SET NOT NULL;

-- Step 5: Drop the amount column
ALTER TABLE public.product_prices
DROP COLUMN IF EXISTS amount;

-- Step 6: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_product_prices_brand_id ON public.product_prices(brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_prices_mrp_price ON public.product_prices(mrp_price);
CREATE INDEX IF NOT EXISTS idx_product_prices_sale_price ON public.product_prices(sale_price);

-- Step 7: Update comments
COMMENT ON COLUMN public.product_prices.mrp_price IS 'Maximum Retail Price (MRP)';
COMMENT ON COLUMN public.product_prices.sale_price IS 'Actual selling price (replaces amount)';
COMMENT ON COLUMN public.product_prices.brand_id IS 'Brand associated with this price entry (optional)';

COMMENT ON TABLE public.product_prices IS 'Flexible pricing system. Every variant MUST have exactly one standard price entry (price_type=standard, outlet_id=NULL). Uses sale_price and mrp_price instead of amount.';

