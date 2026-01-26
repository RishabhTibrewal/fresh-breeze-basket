-- Backfill product detail fields for existing goods_receipt_items
-- Fetch product details and populate unit, product_code, hsn_code, tax_percentage

UPDATE procurement.goods_receipt_items gri
SET 
  unit = COALESCE(p.unit_type, 'piece'),
  product_code = COALESCE(p.product_code, ''),
  hsn_code = COALESCE(p.hsn_code, ''),
  tax_percentage = COALESCE(p.tax, 0)
FROM public.products p
WHERE gri.product_id = p.id
AND (
  gri.unit IS NULL 
  OR gri.product_code IS NULL 
  OR gri.hsn_code IS NULL 
  OR gri.tax_percentage IS NULL
);

