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
$$ LANGUAGE plpgsql STABLE;

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
$$ LANGUAGE plpgsql STABLE;

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
$$ LANGUAGE plpgsql STABLE;

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
$$ LANGUAGE plpgsql STABLE;




CREATE OR REPLACE FUNCTION public.is_sales(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.has_role(p_user_id, 'sales');
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.is_admin_or_sales(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.has_any_role(p_user_id, ARRAY['admin', 'sales']);
END;
$$ LANGUAGE plpgsql STABLE;
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.has_role(user_id, 'admin');
END;
$$ LANGUAGE plpgsql STABLE;
