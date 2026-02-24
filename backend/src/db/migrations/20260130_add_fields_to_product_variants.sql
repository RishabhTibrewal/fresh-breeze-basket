-- Migration: Add variant-level fields to product_variants table
-- Moves product-level attributes to variant level for better granularity
-- Fields: image_url, is_featured, is_active, unit, unit_type, best_before, hsn, badge, brand_id
-- Note: tax_id is added in a separate migration (20260130_replace_tax_with_tax_id_in_variants.sql)

-- Step 1: Add new columns
ALTER TABLE public.product_variants
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS unit DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS unit_type VARCHAR(50) DEFAULT 'piece',
ADD COLUMN IF NOT EXISTS best_before DATE,
ADD COLUMN IF NOT EXISTS hsn VARCHAR(50),
ADD COLUMN IF NOT EXISTS badge TEXT,
ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL;

-- Step 2: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_product_variants_brand_id ON public.product_variants(brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_variants_is_featured ON public.product_variants(is_featured);
CREATE INDEX IF NOT EXISTS idx_product_variants_is_active ON public.product_variants(is_active);
CREATE INDEX IF NOT EXISTS idx_product_variants_hsn ON public.product_variants(hsn) WHERE hsn IS NOT NULL;

-- Step 3: Add comments for documentation
COMMENT ON COLUMN public.product_variants.image_url IS 'Variant-specific image URL';
COMMENT ON COLUMN public.product_variants.is_featured IS 'Whether this variant is featured';
COMMENT ON COLUMN public.product_variants.is_active IS 'Whether this variant is currently active';
COMMENT ON COLUMN public.product_variants.unit IS 'Numeric unit value (e.g., 500 for 500g)';
COMMENT ON COLUMN public.product_variants.unit_type IS 'Unit type (e.g., piece, kg, g, liter)';
COMMENT ON COLUMN public.product_variants.best_before IS 'Best before date for this variant';
COMMENT ON COLUMN public.product_variants.hsn IS 'HSN (Harmonized System of Nomenclature) code for tax purposes';
COMMENT ON COLUMN public.product_variants.badge IS 'Badge text for this variant (e.g., "New", "Sale", "Popular")';
COMMENT ON COLUMN public.product_variants.brand_id IS 'Brand associated with this variant';

