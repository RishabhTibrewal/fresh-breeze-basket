-- Replace deprecated profiles.role with user_roles/roles-based checks for customers table.
-- Sales executives can view and manage all company customers (not restricted by sales_executive_id).

DROP POLICY IF EXISTS "Company sales can view customers" ON public.customers;
DROP POLICY IF EXISTS "Company sales can manage customers" ON public.customers;

CREATE POLICY "Company sales can view customers"
  ON public.customers FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.is_admin_or_sales(auth.uid())
  );

CREATE POLICY "Company sales can manage customers"
  ON public.customers FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.is_admin_or_sales(auth.uid())
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.is_admin_or_sales(auth.uid())
  );
