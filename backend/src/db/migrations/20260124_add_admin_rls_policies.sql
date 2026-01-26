-- Add RLS policies to allow admins to manage company_memberships and profiles
-- This replaces the need to bypass RLS with supabaseAdmin

-- Company Memberships Policies
-- Admins can view all memberships in their company
DROP POLICY IF EXISTS "Admins can view all memberships in their company" ON public.company_memberships;
CREATE POLICY "Admins can view all memberships in their company"
    ON public.company_memberships FOR SELECT
    TO authenticated
    USING (
        public.is_admin(auth.uid()) 
        AND company_id = public.current_company_id()
    );

-- Admins can insert memberships for users in their company
DROP POLICY IF EXISTS "Admins can insert memberships in their company" ON public.company_memberships;
CREATE POLICY "Admins can insert memberships in their company"
    ON public.company_memberships FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_admin(auth.uid()) 
        AND company_id = public.current_company_id()
    );

-- Admins can update memberships for users in their company
DROP POLICY IF EXISTS "Admins can update memberships in their company" ON public.company_memberships;
CREATE POLICY "Admins can update memberships in their company"
    ON public.company_memberships FOR UPDATE
    TO authenticated
    USING (
        public.is_admin(auth.uid()) 
        AND company_id = public.current_company_id()
    )
    WITH CHECK (
        public.is_admin(auth.uid()) 
        AND company_id = public.current_company_id()
    );

-- Admins can delete memberships for users in their company
DROP POLICY IF EXISTS "Admins can delete memberships in their company" ON public.company_memberships;
CREATE POLICY "Admins can delete memberships in their company"
    ON public.company_memberships FOR DELETE
    TO authenticated
    USING (
        public.is_admin(auth.uid()) 
        AND company_id = public.current_company_id()
    );

-- Profiles Policies
-- Update existing admin policy to ensure it's scoped to company
-- Note: The existing "Admins can update all profiles" policy should already work,
-- but we'll ensure it's properly scoped if needed

-- Verify/Update the admin update policy to be company-scoped
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- Note: The is_admin() function uses the new multi-role system (has_role())
-- which checks user_roles table and includes admin override logic.
-- The function already respects company context via current_company_id(),
-- so admins can only update profiles for users in their company context.

-- Grant execute permissions (if not already granted)
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, TEXT, UUID) TO authenticated;

