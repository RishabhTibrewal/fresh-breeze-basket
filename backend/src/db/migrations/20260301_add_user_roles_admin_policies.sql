-- Add RLS policies to allow admins to manage user_roles
-- This ensures admins can INSERT/UPDATE/DELETE user_roles even if service role isn't working
-- Uses company_memberships to check admin status (avoids circular dependency with user_roles)

-- Admins can insert user_roles for users in their company
DROP POLICY IF EXISTS "Admins can insert user_roles in their company" ON public.user_roles;
CREATE POLICY "Admins can insert user_roles in their company"
    ON public.user_roles FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Check company_memberships for admin role (no circular dependency)
        EXISTS (
            SELECT 1
            FROM public.company_memberships cm
            WHERE cm.user_id = auth.uid()
            AND cm.company_id = user_roles.company_id
            AND cm.role = 'admin'
            AND cm.is_active = true
        )
    );

-- Admins can update user_roles for users in their company
DROP POLICY IF EXISTS "Admins can update user_roles in their company" ON public.user_roles;
CREATE POLICY "Admins can update user_roles in their company"
    ON public.user_roles FOR UPDATE
    TO authenticated
    USING (
        -- Check company_memberships for admin role (no circular dependency)
        EXISTS (
            SELECT 1
            FROM public.company_memberships cm
            WHERE cm.user_id = auth.uid()
            AND cm.company_id = user_roles.company_id
            AND cm.role = 'admin'
            AND cm.is_active = true
        )
    )
    WITH CHECK (
        -- Check company_memberships for admin role (no circular dependency)
        EXISTS (
            SELECT 1
            FROM public.company_memberships cm
            WHERE cm.user_id = auth.uid()
            AND cm.company_id = user_roles.company_id
            AND cm.role = 'admin'
            AND cm.is_active = true
        )
    );

-- Admins can delete user_roles for users in their company
DROP POLICY IF EXISTS "Admins can delete user_roles in their company" ON public.user_roles;
CREATE POLICY "Admins can delete user_roles in their company"
    ON public.user_roles FOR DELETE
    TO authenticated
    USING (
        -- Check company_memberships for admin role (no circular dependency)
        EXISTS (
            SELECT 1
            FROM public.company_memberships cm
            WHERE cm.user_id = auth.uid()
            AND cm.company_id = user_roles.company_id
            AND cm.role = 'admin'
            AND cm.is_active = true
        )
    );

-- Add comments
COMMENT ON POLICY "Admins can insert user_roles in their company" ON public.user_roles IS 
'Allows authenticated admins to insert user_roles for users in their company. Uses company_memberships to check admin status to avoid circular dependency.';

COMMENT ON POLICY "Admins can update user_roles in their company" ON public.user_roles IS 
'Allows authenticated admins to update user_roles for users in their company. Uses company_memberships to check admin status to avoid circular dependency.';

COMMENT ON POLICY "Admins can delete user_roles in their company" ON public.user_roles IS 
'Allows authenticated admins to delete user_roles for users in their company. Uses company_memberships to check admin status to avoid circular dependency.';

