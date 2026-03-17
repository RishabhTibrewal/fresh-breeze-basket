-- Migration: Add REPACK_OUT and REPACK_IN movement types for package breakdown
-- REPACK_OUT: Decrease input variant stock (bulk consumed)
-- REPACK_IN: Increase output variant stock (retail produced)

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
    'RECEIPT',
    'REPACK_OUT',
    'REPACK_IN'
  )
);


