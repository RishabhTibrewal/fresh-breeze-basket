-- Migration: Create product_variants table
-- Supports product variants (sizes, colors, etc.) for retail products
-- Variants are nullable - products can exist without variants

CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL, -- e.g., "500g", "Red", "Large", "XL"
  sku VARCHAR(100), -- Optional SKU for variant
  price DECIMAL(10,2), -- Optional variant-specific price (overrides product price)
  stock_count INTEGER DEFAULT 0, -- Variant-specific stock (deprecated, use warehouse_inventory)
  company_id UUID NOT NULL REFERENCES public.companies(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, name, company_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_company_id ON public.product_variants(company_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON public.product_variants(sku) WHERE sku IS NOT NULL;

-- Add RLS policies (will be configured based on company isolation)
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- Add foreign key constraint to order_items.variant_id now that table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'order_items_variant_id_fkey'
  ) THEN
    ALTER TABLE public.order_items
    ADD CONSTRAINT order_items_variant_id_fkey 
    FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON TABLE public.product_variants IS 'Product variants (sizes, colors, etc.) - nullable, retail-focused';
COMMENT ON COLUMN public.product_variants.name IS 'Variant name (e.g., "500g", "Red", "Large")';
COMMENT ON COLUMN public.product_variants.price IS 'Optional variant-specific price (overrides product base price)';
COMMENT ON COLUMN public.product_variants.stock_count IS 'Deprecated: Use warehouse_inventory for stock tracking';

