-- Update warehouse inventory RLS policies for warehouse managers

-- Drop existing policies
DROP POLICY IF EXISTS "Company admins can manage warehouse inventory" ON public.warehouse_inventory;
DROP POLICY IF EXISTS "Company users can view warehouse inventory" ON public.warehouse_inventory;

-- Policy: Admins can manage all warehouse inventory
CREATE POLICY "Company admins can manage warehouse inventory"
  ON public.warehouse_inventory FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid()) 
    AND company_id = public.current_company_id()
  )
  WITH CHECK (
    public.is_admin(auth.uid()) 
    AND company_id = public.current_company_id()
  );

-- Policy: Warehouse managers can manage inventory for their assigned warehouses
CREATE POLICY "Warehouse managers can manage their warehouse inventory"
  ON public.warehouse_inventory FOR ALL TO authenticated
  USING (
    public.is_warehouse_manager(auth.uid())
    AND company_id = public.current_company_id()
    AND public.has_warehouse_access(auth.uid(), warehouse_id, public.current_company_id())
  )
  WITH CHECK (
    public.is_warehouse_manager(auth.uid())
    AND company_id = public.current_company_id()
    AND public.has_warehouse_access(auth.uid(), warehouse_id, public.current_company_id())
  );

-- Policy: All authenticated users can view warehouse inventory (for their company)
CREATE POLICY "Company users can view warehouse inventory"
  ON public.warehouse_inventory FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

