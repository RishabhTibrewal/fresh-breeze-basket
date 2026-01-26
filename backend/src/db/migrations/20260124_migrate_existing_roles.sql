-- Migrate existing roles from company_memberships to user_roles table
DO $$
DECLARE
    admin_role_id UUID;
    sales_role_id UUID;
    user_role_id UUID;
    accounts_role_id UUID;
BEGIN
    -- Get role IDs
    SELECT id INTO admin_role_id FROM public.roles WHERE name = 'admin' LIMIT 1;
    SELECT id INTO sales_role_id FROM public.roles WHERE name = 'sales' LIMIT 1;
    SELECT id INTO user_role_id FROM public.roles WHERE name = 'user' LIMIT 1;
    SELECT id INTO accounts_role_id FROM public.roles WHERE name = 'accounts' LIMIT 1;

    -- Migrate admin roles
    INSERT INTO public.user_roles (user_id, company_id, role_id)
    SELECT user_id, company_id, admin_role_id
    FROM public.company_memberships
    WHERE role = 'admin' AND is_active = true
    ON CONFLICT (user_id, company_id, role_id) DO NOTHING;

    -- Migrate sales roles
    INSERT INTO public.user_roles (user_id, company_id, role_id)
    SELECT user_id, company_id, sales_role_id
    FROM public.company_memberships
    WHERE role = 'sales' AND is_active = true
    ON CONFLICT (user_id, company_id, role_id) DO NOTHING;

    -- Migrate user roles (default role)
    INSERT INTO public.user_roles (user_id, company_id, role_id)
    SELECT user_id, company_id, user_role_id
    FROM public.company_memberships
    WHERE role = 'user' AND is_active = true
    ON CONFLICT (user_id, company_id, role_id) DO NOTHING;

    -- Ensure all active memberships have at least the 'user' role
    INSERT INTO public.user_roles (user_id, company_id, role_id)
    SELECT DISTINCT cm.user_id, cm.company_id, user_role_id
    FROM public.company_memberships cm
    WHERE cm.is_active = true
    AND NOT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = cm.user_id
        AND ur.company_id = cm.company_id
    )
    ON CONFLICT (user_id, company_id, role_id) DO NOTHING;
END $$;

