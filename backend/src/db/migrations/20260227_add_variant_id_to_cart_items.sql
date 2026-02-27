-- Migration: Add variant_id to cart_items and update unique constraint
-- Previously cart_items had no variant_id, so one product could only appear once in a cart.
-- With variants, the same product can be in the cart multiple times with different variants.

-- Step 1: Add variant_id column (nullable — existing rows have no variant)
ALTER TABLE public.cart_items
ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL;

-- Step 2: Drop old unique constraint (was unique per product per cart)
ALTER TABLE public.cart_items
DROP CONSTRAINT IF EXISTS cart_items_cart_id_product_id_key;

-- Step 3: Add new unique constraint — unique per variant per cart
--         (NULL variant_id rows are excluded by Postgres unique index semantics,
--          so legacy rows without variants will still work)
CREATE UNIQUE INDEX IF NOT EXISTS cart_items_cart_id_variant_id_key
    ON public.cart_items (cart_id, variant_id)
    WHERE variant_id IS NOT NULL;

-- Step 4: Index for FK lookups
CREATE INDEX IF NOT EXISTS idx_cart_items_variant_id
    ON public.cart_items (variant_id)
    WHERE variant_id IS NOT NULL;

-- Documentation
COMMENT ON COLUMN public.cart_items.variant_id IS
    'The specific product variant added to the cart. Required for variant-based products.';

