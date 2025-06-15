-- Update credit_periods table to link with orders
ALTER TABLE public.credit_periods 
ADD COLUMN order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;

-- Add index for better query performance on order_id
CREATE INDEX IF NOT EXISTS idx_credit_periods_order ON public.credit_periods(order_id);

-- Create trigger function to check credit period limit
CREATE OR REPLACE FUNCTION check_credit_period_limit()
RETURNS TRIGGER AS $$
DECLARE
  customer_credit_period_days INTEGER;
BEGIN
  -- Get customer's credit period days
  SELECT credit_period_days INTO customer_credit_period_days
  FROM public.customers
  WHERE id = NEW.customer_id;
  
  -- Check if period exceeds customer's credit period days
  IF NEW.period > customer_credit_period_days THEN
    RAISE EXCEPTION 'Credit period (%) exceeds customer''s allowed period (%)', 
                   NEW.period, customer_credit_period_days;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on credit_periods to check period limit before insert/update
CREATE TRIGGER check_credit_period_limit_trigger
BEFORE INSERT OR UPDATE ON public.credit_periods
FOR EACH ROW
EXECUTE FUNCTION check_credit_period_limit();

-- Add trigger function to check that total credit doesn't exceed customer's credit limit
CREATE OR REPLACE FUNCTION check_credit_limit()
RETURNS TRIGGER AS $$
DECLARE
  customer_credit_limit DECIMAL;
  customer_current_credit DECIMAL;
  new_total_credit DECIMAL;
BEGIN
  -- Get customer's credit limit
  SELECT credit_limit, current_credit INTO customer_credit_limit, customer_current_credit
  FROM public.customers
  WHERE id = NEW.customer_id;
  
  -- If this is a new credit, check that it doesn't exceed the limit
  IF NEW.type = 'credit' THEN
    -- Calculate new total credit
    new_total_credit := customer_current_credit + NEW.amount;
    
    -- Check if new total exceeds credit limit
    IF new_total_credit > customer_credit_limit THEN
      RAISE EXCEPTION 'Total credit (%) would exceed customer credit limit (%)', 
                       new_total_credit, customer_credit_limit;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on credit_periods to check credit limit before insert
CREATE TRIGGER check_credit_limit_trigger
BEFORE INSERT ON public.credit_periods
FOR EACH ROW
EXECUTE FUNCTION check_credit_limit();

-- Update existing credit_periods that are linked to orders in the system
UPDATE public.credit_periods cp
SET order_id = o.id
FROM public.orders o
WHERE o.payment_method IN ('full_credit', 'partial_payment')
AND cp.customer_id = (
  SELECT c.id 
  FROM public.customers c 
  WHERE c.user_id = o.user_id
)
AND cp.created_at BETWEEN o.created_at - INTERVAL '5 minutes' AND o.created_at + INTERVAL '5 minutes';

-- Comment explaining the update
COMMENT ON COLUMN public.credit_periods.order_id IS 'Links the credit period to a specific order'; 