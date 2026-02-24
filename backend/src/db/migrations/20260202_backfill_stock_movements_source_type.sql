-- Migration: Backfill source_type for existing stock_movements rows

-- 1. Orders: SALE / RETURN movements
UPDATE public.stock_movements sm
SET source_type = CASE
  WHEN sm.movement_type = 'SALE' THEN 'sales'
  WHEN sm.movement_type = 'RETURN' THEN 'return'
  ELSE sm.source_type
END
WHERE sm.reference_type = 'order'
  AND sm.source_type IS NULL;

-- 2. Goods receipts: PURCHASE / RECEIPT movements
-- Existing data likely uses RECEIPT as movement_type for initial stock and GRNs.
UPDATE public.stock_movements sm
SET source_type = 'purchase'
WHERE sm.reference_type IN ('goods_receipt', 'initial_migration')
  AND sm.source_type IS NULL;

-- 3. Transfers
UPDATE public.stock_movements sm
SET source_type = 'transfer'
WHERE sm.reference_type = 'transfer'
  AND sm.source_type IS NULL;

-- 4. Adjustments
UPDATE public.stock_movements sm
SET source_type = 'adjustment'
WHERE sm.reference_type = 'adjustment'
  AND sm.source_type IS NULL;

-- 5. Fallback: treat any remaining movements as sales context if they are SALE / RETURN
UPDATE public.stock_movements sm
SET source_type = CASE
  WHEN sm.movement_type = 'SALE' THEN 'sales'
  WHEN sm.movement_type = 'RETURN' THEN 'return'
  ELSE sm.source_type
END
WHERE sm.source_type IS NULL;

-- 6. Validate new constraint now that data is populated
ALTER TABLE public.stock_movements VALIDATE CONSTRAINT valid_source_type;


