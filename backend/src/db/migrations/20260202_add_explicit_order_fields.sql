-- Migration: Add explicit order_source, fulfillment_type, and original_order_id
-- Also expand order_type enum to support sales / purchase / return

-- 1. Add new columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS order_source VARCHAR(20),
ADD COLUMN IF NOT EXISTS fulfillment_type VARCHAR(20),
ADD COLUMN IF NOT EXISTS original_order_id UUID REFERENCES public.orders(id);

-- 2. DROP OLD CONSTRAINT FIRST (before updating data)
ALTER TABLE public.orders 
DROP CONSTRAINT IF EXISTS valid_order_type;

-- 3. NOW update existing order_type values to match new constraint
UPDATE public.orders 
SET order_type = CASE 
    WHEN order_type IN ('sale', 'SALE') THEN 'sales'
    WHEN order_type IN ('purchase', 'PURCHASE') THEN 'purchase'
    WHEN order_type IN ('return', 'RETURN') THEN 'return'
    ELSE order_type
END;

-- 4. Add new constraint
ALTER TABLE public.orders 
ADD CONSTRAINT valid_order_type 
CHECK (order_type IN ('sales', 'purchase', 'return'));

-- 5. Add constraints for new fields
ALTER TABLE public.orders 
ADD CONSTRAINT valid_order_source 
CHECK (order_source IN ('ecommerce', 'pos', 'sales', 'internal'))
NOT VALID;

ALTER TABLE public.orders 
ADD CONSTRAINT valid_fulfillment_type 
CHECK (fulfillment_type IN ('delivery', 'pickup', 'cash_counter'))
NOT VALID;

-- 6. Create indexes
CREATE INDEX IF NOT EXISTS idx_orders_order_source ON public.orders(order_source);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_type ON public.orders(fulfillment_type);
CREATE INDEX IF NOT EXISTS idx_orders_original_order_id ON public.orders(original_order_id);

-- 7. Documentation
COMMENT ON COLUMN public.orders.order_source IS 'Business source of order: ecommerce website, POS, sales dashboard, or internal (purchase).';
COMMENT ON COLUMN public.orders.fulfillment_type IS 'How the order is fulfilled: delivery, pickup, or cash_counter (over-the-counter).';
COMMENT ON COLUMN public.orders.original_order_id IS 'For return orders, references the original order being returned.';