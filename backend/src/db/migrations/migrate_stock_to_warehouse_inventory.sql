-- Migrate stock from products.stock_count to warehouse_inventory
-- This assigns all existing stock to the default warehouse (WH-001)

-- Migrate stock from products.stock_count to warehouse_inventory
INSERT INTO public.warehouse_inventory (warehouse_id, product_id, stock_count)
SELECT 
    (SELECT id FROM public.warehouses WHERE code = 'WH-001' LIMIT 1),
    id,
    COALESCE(stock_count, 0)
FROM public.products
WHERE id NOT IN (
    SELECT product_id FROM public.warehouse_inventory 
    WHERE warehouse_id = (SELECT id FROM public.warehouses WHERE code = 'WH-001' LIMIT 1)
)
ON CONFLICT (warehouse_id, product_id) DO NOTHING;

-- Create a view for backward compatibility (shows total stock across all warehouses)
CREATE OR REPLACE VIEW public.product_stock_view AS
SELECT 
    p.id as product_id,
    p.name,
    COALESCE(SUM(wi.stock_count), 0) as total_stock,
    COUNT(DISTINCT wi.warehouse_id) as warehouse_count
FROM public.products p
LEFT JOIN public.warehouse_inventory wi ON p.id = wi.product_id
GROUP BY p.id, p.name;

-- Add comment to products.stock_count indicating it's deprecated
COMMENT ON COLUMN public.products.stock_count IS 'DEPRECATED: Use warehouse_inventory.stock_count instead. This column is kept for backward compatibility but should not be updated directly.';
