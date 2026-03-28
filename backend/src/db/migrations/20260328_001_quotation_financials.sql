-- ============================================================
-- Migration: 20260328_001_quotations_financials
-- Purpose  : Add Extra Charges and Round-Off to Quotations
--            to standardize with Orders calculation logic.
-- ============================================================

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS taxable_value      numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_charges      jsonb         NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS total_extra_charges numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS round_off_amount   numeric(6,2)  NOT NULL DEFAULT 0;
