-- Add payment and website configuration fields to companies table
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS payment_upi_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_qr_code_url TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS website_qr_code_url TEXT,
  ADD COLUMN IF NOT EXISTS invoice_custom_message TEXT;
