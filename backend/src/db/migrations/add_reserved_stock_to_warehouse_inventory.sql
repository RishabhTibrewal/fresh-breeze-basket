-- Add reserved_stock column to warehouse_inventory table
-- This tracks stock that is reserved for pending orders

ALTER TABLE public.warehouse_inventory
ADD COLUMN IF NOT EXISTS reserved_stock INTEGER DEFAULT 0;

-- Add constraint to ensure reserved_stock is non-negative
-- Note: reserved_stock can exceed stock_count for advance ordering
ALTER TABLE public.warehouse_inventory
ADD CONSTRAINT check_reserved_stock_non_negative 
CHECK (reserved_stock >= 0);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_reserved_stock 
ON public.warehouse_inventory(reserved_stock);

-- Add comment explaining the column
COMMENT ON COLUMN public.warehouse_inventory.reserved_stock IS 
'Stock reserved for pending orders. When order is created, stock moves from stock_count to reserved_stock. When order is processed/shipped/delivered, stock is deducted from reserved_stock. When order is cancelled, stock moves back from reserved_stock to stock_count. Reserved stock can exceed stock_count to allow advance ordering/pre-orders.';
