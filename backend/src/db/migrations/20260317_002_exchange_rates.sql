-- Create exchange_rates table for multi-currency report conversion.
-- Rate is how many units of to_currency equal 1 unit of from_currency.

CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id             UUID        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  from_currency  VARCHAR(10) NOT NULL,
  to_currency    VARCHAR(10) NOT NULL,
  rate           NUMERIC(18,6) NOT NULL CHECK (rate > 0),
  effective_date DATE        NOT NULL,
  company_id     UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (from_currency, to_currency, effective_date, company_id)
);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_lookup
  ON public.exchange_rates (company_id, from_currency, to_currency, effective_date DESC);

-- Enable RLS (consistent with all other company tables)
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_exchange_rates_select"
  ON public.exchange_rates FOR SELECT
  USING (company_id = current_setting('app.current_company_id', true)::UUID);

CREATE POLICY "company_exchange_rates_insert"
  ON public.exchange_rates FOR INSERT
  WITH CHECK (company_id = current_setting('app.current_company_id', true)::UUID);

CREATE POLICY "company_exchange_rates_update"
  ON public.exchange_rates FOR UPDATE
  USING (company_id = current_setting('app.current_company_id', true)::UUID);
