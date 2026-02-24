-- Migration: Add source_type and PURCHASE movement_type to stock_movements

-- 1. Add source_type column to capture business context of each movement
ALTER TABLE public.stock_movements
ADD COLUMN IF NOT EXISTS source_type VARCHAR(20);

-- 2. Add constraint for valid source_type values
ALTER TABLE public.stock_movements
ADD CONSTRAINT valid_source_type
CHECK (source_type IN ('sales', 'purchase', 'return', 'transfer', 'adjustment', 'receipt'))
NOT VALID;

-- 3. Update movement_type constraint to include PURCHASE
ALTER TABLE public.stock_movements
DROP CONSTRAINT IF EXISTS valid_movement_type;

ALTER TABLE public.stock_movements
ADD CONSTRAINT valid_movement_type
CHECK (
  movement_type IN (
    'SALE',
    'RETURN',
    'PURCHASE',
    'ADJUSTMENT',
    'ADJUSTMENT_IN',
    'ADJUSTMENT_OUT',
    'TRANSFER',
    'RECEIPT'
  )
);

-- 4. Index for source_type
CREATE INDEX IF NOT EXISTS idx_stock_movements_source_type ON public.stock_movements(source_type);

-- 5. Documentation
COMMENT ON COLUMN public.stock_movements.source_type IS 'Business source of movement: sales order, purchase (GRN), return, transfer, adjustment, or initial receipt.';


