-- Add settings module to existing companies
-- This migration ensures that the settings module is enabled for all existing companies
INSERT INTO public.company_modules (company_id, module_code, is_enabled)
SELECT c.id, 'settings', true
FROM public.companies c
WHERE NOT EXISTS (
    SELECT 1
    FROM public.company_modules cm
    WHERE cm.company_id = c.id
      AND cm.module_code = 'settings'
)
ON CONFLICT (company_id, module_code) DO NOTHING;
