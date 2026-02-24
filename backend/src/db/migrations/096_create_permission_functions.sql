-- Function: Get user permissions for a company
CREATE OR REPLACE FUNCTION get_user_permissions(
    p_user_id UUID,
    p_company_id UUID
)
RETURNS TABLE(
    permission_code VARCHAR(100),
    module VARCHAR(50),
    action VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT p.code::VARCHAR(100), p.module::VARCHAR(50), p.action::VARCHAR(50)
    FROM public.permissions p
    JOIN public.role_permissions rp ON p.id = rp.permission_id
    JOIN public.user_roles ur ON rp.role_id = ur.role_id
    WHERE ur.user_id = p_user_id 
      AND ur.company_id = p_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if user has specific permission
CREATE OR REPLACE FUNCTION user_has_permission(
    p_user_id UUID,
    p_company_id UUID,
    p_permission_code VARCHAR(100)
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS(
        SELECT 1
        FROM public.permissions p
        JOIN public.role_permissions rp ON p.id = rp.permission_id
        JOIN public.user_roles ur ON rp.role_id = ur.role_id
        WHERE ur.user_id = p_user_id 
          AND ur.company_id = p_company_id
          AND p.code = p_permission_code
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get company enabled modules
CREATE OR REPLACE FUNCTION get_company_modules(
    p_company_id UUID
)
RETURNS TABLE(
    module_code VARCHAR(50),
    is_enabled BOOLEAN,
    settings JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT cm.module_code::VARCHAR(50), cm.is_enabled, cm.settings
    FROM public.company_modules cm
    WHERE cm.company_id = p_company_id
      AND cm.is_enabled = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get accessible modules for user (company enabled + user has permission)
CREATE OR REPLACE FUNCTION get_user_accessible_modules(
    p_user_id UUID,
    p_company_id UUID
)
RETURNS TABLE(
    module_code VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT p.module::VARCHAR(50) AS module_code
    FROM public.permissions p
    JOIN public.role_permissions rp ON p.id = rp.permission_id
    JOIN public.user_roles ur ON rp.role_id = ur.role_id
    JOIN public.company_modules cm ON cm.module_code = p.module AND cm.company_id = p_company_id
    WHERE ur.user_id = p_user_id 
      AND ur.company_id = p_company_id
      AND cm.is_enabled = true
      AND p.action = 'read';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_user_permissions(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_permission(UUID, UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_company_modules(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_accessible_modules(UUID, UUID) TO authenticated;
