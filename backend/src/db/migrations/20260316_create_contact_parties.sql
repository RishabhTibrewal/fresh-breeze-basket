-- Migration: Create contact_parties and unified party_ledger view
-- Purpose: Unify customers and suppliers into a single business partner model

-- 1. Create contact_parties table
CREATE TABLE IF NOT EXISTS public.contact_parties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  is_customer BOOLEAN NOT NULL DEFAULT FALSE,
  is_supplier BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Basic indexes for tenant scoping and lookup
CREATE INDEX IF NOT EXISTS idx_contact_parties_company
  ON public.contact_parties(company_id);

CREATE INDEX IF NOT EXISTS idx_contact_parties_company_name
  ON public.contact_parties(company_id, name);

CREATE INDEX IF NOT EXISTS idx_contact_parties_company_email
  ON public.contact_parties(company_id, email);

CREATE INDEX IF NOT EXISTS idx_contact_parties_company_phone
  ON public.contact_parties(company_id, phone);

-- 3. Enable Row Level Security; detailed policies are defined in the RLS migration
ALTER TABLE public.contact_parties ENABLE ROW LEVEL SECURITY;

-- 4. Link customers and suppliers to contact_parties via party_id
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS party_id UUID REFERENCES public.contact_parties(id);

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS party_id UUID REFERENCES public.contact_parties(id);

CREATE INDEX IF NOT EXISTS idx_customers_company_party
  ON public.customers(company_id, party_id);

CREATE INDEX IF NOT EXISTS idx_suppliers_company_party
  ON public.suppliers(company_id, party_id);

-- 5. Backfill contact_parties from existing customers
-- One party per (company_id, name, email, phone) combination
INSERT INTO public.contact_parties (company_id, name, email, phone, is_customer)
SELECT DISTINCT
  c.company_id,
  c.name,
  c.email,
  c.phone,
  TRUE
FROM public.customers c
WHERE c.company_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.contact_parties cp
    WHERE cp.company_id = c.company_id
      AND cp.name = c.name
      AND cp.email IS NOT DISTINCT FROM c.email
      AND cp.phone IS NOT DISTINCT FROM c.phone
  );

-- Attach customers to their parties
UPDATE public.customers c
SET party_id = cp.id
FROM public.contact_parties cp
WHERE cp.company_id = c.company_id
  AND cp.name = c.name
  AND cp.email IS NOT DISTINCT FROM c.email
  AND cp.phone IS NOT DISTINCT FROM c.phone
  AND (cp.is_customer = TRUE OR cp.is_supplier = TRUE);

-- 6. Backfill contact_parties from existing suppliers
INSERT INTO public.contact_parties (company_id, name, email, phone, is_supplier)
SELECT DISTINCT
  s.company_id,
  s.name,
  s.email,
  s.phone,
  TRUE
FROM public.suppliers s
WHERE s.company_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.contact_parties cp
    WHERE cp.company_id = s.company_id
      AND cp.name = s.name
      AND cp.email IS NOT DISTINCT FROM s.email
      AND cp.phone IS NOT DISTINCT FROM s.phone
  );

-- Attach suppliers to their parties
UPDATE public.suppliers s
SET party_id = cp.id
FROM public.contact_parties cp
WHERE cp.company_id = s.company_id
  AND cp.name = s.name
  AND cp.email IS NOT DISTINCT FROM s.email
  AND cp.phone IS NOT DISTINCT FROM s.phone
  AND (cp.is_customer = TRUE OR cp.is_supplier = TRUE);

-- 7. Ensure flags reflect actual links
UPDATE public.contact_parties cp
SET is_customer = TRUE
WHERE EXISTS (
  SELECT 1
  FROM public.customers c
  WHERE c.party_id = cp.id
);

UPDATE public.contact_parties cp
SET is_supplier = TRUE
WHERE EXISTS (
  SELECT 1
  FROM public.suppliers s
  WHERE s.party_id = cp.id
);

-- 8. Unified party_ledger view
-- NOTE: This first version focuses on sales orders (receivables) and
-- purchase invoices (payables). Payments can be added later.

CREATE OR REPLACE VIEW public.party_ledger AS
  -- Receivables: sales orders linked via customers -> auth.users
  SELECT
    cp.id            AS party_id,
    cp.company_id    AS company_id,
    cp.name          AS name,
    'receivable'     AS ledger_side,
    'sale'           AS doc_type,
    o.id             AS doc_id,
    o.total_amount   AS amount,
    o.created_at     AS doc_date,
    o.status         AS status
  FROM public.contact_parties cp
  JOIN public.customers c
    ON c.party_id = cp.id
  JOIN public.orders o
    ON o.user_id = c.user_id
   AND o.company_id = cp.company_id
  WHERE cp.is_customer = TRUE
    AND c.user_id IS NOT NULL

  UNION ALL

  -- Payables: purchase invoices via suppliers -> purchase_orders
  SELECT
    cp.id             AS party_id,
    cp.company_id     AS company_id,
    cp.name           AS name,
    'payable'         AS ledger_side,
    'purchase'        AS doc_type,
    pi.id             AS doc_id,
    pi.total_amount   AS amount,
    pi.invoice_date   AS doc_date,
    pi.status         AS status
  FROM public.contact_parties cp
  JOIN public.suppliers s
    ON s.party_id = cp.id
  JOIN procurement.purchase_orders po
    ON po.supplier_id = s.id
   AND po.company_id = cp.company_id
  JOIN procurement.purchase_invoices pi
    ON pi.purchase_order_id = po.id
   AND pi.company_id = cp.company_id
  WHERE cp.is_supplier = TRUE;

