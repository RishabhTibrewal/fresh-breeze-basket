-- Fix suppliers code unique constraint to be company-scoped
-- This allows different companies to have suppliers with the same code

-- Drop the existing unique constraint on supplier_code
ALTER TABLE public.suppliers 
DROP CONSTRAINT IF EXISTS suppliers_supplier_code_key;

-- Create a composite unique constraint on (company_id, supplier_code)
-- This ensures supplier codes are unique within each company, but different companies can have the same code
ALTER TABLE public.suppliers 
ADD CONSTRAINT suppliers_company_code_unique UNIQUE (company_id, supplier_code);

-- Recreate the index for faster lookups (now including company_id)
CREATE INDEX IF NOT EXISTS idx_suppliers_company_code ON public.suppliers(company_id, supplier_code);
