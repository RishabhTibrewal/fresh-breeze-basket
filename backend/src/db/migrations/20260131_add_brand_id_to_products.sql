-- Migration: Add brand_id to products table
-- Products can have a brand at the product level
-- Variants can also have brand_id which may override the product-level brand

-- Step 1: Add brand_id column to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL;

-- Step 2: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON public.products(brand_id) WHERE brand_id IS NOT NULL;

-- Step 3: Add comment for documentation
COMMENT ON COLUMN public.products.brand_id IS 'Brand associated with this product. Variants can have their own brand_id which may override this.';

