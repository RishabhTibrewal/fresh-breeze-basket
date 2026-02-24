-- Migration: Add RLS policies for stock_movements table
-- Ensures company-level data isolation and proper access control

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Company users can view stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Company admins can manage stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Warehouse managers can manage stock movements" ON public.stock_movements;

-- Policy: All authenticated users can view stock movements for their company
CREATE POLICY "Company users can view stock movements"
  ON public.stock_movements FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

-- Policy: Admins can manage all stock movements
CREATE POLICY "Company admins can manage stock movements"
  ON public.stock_movements FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid())
    AND company_id = public.current_company_id()
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    AND company_id = public.current_company_id()
  );

-- Policy: Warehouse managers can create stock movements for their assigned warehouses
-- Note: Stock movements are audit records, so warehouse managers can only INSERT, not UPDATE/DELETE
DROP POLICY IF EXISTS "Warehouse managers can create stock movements"
ON public.stock_movements;

CREATE POLICY "Warehouse managers can create stock movements"
ON public.stock_movements
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_warehouse_manager(auth.uid())
  AND company_id = public.current_company_id()
  AND public.has_warehouse_access(
        auth.uid(),
        outlet_id,
        public.current_company_id()
      )
);


-- Add comment
COMMENT ON TABLE public.stock_movements IS 'Audit trail for all inventory movements. RLS policies ensure company-level isolation and role-based access control.';

