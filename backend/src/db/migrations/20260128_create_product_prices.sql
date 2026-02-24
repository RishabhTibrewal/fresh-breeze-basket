-- Migration: Create product_prices table
-- Supports flexible pricing by outlet, variant, and price type
-- Allows different prices for different outlets, bulk pricing, sale pricing, etc.

CREATE TABLE IF NOT EXISTS public.product_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
  outlet_id UUID REFERENCES public.warehouses(id), -- NULL = applies to all outlets
  price_type VARCHAR(50) DEFAULT 'standard', -- standard, sale, bulk, wholesale, etc.
  amount DECIMAL(10,2) NOT NULL,
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  valid_until TIMESTAMP WITH TIME ZONE, -- NULL = no expiration
  company_id UUID NOT NULL REFERENCES public.companies(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, variant_id, outlet_id, price_type, company_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_product_prices_product_id ON public.product_prices(product_id);
CREATE INDEX IF NOT EXISTS idx_product_prices_variant_id ON public.product_prices(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_prices_outlet_id ON public.product_prices(outlet_id) WHERE outlet_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_prices_company_id ON public.product_prices(company_id);
CREATE INDEX IF NOT EXISTS idx_product_prices_valid_dates ON public.product_prices(valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_product_prices_price_type ON public.product_prices(price_type);

-- Add RLS policies (will be configured based on company isolation)
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;

-- Add constraint to ensure at least product_id or variant_id is provided
ALTER TABLE public.product_prices
ADD CONSTRAINT check_product_or_variant 
CHECK (product_id IS NOT NULL);

-- Add comments for documentation
COMMENT ON TABLE public.product_prices IS 'Flexible pricing system supporting outlet-specific, variant-specific, and time-based pricing';
COMMENT ON COLUMN public.product_prices.outlet_id IS 'NULL = applies to all outlets, specific UUID = outlet-specific pricing';
COMMENT ON COLUMN public.product_prices.price_type IS 'Type of price: standard, sale, bulk, wholesale, etc.';
COMMENT ON COLUMN public.product_prices.valid_from IS 'Price becomes active from this timestamp';
COMMENT ON COLUMN public.product_prices.valid_until IS 'Price expires at this timestamp (NULL = no expiration)';

