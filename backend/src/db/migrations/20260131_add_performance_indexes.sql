-- Migration: Add performance indexes for product listings and common queries
-- Optimizes queries for product variants, prices, and brands

-- Composite index for product listings with variants (company_id + is_active + is_featured)
CREATE INDEX IF NOT EXISTS idx_product_variants_company_active_featured 
ON public.product_variants(company_id, is_active, is_featured) 
WHERE is_active = true;

-- Composite index for variant price lookups (variant_id + price_type + valid dates)
CREATE INDEX IF NOT EXISTS idx_product_prices_variant_type_valid 
ON public.product_prices(variant_id, price_type, valid_from, valid_until) 
WHERE variant_id IS NOT NULL;

-- Composite index for product-variant joins (product_id + is_default + is_active)
CREATE INDEX IF NOT EXISTS idx_product_variants_product_default_active 
ON public.product_variants(product_id, is_default, is_active) 
WHERE is_default = true;

-- Index for order items with variant lookups (variant_id + company_id)
CREATE INDEX IF NOT EXISTS idx_order_items_variant_company 
ON public.order_items(variant_id, company_id) 
WHERE variant_id IS NOT NULL;

-- Composite index for warehouse inventory queries (warehouse_id + product_id + variant_id)
CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_warehouse_product_variant 
ON public.warehouse_inventory(warehouse_id, product_id, variant_id);

-- Index for brand lookups (company_id + is_active)
CREATE INDEX IF NOT EXISTS idx_brands_company_active 
ON public.brands(company_id, is_active) 
WHERE is_active = true;

-- Composite index for product images (product_id + variant_id + display_order)
CREATE INDEX IF NOT EXISTS idx_product_images_product_variant_order 
ON public.product_images(product_id, variant_id, display_order);

-- Index for tax lookups (company_id + is_active)
CREATE INDEX IF NOT EXISTS idx_taxes_company_active 
ON public.taxes(company_id, is_active) 
WHERE is_active = true;

-- Composite index for product search (company_id + name + is_active)
CREATE INDEX IF NOT EXISTS idx_products_company_name_active 
ON public.products(company_id, name, is_active) 
WHERE is_active = true;

-- Index for variant SKU lookups (company_id + sku)
CREATE INDEX IF NOT EXISTS idx_product_variants_company_sku 
ON public.product_variants(company_id, sku) 
WHERE sku IS NOT NULL;

-- Comments
COMMENT ON INDEX idx_product_variants_company_active_featured IS 'Optimizes product listing queries filtering by active and featured variants';
COMMENT ON INDEX idx_product_prices_variant_type_valid IS 'Optimizes variant price lookups with validity date filtering';
COMMENT ON INDEX idx_product_variants_product_default_active IS 'Optimizes default variant lookups for products';
COMMENT ON INDEX idx_order_items_variant_company IS 'Optimizes order item queries with variant information';
COMMENT ON INDEX idx_warehouse_inventory_warehouse_product_variant IS 'Optimizes warehouse inventory queries with variant details';
COMMENT ON INDEX idx_brands_company_active IS 'Optimizes active brand lookups';
COMMENT ON INDEX idx_product_images_product_variant_order IS 'Optimizes product image queries with variant and ordering';
COMMENT ON INDEX idx_taxes_company_active IS 'Optimizes active tax rate lookups';
COMMENT ON INDEX idx_products_company_name_active IS 'Optimizes product search queries';
COMMENT ON INDEX idx_product_variants_company_sku IS 'Optimizes variant lookups by SKU';

