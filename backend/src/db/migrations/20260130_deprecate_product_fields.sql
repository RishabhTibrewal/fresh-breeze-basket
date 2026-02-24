-- Migration: Deprecate product-level fields
-- These fields are now moved to product_variants table
-- Columns are kept for backward compatibility but marked as deprecated
-- NOTE: products.is_active is NOT deprecated - it controls variant activation

COMMENT ON COLUMN public.products.image_url IS 'DEPRECATED: Use product_variants.image_url instead. This column is kept for backward compatibility.';
COMMENT ON COLUMN public.products.is_featured IS 'DEPRECATED: Use product_variants.is_featured instead. This column is kept for backward compatibility.';
COMMENT ON COLUMN public.products.is_active IS 'Product-level activation control. If false, all variants are automatically inactive. Variants can only be active if product is active.';
COMMENT ON COLUMN public.products.unit IS 'DEPRECATED: Use product_variants.unit instead. This column is kept for backward compatibility.';
COMMENT ON COLUMN public.products.unit_type IS 'DEPRECATED: Use product_variants.unit_type instead. This column is kept for backward compatibility.';
COMMENT ON COLUMN public.products.best_before IS 'DEPRECATED: Use product_variants.best_before instead. This column is kept for backward compatibility.';
COMMENT ON COLUMN public.products.tax IS 'DEPRECATED: Use product_variants.tax instead. This column is kept for backward compatibility.';
COMMENT ON COLUMN public.products.hsn_code IS 'DEPRECATED: Use product_variants.hsn instead. This column is kept for backward compatibility.';
COMMENT ON COLUMN public.products.badge IS 'DEPRECATED: Use product_variants.badge instead. This column is kept for backward compatibility.';

