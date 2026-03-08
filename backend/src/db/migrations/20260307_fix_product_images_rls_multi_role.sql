-- Fix product_images RLS policy to use multi-role system instead of profiles.role
-- The policy was checking is_admin() which doesn't work with the new user_roles table

-- Drop the old policy that uses is_admin()
DROP POLICY IF EXISTS "Company admins can manage product images" ON public.product_images;

-- Create new policy that uses the multi-role system
-- This allows admins and sales to create/manage product images for their company
CREATE POLICY "Company admins and sales can manage product images"
  ON public.product_images FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      -- Check if user has admin or sales role using the new role system
      -- Direct check on user_roles table with company_id from the product_images row
      EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND ur.company_id = product_images.company_id
        AND r.name IN ('admin', 'sales')
      )
      OR
      -- Fallback: check company_memberships for backward compatibility
      EXISTS (
        SELECT 1 FROM public.company_memberships
        WHERE company_memberships.user_id = auth.uid()
        AND company_memberships.company_id = product_images.company_id
        AND company_memberships.role IN ('admin', 'sales')
        AND company_memberships.is_active = true
      )
    )
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND (
      -- Check if user has admin or sales role using the new role system
      -- Direct check on user_roles table with company_id from the product_images row being inserted
      EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND ur.company_id = product_images.company_id
        AND r.name IN ('admin', 'sales')
      )
      OR
      -- Fallback: check company_memberships for backward compatibility
      EXISTS (
        SELECT 1 FROM public.company_memberships
        WHERE company_memberships.user_id = auth.uid()
        AND company_memberships.company_id = product_images.company_id
        AND company_memberships.role IN ('admin', 'sales')
        AND company_memberships.is_active = true
      )
    )
  );

-- Add comment
COMMENT ON POLICY "Company admins and sales can manage product images" ON public.product_images IS 
'Allows admins and sales to create and manage product images for their company. Uses the multi-role system (user_roles table) with fallback to company_memberships.';

