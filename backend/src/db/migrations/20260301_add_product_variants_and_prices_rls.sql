-- Migration: Add RLS policies for product_variants and product_prices tables
-- Both tables are central to the e-commerce storefront and must be readable
-- by unauthenticated visitors (public product catalogue) as well as by
-- authenticated company members.
--
-- Security model:
--   SELECT  → public (anon) + authenticated — prices/variants are catalogue data
--   INSERT  → admin + sales roles only (company-scoped)
--   UPDATE  → admin + sales roles only (company-scoped)
--   DELETE  → admin role only (company-scoped)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. product_variants
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- Drop any stale policies first so re-running this migration is idempotent
DROP POLICY IF EXISTS "Anyone can view product variants"           ON public.product_variants;
DROP POLICY IF EXISTS "Company users can view product variants"    ON public.product_variants;
DROP POLICY IF EXISTS "Company admins and sales can insert variants" ON public.product_variants;
DROP POLICY IF EXISTS "Company admins and sales can update variants" ON public.product_variants;
DROP POLICY IF EXISTS "Company admins can delete variants"          ON public.product_variants;

-- Public read: product catalogue data must be visible to anonymous storefront visitors
CREATE POLICY "Anyone can view product variants"
  ON public.product_variants FOR SELECT
  TO public   -- includes both anon and authenticated roles
  USING (true);

-- Insert: only admin / sales within the correct company
CREATE POLICY "Company admins and sales can insert variants"
  ON public.product_variants FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'sales')
    )
  );

-- Update: only admin / sales within the correct company
CREATE POLICY "Company admins and sales can update variants"
  ON public.product_variants FOR UPDATE
  TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'sales')
    )
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'sales')
    )
  );

-- Delete: admin only
CREATE POLICY "Company admins can delete variants"
  ON public.product_variants FOR DELETE
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    AND company_id = public.current_company_id()
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. product_prices
-- ─────────────────────────────────────────────────────────────────────────────

-- RLS was already enabled in 20260128_create_product_prices.sql,
-- but no policies were ever added — so all anon/authenticated reads were
-- silently blocked, causing the nested PostgREST join to fail and returning
-- empty variant arrays on the storefront.

ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;

-- Drop any stale policies
DROP POLICY IF EXISTS "Anyone can view product prices"              ON public.product_prices;
DROP POLICY IF EXISTS "Company users can view product prices"       ON public.product_prices;
DROP POLICY IF EXISTS "Company admins and sales can insert prices"  ON public.product_prices;
DROP POLICY IF EXISTS "Company admins and sales can update prices"  ON public.product_prices;
DROP POLICY IF EXISTS "Company admins can delete prices"            ON public.product_prices;

-- Public read: prices are catalogue data — must be visible to storefront visitors
CREATE POLICY "Anyone can view product prices"
  ON public.product_prices FOR SELECT
  TO public   -- includes both anon and authenticated roles
  USING (true);

-- Insert: only admin / sales within the correct company
CREATE POLICY "Company admins and sales can insert prices"
  ON public.product_prices FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'sales')
    )
  );

-- Update: only admin / sales within the correct company
CREATE POLICY "Company admins and sales can update prices"
  ON public.product_prices FOR UPDATE
  TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'sales')
    )
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'sales')
    )
  );

-- Delete: admin only
CREATE POLICY "Company admins can delete prices"
  ON public.product_prices FOR DELETE
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    AND company_id = public.current_company_id()
  );

