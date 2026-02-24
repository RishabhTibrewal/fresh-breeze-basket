-- Migration: Create feature_flags table
-- Feature flag system for enabling/disabling features at company or outlet level
-- Supports feature flags like barcode, inventory, tables (future), kitchen (future)

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES public.companies(id), -- NULL = global flag
  outlet_id UUID REFERENCES public.warehouses(id), -- NULL = company-wide flag
  flag_name VARCHAR(100) NOT NULL, -- barcode, inventory, tables, kitchen, etc.
  is_enabled BOOLEAN DEFAULT false,
  config JSONB, -- additional configuration for the feature
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, outlet_id, flag_name)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_feature_flags_company_id ON public.feature_flags(company_id);
CREATE INDEX IF NOT EXISTS idx_feature_flags_outlet_id ON public.feature_flags(outlet_id) WHERE outlet_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_feature_flags_flag_name ON public.feature_flags(flag_name);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON public.feature_flags(is_enabled) WHERE is_enabled = true;

-- Add RLS policies (will be configured based on company isolation)
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Add constraint to ensure at least company_id is provided (or both NULL for global)
ALTER TABLE public.feature_flags
ADD CONSTRAINT check_company_or_global 
CHECK (
  (company_id IS NOT NULL) OR 
  (company_id IS NULL AND outlet_id IS NULL)
);

-- Add comments for documentation
COMMENT ON TABLE public.feature_flags IS 'Feature flag system - enables/disables features at company or outlet level';
COMMENT ON COLUMN public.feature_flags.company_id IS 'NULL = global flag, UUID = company-specific flag';
COMMENT ON COLUMN public.feature_flags.outlet_id IS 'NULL = company-wide, UUID = outlet-specific flag';
COMMENT ON COLUMN public.feature_flags.flag_name IS 'Feature name: barcode, inventory, tables, kitchen, etc.';
COMMENT ON COLUMN public.feature_flags.config IS 'Additional JSON configuration for the feature';

