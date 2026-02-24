-- Migration: Add order_type, industry_context, and outlet_id to orders table
-- This makes orders industry-agnostic and supports multi-outlet operations

-- Add new columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) DEFAULT 'SALE',
ADD COLUMN IF NOT EXISTS industry_context VARCHAR(50) DEFAULT 'retail',
ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES public.warehouses(id);

-- Add constraints for valid values
ALTER TABLE public.orders 
DROP CONSTRAINT IF EXISTS valid_order_type,
DROP CONSTRAINT IF EXISTS valid_industry_context;

ALTER TABLE public.orders 
ADD CONSTRAINT valid_order_type CHECK (order_type IN ('SALE', 'RETURN')),
ADD CONSTRAINT valid_industry_context CHECK (industry_context IN ('retail', 'restaurant', 'service'));

-- Backfill existing orders with default values
UPDATE public.orders 
SET order_type = 'SALE', industry_context = 'retail' 
WHERE order_type IS NULL OR industry_context IS NULL;

-- Set outlet_id to default warehouse for existing orders if missing
-- This uses the first active warehouse per company as default
UPDATE public.orders o
SET outlet_id = (
  SELECT w.id 
  FROM public.warehouses w 
  WHERE w.company_id = o.company_id 
    AND w.is_active = true 
  ORDER BY w.created_at ASC 
  LIMIT 1
)
WHERE o.outlet_id IS NULL;

-- Create index on outlet_id for faster queries
CREATE INDEX IF NOT EXISTS idx_orders_outlet_id ON public.orders(outlet_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON public.orders(order_type);
CREATE INDEX IF NOT EXISTS idx_orders_industry_context ON public.orders(industry_context);

-- Add comments for documentation
COMMENT ON COLUMN public.orders.order_type IS 'Type of order: SALE (purchase) or RETURN (refund)';
COMMENT ON COLUMN public.orders.industry_context IS 'Industry context: retail (default), restaurant, service';
COMMENT ON COLUMN public.orders.outlet_id IS 'Reference to warehouse/outlet where order was placed';

