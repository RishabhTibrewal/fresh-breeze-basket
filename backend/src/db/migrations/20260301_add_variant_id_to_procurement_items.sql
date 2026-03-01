-- Migration: Add variant_id to procurement item tables
-- Procurement items should reference variants, not just products, since:
-- - Prices are variant-level (product_prices.variant_id)
-- - Units are variant-level (product_variants.unit, unit_type)
-- - HSN codes are variant-level (product_variants.hsn)
-- - Inventory is tracked at variant level (warehouse_inventory.variant_id)
-- - Tax can be variant-level (product_variants.tax_id)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. purchase_order_items
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE procurement.purchase_order_items
ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL;

-- Backfill: Link existing PO items to default variant for their product
UPDATE procurement.purchase_order_items poi
SET variant_id = (
  SELECT pv.id
  FROM public.product_variants pv
  WHERE pv.product_id = poi.product_id
    AND pv.is_default = true
  LIMIT 1
)
WHERE variant_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.product_variants pv
    WHERE pv.product_id = poi.product_id
      AND pv.is_default = true
  );

-- Create index for variant lookups
CREATE INDEX IF NOT EXISTS idx_poi_variant_id 
ON procurement.purchase_order_items(variant_id) 
WHERE variant_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN procurement.purchase_order_items.variant_id IS 'Product variant being purchased. Required for accurate pricing, units, HSN codes, and inventory tracking.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. goods_receipt_items
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE procurement.goods_receipt_items
ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL;

-- Backfill: Link existing GRN items to variant from their purchase_order_item
-- (preferred) or default variant if PO item doesn't have variant_id yet
UPDATE procurement.goods_receipt_items gri
SET variant_id = COALESCE(
  -- First try: get variant from purchase_order_item
  (
    SELECT poi.variant_id
    FROM procurement.purchase_order_items poi
    WHERE poi.id = gri.purchase_order_item_id
      AND poi.variant_id IS NOT NULL
  ),
  -- Fallback: get default variant for product
  (
    SELECT pv.id
    FROM public.product_variants pv
    WHERE pv.product_id = gri.product_id
      AND pv.is_default = true
    LIMIT 1
  )
)
WHERE variant_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.product_variants pv
    WHERE pv.product_id = gri.product_id
      AND pv.is_default = true
  );

-- Create index for variant lookups
CREATE INDEX IF NOT EXISTS idx_gri_variant_id 
ON procurement.goods_receipt_items(variant_id) 
WHERE variant_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN procurement.goods_receipt_items.variant_id IS 'Product variant being received. Should match purchase_order_item.variant_id. Required for accurate inventory tracking.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. purchase_invoice_items
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE procurement.purchase_invoice_items
ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL;

-- Backfill: Link existing invoice items to variant from their goods_receipt_item
-- (preferred) or default variant if GRN item doesn't have variant_id yet
UPDATE procurement.purchase_invoice_items pii
SET variant_id = COALESCE(
  -- First try: get variant from goods_receipt_item
  (
    SELECT gri.variant_id
    FROM procurement.goods_receipt_items gri
    WHERE gri.id = pii.goods_receipt_item_id
      AND gri.variant_id IS NOT NULL
  ),
  -- Fallback: get default variant for product
  (
    SELECT pv.id
    FROM public.product_variants pv
    WHERE pv.product_id = pii.product_id
      AND pv.is_default = true
    LIMIT 1
  )
)
WHERE variant_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.product_variants pv
    WHERE pv.product_id = pii.product_id
      AND pv.is_default = true
  );

-- Create index for variant lookups
CREATE INDEX IF NOT EXISTS idx_pii_variant_id 
ON procurement.purchase_invoice_items(variant_id) 
WHERE variant_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN procurement.purchase_invoice_items.variant_id IS 'Product variant being invoiced. Should match goods_receipt_item.variant_id. Required for accurate pricing and tax calculation.';

