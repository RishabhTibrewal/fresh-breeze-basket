-- Ensure one customer record and one supplier record per party inside a company.
-- This enforces the "single party, multiple roles" model and prevents duplicate counterparts.

CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_company_party_id
  ON public.customers(company_id, party_id)
  WHERE party_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_suppliers_company_party_id
  ON public.suppliers(company_id, party_id)
  WHERE party_id IS NOT NULL;
