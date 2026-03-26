-- ============================================================
-- Migration: 20260326_001_cd_extra_charges_roundoff
-- Purpose  : Add Cash Discount (CD), Extra Charges, and Round-Off
--            support to customers, orders, and create credit_notes table.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1a. Customers table: CD configuration columns
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS cd_enabled          boolean       NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cd_percentage       numeric(5,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cd_days             integer       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cd_settlement_mode  text          NOT NULL DEFAULT 'direct'
    CHECK (cd_settlement_mode IN ('direct', 'credit_note'));

-- ──────────────────────────────────────────────────────────────
-- 1b. Orders table: CD + Extra Charges + Round-Off columns
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.orders
  -- Cash Discount fields
  ADD COLUMN IF NOT EXISTS cd_enabled         boolean       NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cd_percentage      numeric(5,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cd_amount          numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cd_days            integer       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cd_valid_until     date,
  ADD COLUMN IF NOT EXISTS cd_settlement_mode text          NOT NULL DEFAULT 'direct'
    CHECK (cd_settlement_mode IN ('direct', 'credit_note')),
  -- Financial breakdown
  ADD COLUMN IF NOT EXISTS taxable_value      numeric(12,2) NOT NULL DEFAULT 0,
  -- Extra charges (jsonb array of { label: string, amount: number })
  ADD COLUMN IF NOT EXISTS extra_charges      jsonb         NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS total_extra_charges numeric(12,2) NOT NULL DEFAULT 0,
  -- Round-off (signed, so can be negative)
  ADD COLUMN IF NOT EXISTS round_off_amount   numeric(6,2)  NOT NULL DEFAULT 0;

-- ──────────────────────────────────────────────────────────────
-- 1c. Credit Notes table
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.credit_notes (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_id         uuid          NOT NULL REFERENCES public.orders(id)    ON DELETE CASCADE,
  customer_id      uuid          REFERENCES public.customers(id)          ON DELETE SET NULL,
  cn_number        text          NOT NULL,
  cn_date          date          NOT NULL DEFAULT CURRENT_DATE,
  reason           text          NOT NULL DEFAULT 'Cash Discount',
  cd_percentage    numeric(5,2)  NOT NULL DEFAULT 0,
  amount           numeric(12,2) NOT NULL DEFAULT 0,   -- pre-tax CD amount
  tax_amount       numeric(12,2) NOT NULL DEFAULT 0,
  total_amount     numeric(12,2) NOT NULL DEFAULT 0,   -- amount + tax_amount
  status           text          NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'issued', 'applied', 'cancelled')),
  created_by       uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS credit_notes_set_updated_at ON public.credit_notes;
CREATE TRIGGER credit_notes_set_updated_at
  BEFORE UPDATE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ──────────────────────────────────────────────────────────────
-- RLS for credit_notes
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;

-- Company members can read their own credit notes
DROP POLICY IF EXISTS "credit_notes_select_company" ON public.credit_notes;
CREATE POLICY "credit_notes_select_company"
  ON public.credit_notes FOR SELECT
  USING (company_id = (
    SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1
  ));

-- Only authenticated users belonging to the same company can insert
DROP POLICY IF EXISTS "credit_notes_insert_company" ON public.credit_notes;
CREATE POLICY "credit_notes_insert_company"
  ON public.credit_notes FOR INSERT
  WITH CHECK (company_id = (
    SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1
  ));

-- Only authenticated users belonging to the same company can update
DROP POLICY IF EXISTS "credit_notes_update_company" ON public.credit_notes;
CREATE POLICY "credit_notes_update_company"
  ON public.credit_notes FOR UPDATE
  USING (company_id = (
    SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1
  ));

-- Service-role bypass (for backend use)
DROP POLICY IF EXISTS "credit_notes_service_role_all" ON public.credit_notes;
CREATE POLICY "credit_notes_service_role_all"
  ON public.credit_notes FOR ALL
  USING (auth.role() = 'service_role');

-- ──────────────────────────────────────────────────────────────
-- Indexes for performance
-- ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_credit_notes_company_id   ON public.credit_notes (company_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_order_id     ON public.credit_notes (order_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_customer_id  ON public.credit_notes (customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_status       ON public.credit_notes (status);
