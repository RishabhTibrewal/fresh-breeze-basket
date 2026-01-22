-- Fix warehouses code unique constraint to be company-scoped
-- This allows different companies to have warehouses with the same code

-- Drop the existing unique constraint on code
ALTER TABLE public.warehouses 
DROP CONSTRAINT IF EXISTS warehouses_code_key;

-- Drop the index if it exists (it might be named differently)
DROP INDEX IF EXISTS public.idx_warehouses_code;

-- Create a composite unique constraint on (company_id, code)
-- This ensures warehouse codes are unique within each company, but different companies can have the same code
ALTER TABLE public.warehouses 
ADD CONSTRAINT warehouses_company_code_unique UNIQUE (company_id, code);

-- Recreate the index for faster lookups (now including company_id)
CREATE INDEX IF NOT EXISTS idx_warehouses_company_code ON public.warehouses(company_id, code);

-- Also create a separate index on code for general queries (non-unique now)
CREATE INDEX IF NOT EXISTS idx_warehouses_code ON public.warehouses(code);
