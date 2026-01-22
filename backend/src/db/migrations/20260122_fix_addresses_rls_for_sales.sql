-- Fix addresses RLS policies to allow sales executives to create addresses for their customers
-- The issue: Sales executives were blocked from creating addresses because the address user_id
-- doesn't match their auth.uid() (it matches the customer's user_id instead)

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Admin has full access to all addresses" ON public.addresses;
DROP POLICY IF EXISTS "Enable delete for users to their own addresses" ON public.addresses;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.addresses;
DROP POLICY IF EXISTS "Enable read access for users to their own addresses" ON public.addresses;
DROP POLICY IF EXISTS "Enable update for users to their own addresses" ON public.addresses;
DROP POLICY IF EXISTS "Company admins can manage all addresses" ON public.addresses;
DROP POLICY IF EXISTS "Users can manage their own addresses" ON public.addresses;
DROP POLICY IF EXISTS "Sales can manage customer addresses" ON public.addresses;

-- Admins can manage all addresses in their company
CREATE POLICY "Company admins can manage all addresses"
  ON public.addresses FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND company_id = public.current_company_id())
  WITH CHECK (public.is_admin(auth.uid()) AND company_id = public.current_company_id());

-- Users can manage their own addresses
CREATE POLICY "Users can manage their own addresses"
  ON public.addresses FOR ALL TO authenticated
  USING (auth.uid() = user_id AND company_id = public.current_company_id())
  WITH CHECK (auth.uid() = user_id AND company_id = public.current_company_id());

-- Sales executives can manage addresses for their customers
CREATE POLICY "Sales can manage customer addresses"
  ON public.addresses FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.is_admin_or_sales(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.customers
      WHERE customers.user_id = addresses.user_id
        AND customers.sales_executive_id = auth.uid()
        AND customers.company_id = public.current_company_id()
    )
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.is_admin_or_sales(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.customers
      WHERE customers.user_id = addresses.user_id
        AND customers.sales_executive_id = auth.uid()
        AND customers.company_id = public.current_company_id()
    )
  );
