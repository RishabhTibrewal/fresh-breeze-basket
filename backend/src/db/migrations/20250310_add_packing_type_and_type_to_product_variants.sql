-- Migration: Add packing_type and type to product_variants
-- packing_type: Physical pack (bag, box, packet, carton)
-- type: Role for repack (bulk, retail, wholesale)

ALTER TABLE public.product_variants
ADD COLUMN IF NOT EXISTS packing_type TEXT,
ADD COLUMN IF NOT EXISTS type TEXT;

COMMENT ON COLUMN public.product_variants.packing_type IS 'Physical packaging: bag, box, packet, carton, etc.';
COMMENT ON COLUMN public.product_variants.type IS 'Role for repack: bulk (repack input), retail (sellable), wholesale';
