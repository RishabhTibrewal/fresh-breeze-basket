-- Migration: Create brands table
-- Supports brand management for products and variants
-- Multi-tenant isolation via company_id

CREATE TABLE IF NOT EXISTS public.brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT,
  legal_name TEXT,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, slug)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_brands_company_id ON public.brands(company_id);
CREATE INDEX IF NOT EXISTS idx_brands_slug ON public.brands(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_brands_is_active ON public.brands(is_active);

-- Add RLS policies (will be configured based on company isolation)
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

-- Add comments for documentation
COMMENT ON TABLE public.brands IS 'Brand management table - supports multi-tenant brand isolation';
COMMENT ON COLUMN public.brands.company_id IS 'Multi-tenant isolation - brands are scoped to companies';
COMMENT ON COLUMN public.brands.name IS 'Display name (e.g., Nature''s Try)';
COMMENT ON COLUMN public.brands.slug IS 'URL/SEO friendly identifier (e.g., natures-try)';
COMMENT ON COLUMN public.brands.legal_name IS 'Optional legal name (useful for invoices/brand ownership)';
COMMENT ON COLUMN public.brands.logo_url IS 'Brand logo URL (for website, Amazon brand store, etc.)';
COMMENT ON COLUMN public.brands.is_active IS 'Whether the brand is currently active';

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_brands_updated_at
    BEFORE UPDATE ON public.brands
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

