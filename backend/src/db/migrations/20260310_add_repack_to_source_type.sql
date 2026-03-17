-- Migration: Add 'repack' to valid_source_type for REPACK_OUT/REPACK_IN movements
-- Must run after 20260202_update_stock_movements_for_purchase (which adds source_type)

ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS valid_source_type;
ALTER TABLE public.stock_movements ADD CONSTRAINT valid_source_type
CHECK (source_type IN ('sales', 'purchase', 'return', 'transfer', 'adjustment', 'receipt', 'repack'));
