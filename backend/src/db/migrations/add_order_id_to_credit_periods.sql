-- Add order_id column to credit_periods table
ALTER TABLE public.credit_periods 
ADD COLUMN order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;

-- Add index for better query performance on order_id
CREATE INDEX IF NOT EXISTS idx_credit_periods_order ON public.credit_periods(order_id);

-- Comment explaining the update
COMMENT ON COLUMN public.credit_periods.order_id IS 'Links the credit period to a specific order'; 