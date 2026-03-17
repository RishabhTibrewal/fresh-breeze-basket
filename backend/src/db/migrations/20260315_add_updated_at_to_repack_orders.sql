-- Add updated_at to repack_orders (required by process_repack_order RPC)

ALTER TABLE public.repack_orders
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

COMMENT ON COLUMN public.repack_orders.updated_at IS 'Last updated timestamp';
