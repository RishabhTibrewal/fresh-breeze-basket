-- Migration: Create taxes table
-- Centralized tax management system
-- Supports multiple tax types (GST, VAT, etc.) per company

CREATE TABLE IF NOT EXISTS public.taxes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL, -- e.g., "GST", "VAT", "Sales Tax"
  code VARCHAR(50) NOT NULL, -- e.g., "GST", "VAT", "ST"
  rate DECIMAL(5,2) NOT NULL, -- percentage (e.g., 5.00 for 5%, 18.00 for 18%)
  is_active BOOLEAN DEFAULT true,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, code)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_taxes_company_id ON public.taxes(company_id);
CREATE INDEX IF NOT EXISTS idx_taxes_code ON public.taxes(code);
CREATE INDEX IF NOT EXISTS idx_taxes_active ON public.taxes(is_active) WHERE is_active = true;

-- Add RLS policies (will be configured based on company isolation)
ALTER TABLE public.taxes ENABLE ROW LEVEL SECURITY;

-- Add constraint to ensure rate is positive
ALTER TABLE public.taxes
ADD CONSTRAINT check_positive_rate 
CHECK (rate >= 0 AND rate <= 100);

-- Add comments for documentation
COMMENT ON TABLE public.taxes IS 'Tax management system - supports multiple tax types per company';
COMMENT ON COLUMN public.taxes.code IS 'Tax code identifier (e.g., "GST", "VAT") - unique per company';
COMMENT ON COLUMN public.taxes.rate IS 'Tax rate as percentage (e.g., 5.00 for 5%, 18.00 for 18%)';

