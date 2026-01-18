-- Add warehouse_id to order_items table
-- This tracks which warehouse fulfilled each order item

ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.warehouses(id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_order_items_warehouse ON public.order_items(warehouse_id);

-- Set default warehouse for existing order items
UPDATE public.order_items
SET warehouse_id = (SELECT id FROM public.warehouses WHERE code = 'WH-001' LIMIT 1)
WHERE warehouse_id IS NULL;
