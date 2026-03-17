-- Add RLS policies for contact_parties table
-- Uses tenant scoping via current_company_id() and role checks via is_admin_or_sales()

ALTER TABLE public.contact_parties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company sales can view contact_parties" ON public.contact_parties;
DROP POLICY IF EXISTS "Company sales can manage contact_parties" ON public.contact_parties;

CREATE POLICY "Company sales can view contact_parties"
  ON public.contact_parties
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.is_admin_or_sales(auth.uid())
  );

CREATE POLICY "Company sales can manage contact_parties"
  ON public.contact_parties
  FOR ALL
  TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.is_admin_or_sales(auth.uid())
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.is_admin_or_sales(auth.uid())
  );

