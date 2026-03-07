-- Fix orders RLS policy to use multi-role system instead of profiles.role
-- The policy was checking profiles.role which doesn't work with the new user_roles table

-- Drop the old policy that uses profiles.role
DROP POLICY IF EXISTS "Company admins and sales can manage orders" ON public.orders;

-- Create new policy that uses the multi-role system
-- This allows admins and sales to create/manage orders for any customer in their company
CREATE POLICY "Company admins and sales can manage orders"
  ON public.orders FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      -- Check if user has admin or sales role using the new role system
      -- Direct check on user_roles table with company_id from the order
      EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND ur.company_id = orders.company_id
        AND r.name IN ('admin', 'sales')
      )
      OR
      -- Fallback: check company_memberships for backward compatibility
      EXISTS (
        SELECT 1 FROM public.company_memberships
        WHERE company_memberships.user_id = auth.uid()
        AND company_memberships.company_id = orders.company_id
        AND company_memberships.role IN ('admin', 'sales')
        AND company_memberships.is_active = true
      )
    )
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND (
      -- Check if user has admin or sales role using the new role system
      -- Direct check on user_roles table with company_id from the order being inserted
      EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND ur.company_id = orders.company_id
        AND r.name IN ('admin', 'sales')
      )
      OR
      -- Fallback: check company_memberships for backward compatibility
      EXISTS (
        SELECT 1 FROM public.company_memberships
        WHERE company_memberships.user_id = auth.uid()
        AND company_memberships.company_id = orders.company_id
        AND company_memberships.role IN ('admin', 'sales')
        AND company_memberships.is_active = true
      )
    )
  );

-- Also add a policy to allow users to create their own orders (for e-commerce)
-- This is separate from the admin/sales policy
DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;
CREATE POLICY "Users can create their own orders"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND user_id = auth.uid()
  );

-- Add comment
COMMENT ON POLICY "Company admins and sales can manage orders" ON public.orders IS 
'Allows admins and sales to create and manage orders for any customer in their company. Uses the multi-role system (user_roles table) with fallback to company_memberships.';

