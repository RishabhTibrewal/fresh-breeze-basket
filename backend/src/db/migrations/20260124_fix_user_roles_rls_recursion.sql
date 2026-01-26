-- Fix infinite recursion in user_roles RLS policy
-- The policy was querying user_roles itself, causing infinite recursion
-- Solution: 
-- 1. Use company_memberships table for admin check in RLS policy (no circular dependency)
-- 2. Make role-checking functions SECURITY DEFINER so they bypass RLS

-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can view all roles in their company" ON public.user_roles;

-- Create new policy that uses company_memberships instead of user_roles
-- This avoids the circular dependency
CREATE POLICY "Admins can view all roles in their company"
    ON public.user_roles FOR SELECT
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

-- Also add a policy for service role to bypass RLS for admin operations
-- This allows backend admin operations to work without RLS issues
DROP POLICY IF EXISTS "Service role can manage user_roles" ON public.user_roles;
CREATE POLICY "Service role can manage user_roles"
    ON public.user_roles FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Recreate role-checking functions with SECURITY DEFINER so they bypass RLS
-- This prevents infinite recursion when these functions query user_roles
-- Note: We recreate them with SECURITY DEFINER to bypass RLS during role checks

CREATE OR REPLACE FUNCTION public.has_role(
    p_user_id UUID,
    p_role_name TEXT,
    p_company_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_company_id UUID;
    v_role_id UUID;
BEGIN
    v_company_id := COALESCE(p_company_id, public.current_company_id());

    SELECT id INTO v_role_id
    FROM public.roles
    WHERE name = p_role_name
    LIMIT 1;

    IF v_role_id IS NULL THEN
        RETURN false;
    END IF;

    -- admin override
    IF EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = p_user_id
          AND ur.company_id = v_company_id
          AND r.name = 'admin'
    ) THEN
        RETURN true;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = p_user_id
          AND ur.company_id = v_company_id
          AND ur.role_id = v_role_id
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.has_any_role(
    p_user_id UUID,
    p_role_names TEXT[],
    p_company_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_company_id UUID;
BEGIN
    v_company_id := COALESCE(p_company_id, public.current_company_id());

    -- admin override
    IF EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = p_user_id
          AND ur.company_id = v_company_id
          AND r.name = 'admin'
    ) THEN
        RETURN true;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = p_user_id
          AND ur.company_id = v_company_id
          AND r.name = ANY(p_role_names)
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.has_all_roles(
    p_user_id UUID,
    p_role_names TEXT[],
    p_company_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_company_id UUID;
    v_role_count INTEGER;
BEGIN
    v_company_id := COALESCE(p_company_id, public.current_company_id());

    -- admin override
    IF EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = p_user_id
          AND ur.company_id = v_company_id
          AND r.name = 'admin'
    ) THEN
        RETURN true;
    END IF;

    SELECT COUNT(DISTINCT r.id)
      INTO v_role_count
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id
      AND ur.company_id = v_company_id
      AND r.name = ANY(p_role_names);

    RETURN v_role_count = array_length(p_role_names, 1);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_roles(
    p_user_id UUID,
    p_company_id UUID DEFAULT NULL
)
RETURNS TEXT[] AS $$
DECLARE
    v_company_id UUID;
BEGIN
    v_company_id := COALESCE(p_company_id, public.current_company_id());

    RETURN ARRAY(
        SELECT r.name
        FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = p_user_id
          AND ur.company_id = v_company_id
        ORDER BY r.name
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.has_role(user_id, 'admin');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_sales(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.has_role(p_user_id, 'sales');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin_or_sales(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.has_any_role(p_user_id, ARRAY['admin', 'sales']);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

