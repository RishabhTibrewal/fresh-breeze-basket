-- Backfill product detail fields for existing purchase_order_items
-- Fetch product details and populate unit, product_code, hsn_code, tax_percentage

UPDATE procurement.purchase_order_items poi
SET 
  unit = COALESCE(p.unit_type, 'piece'),
  product_code = COALESCE(p.product_code, ''),
  hsn_code = COALESCE(p.hsn_code, ''),
  tax_percentage = COALESCE(p.tax, 0)
FROM public.products p
WHERE poi.product_id = p.id
AND (
  poi.unit IS NULL 
  OR poi.product_code IS NULL 
  OR poi.hsn_code IS NULL 
  OR poi.tax_percentage IS NULL
);

