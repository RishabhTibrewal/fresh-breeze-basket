-- Migration: Initialize modules for companies that don't have any modules enabled
-- This fixes companies created before module initialization was added to company creation

-- Default modules that should be enabled for all companies
INSERT INTO public.company_modules (company_id, module_code, is_enabled, settings)
SELECT 
  c.id,
  module_code,
  true,
  '{}'::jsonb
FROM public.companies c
CROSS JOIN (
  VALUES 
    ('ecommerce'),
    ('sales'),
    ('inventory'),
    ('procurement'),
    ('accounting'),
    ('reports'),
    ('pos'),
    ('settings')
) AS modules(module_code)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.company_modules cm
  WHERE cm.company_id = c.id
    AND cm.module_code = modules.module_code
)
ON CONFLICT (company_id, module_code) DO NOTHING;

-- Add comment
COMMENT ON TABLE public.company_modules IS 'Company-level module enablement. All companies should have all modules enabled by default.';

