-- Fix order_status_history RLS policy and trigger function
-- 1. Update trigger function to include company_id and use SECURITY DEFINER
-- 2. Update RLS policy to use multi-role system instead of profiles.role

-- Update the trigger function to include company_id and make it SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.create_order_status_history()
RETURNS TRIGGER AS $$
BEGIN
    -- Create a status history entry when order status changes
    IF (TG_OP = 'UPDATE' AND OLD.status != NEW.status) OR TG_OP = 'INSERT' THEN
        INSERT INTO public.order_status_history (order_id, status, notes, company_id)
        VALUES (NEW.id, NEW.status, 'Status updated', NEW.company_id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old policies that use profiles.role
DROP POLICY IF EXISTS "Company admins and sales can manage order status history" ON public.order_status_history;
DROP POLICY IF EXISTS "Allow order status history creation via triggers" ON public.order_status_history;
DROP POLICY IF EXISTS "Admins and sales can manage all order status history" ON public.order_status_history;

-- Create new policy that uses multi-role system
-- This allows admins and sales to manage order status history
CREATE POLICY "Company admins and sales can manage order status history"
  ON public.order_status_history FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      -- Check if user has admin or sales role using the new role system
      EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND ur.company_id = order_status_history.company_id
        AND r.name IN ('admin', 'sales')
      )
      OR
      -- Fallback: check company_memberships for backward compatibility
      EXISTS (
        SELECT 1 FROM public.company_memberships
        WHERE company_memberships.user_id = auth.uid()
        AND company_memberships.company_id = order_status_history.company_id
        AND company_memberships.role IN ('admin', 'sales')
        AND company_memberships.is_active = true
      )
    )
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND (
      -- Check if user has admin or sales role using the new role system
      EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND ur.company_id = order_status_history.company_id
        AND r.name IN ('admin', 'sales')
      )
      OR
      -- Fallback: check company_memberships for backward compatibility
      EXISTS (
        SELECT 1 FROM public.company_memberships
        WHERE company_memberships.user_id = auth.uid()
        AND company_memberships.company_id = order_status_history.company_id
        AND company_memberships.role IN ('admin', 'sales')
        AND company_memberships.is_active = true
      )
    )
  );

-- Policy to allow users to view their own order status history
DROP POLICY IF EXISTS "Company users can view order status history" ON public.order_status_history;
CREATE POLICY "Company users can view order status history"
  ON public.order_status_history FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_status_history.order_id
      AND orders.user_id = auth.uid()
      AND orders.company_id = order_status_history.company_id
    )
  );

-- Add comment
COMMENT ON FUNCTION public.create_order_status_history() IS 
'Creates order status history entries when orders are created or status changes. Uses SECURITY DEFINER to bypass RLS.';

COMMENT ON POLICY "Company admins and sales can manage order status history" ON public.order_status_history IS 
'Allows admins and sales to manage order status history for orders in their company. Uses the multi-role system (user_roles table) with fallback to company_memberships.';

