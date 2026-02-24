-- Migration: Update product_variants table for mandatory variants
-- Every product MUST have at least one variant (DEFAULT variant)
-- Adds is_default column and price_override, removes deprecated stock_count

-- Step 1: Add is_default column
ALTER TABLE public.product_variants
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- Step 2: Rename price to price_override for clarity (it overrides product.price)
ALTER TABLE public.product_variants
RENAME COLUMN price TO price_override;

-- Step 4: Create function to ensure exactly one default variant per product
CREATE OR REPLACE FUNCTION public.ensure_single_default_variant()
RETURNS TRIGGER AS $$
BEGIN
  -- If this variant is being set as default, unset all other defaults for this product
  IF NEW.is_default = true THEN
    UPDATE public.product_variants
    SET is_default = false
    WHERE product_id = NEW.product_id
      AND id != NEW.id
      AND company_id = NEW.company_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger to enforce single default variant
DROP TRIGGER IF EXISTS trigger_ensure_single_default_variant ON public.product_variants;
CREATE TRIGGER trigger_ensure_single_default_variant
  BEFORE INSERT OR UPDATE ON public.product_variants
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_default_variant();

-- Step 6: Create unique index for default variant per product
-- This ensures only one default variant per product per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_default_per_product
ON public.product_variants(product_id, company_id)
WHERE is_default = true;

-- Step 7: Update comments
COMMENT ON COLUMN public.product_variants.is_default IS 'Exactly one variant per product must be marked as default';
COMMENT ON COLUMN public.product_variants.price_override IS 'Optional variant-specific price that overrides product.base_price. NULL means use product price';
COMMENT ON TABLE public.product_variants IS 'Product variants - every product MUST have at least one variant (DEFAULT variant)';

