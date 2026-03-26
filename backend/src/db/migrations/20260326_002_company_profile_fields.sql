-- Company profile identity & contact
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS address      text,
  ADD COLUMN IF NOT EXISTS city         text,
  ADD COLUMN IF NOT EXISTS state        text,
  ADD COLUMN IF NOT EXISTS postal_code  text,
  ADD COLUMN IF NOT EXISTS country      text DEFAULT 'India',
  ADD COLUMN IF NOT EXISTS phone        text,
  ADD COLUMN IF NOT EXISTS email        text,
  ADD COLUMN IF NOT EXISTS gstin        text,
  ADD COLUMN IF NOT EXISTS logo_url     text,
  -- bank_details shape: [{ name, holder, account, ifsc, upi }]
  ADD COLUMN IF NOT EXISTS bank_details jsonb DEFAULT '[]'::jsonb;
