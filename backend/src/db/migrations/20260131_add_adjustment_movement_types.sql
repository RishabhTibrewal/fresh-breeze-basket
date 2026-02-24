-- Migration: Add ADJUSTMENT_IN and ADJUSTMENT_OUT movement types
-- These provide clearer audit trail for stock adjustments
-- ADJUSTMENT_IN: Physical count > system count (stock found)
-- ADJUSTMENT_OUT: Physical count < system count (stock lost/damaged)

-- Drop existing constraint
ALTER TABLE public.stock_movements
DROP CONSTRAINT IF EXISTS valid_movement_type;

-- Add new constraint with ADJUSTMENT_IN and ADJUSTMENT_OUT
ALTER TABLE public.stock_movements
ADD CONSTRAINT valid_movement_type 
CHECK (movement_type IN ('SALE', 'RETURN', 'ADJUSTMENT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER', 'RECEIPT'));

-- Add comment explaining the new movement types
COMMENT ON COLUMN public.stock_movements.movement_type IS 'Type of movement: SALE (reduces stock), RETURN (increases stock), ADJUSTMENT (legacy), ADJUSTMENT_IN (physical > system), ADJUSTMENT_OUT (physical < system), TRANSFER, RECEIPT';

