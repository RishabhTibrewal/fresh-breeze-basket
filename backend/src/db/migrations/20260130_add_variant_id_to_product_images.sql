-- Migration: Add variant_id to product_images table
-- Allows images to be linked to specific variants
-- Supports both product-level and variant-level images

-- Step 1: Add variant_id column
ALTER TABLE public.product_images
ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE;

-- Step 2: Add constraint to ensure at least product_id or variant_id is provided
ALTER TABLE public.product_images
DROP CONSTRAINT IF EXISTS check_product_or_variant_image;

ALTER TABLE public.product_images
ADD CONSTRAINT check_product_or_variant_image
CHECK (product_id IS NOT NULL OR variant_id IS NOT NULL);

-- Step 3: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_product_images_variant_id ON public.product_images(variant_id) WHERE variant_id IS NOT NULL;

-- Step 4: Update comments
COMMENT ON COLUMN public.product_images.variant_id IS 'Variant this image belongs to (optional - can be product-level or variant-specific)';
COMMENT ON TABLE public.product_images IS 'Product images - can be linked to products, variants, or both. At least one of product_id or variant_id must be set.';

