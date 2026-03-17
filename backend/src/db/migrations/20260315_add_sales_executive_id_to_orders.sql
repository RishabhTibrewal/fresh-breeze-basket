-- Migration: Add optional sales_executive_id to orders table
-- Links orders to the sales executive (auth.users) who created or is assigned to the order.

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS sales_executive_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_sales_executive_id ON public.orders(sales_executive_id);

COMMENT ON COLUMN public.orders.sales_executive_id IS 'Optional: sales executive (user) linked to this order. Defaults to creator when they have sales role.';
