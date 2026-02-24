-- Migration: Add RLS policies for brands table
-- Company isolation for brand management

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Company users can view brands" ON public.brands;
DROP POLICY IF EXISTS "Company admins and sales can insert brands" ON public.brands;
DROP POLICY IF EXISTS "Company admins and sales can update brands" ON public.brands;
DROP POLICY IF EXISTS "Company admins can delete brands" ON public.brands;

-- Company users can view brands in their company
CREATE POLICY "Company users can view brands"
  ON public.brands FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

-- Company admins and sales can insert brands
CREATE POLICY "Company admins and sales can insert brands"
  ON public.brands FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'sales')
    )
  );

-- Company admins and sales can update brands
CREATE POLICY "Company admins and sales can update brands"
  ON public.brands FOR UPDATE TO authenticated
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

-- Company admins can delete brands
CREATE POLICY "Company admins can delete brands"
  ON public.brands FOR DELETE TO authenticated
  USING (
    public.is_admin(auth.uid()) 
    AND company_id = public.current_company_id()
  );

