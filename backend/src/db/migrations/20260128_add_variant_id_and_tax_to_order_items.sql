-- Migration: Add variant_id and tax_amount to order_items table
-- This supports product variants and explicit tax tracking

-- Add variant_id column (nullable, references product_variants)
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS variant_id UUID;

-- Add tax_amount column
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) DEFAULT 0;

-- Add foreign key constraint for variant_id (will be added after product_variants table exists)
-- We'll add this constraint in a later migration after product_variants is created
-- ALTER TABLE public.order_items
-- ADD CONSTRAINT order_items_variant_id_fkey 
-- FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;

-- Backfill tax_amount from products.tax if exists
-- Calculate tax_amount = quantity * unit_price * (tax_percentage / 100)
UPDATE public.order_items oi
SET tax_amount = ROUND((oi.quantity * oi.unit_price * COALESCE(p.tax, 0) / 100)::numeric, 2)
FROM public.products p
WHERE oi.product_id = p.id 
  AND (oi.tax_amount = 0 OR oi.tax_amount IS NULL);

-- Create index on variant_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_order_items_variant_id ON public.order_items(variant_id);

-- Add comment for documentation
COMMENT ON COLUMN public.order_items.variant_id IS 'Optional reference to product variant (size, color, etc.)';
COMMENT ON COLUMN public.order_items.tax_amount IS 'Tax amount for this line item (calculated at time of order)';

