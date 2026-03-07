-- Fix order_items RLS policy to use multi-role system instead of profiles.role
-- The policy was checking profiles.role which doesn't work with the new user_roles table

-- Drop old policies that use profiles.role
DROP POLICY IF EXISTS "Company admins and sales can manage order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can create their own order items" ON public.order_items;

-- Create new policy that uses multi-role system
-- This allows admins and sales to create/manage order items for any order in their company
CREATE POLICY "Company admins and sales can manage order items"
  ON public.order_items FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      -- Check if user has admin or sales role using the new role system
      EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND ur.company_id = order_items.company_id
        AND r.name IN ('admin', 'sales')
      )
      OR
      -- Fallback: check company_memberships for backward compatibility
      EXISTS (
        SELECT 1 FROM public.company_memberships
        WHERE company_memberships.user_id = auth.uid()
        AND company_memberships.company_id = order_items.company_id
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
        AND ur.company_id = order_items.company_id
        AND r.name IN ('admin', 'sales')
      )
      OR
      -- Fallback: check company_memberships for backward compatibility
      EXISTS (
        SELECT 1 FROM public.company_memberships
        WHERE company_memberships.user_id = auth.uid()
        AND company_memberships.company_id = order_items.company_id
        AND company_memberships.role IN ('admin', 'sales')
        AND company_memberships.is_active = true
      )
    )
  );

-- Policy to allow users to create order items for their own orders (for e-commerce)
CREATE POLICY "Users can create their own order items"
  ON public.order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
      AND orders.company_id = order_items.company_id
    )
  );

-- Policy to allow users to view their own order items
DROP POLICY IF EXISTS "Company users can view their order items" ON public.order_items;
CREATE POLICY "Company users can view their order items"
  ON public.order_items FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      -- User owns the order
      EXISTS (
        SELECT 1 FROM public.orders
        WHERE orders.id = order_items.order_id
        AND orders.user_id = auth.uid()
        AND orders.company_id = order_items.company_id
      )
      OR
      -- Sales executive viewing order items for their customer's order
      EXISTS (
        SELECT 1 FROM public.orders
        INNER JOIN public.customers ON customers.user_id = orders.user_id
        WHERE orders.id = order_items.order_id
        AND customers.sales_executive_id = auth.uid()
        AND orders.company_id = order_items.company_id
        AND customers.company_id = order_items.company_id
      )
      OR
      -- Admin or sales can view any order items in their company
      EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND ur.company_id = order_items.company_id
        AND r.name IN ('admin', 'sales')
      )
    )
  );

-- Add comment
COMMENT ON POLICY "Company admins and sales can manage order items" ON public.order_items IS 
'Allows admins and sales to create and manage order items for any order in their company. Uses the multi-role system (user_roles table) with fallback to company_memberships.';

