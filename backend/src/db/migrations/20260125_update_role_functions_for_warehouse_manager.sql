-- Add function to check if user is a warehouse manager
CREATE OR REPLACE FUNCTION public.is_warehouse_manager(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Admin override
    IF public.is_admin(p_user_id) THEN
        RETURN true;
    END IF;

    RETURN public.has_role(p_user_id, 'warehouse_manager');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Add function to check if user has access to a specific warehouse
CREATE OR REPLACE FUNCTION public.has_warehouse_access(
    p_user_id UUID,
    p_warehouse_id UUID,
    p_company_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_company_id UUID;
BEGIN
    v_company_id := COALESCE(p_company_id, public.current_company_id());

    -- Admin override - admins have access to all warehouses
    IF public.is_admin(p_user_id) THEN
        RETURN true;
    END IF;

    -- Check if user is assigned as warehouse manager for this warehouse
    RETURN EXISTS (
        SELECT 1
        FROM public.warehouse_managers wm
        WHERE wm.user_id = p_user_id
          AND wm.warehouse_id = p_warehouse_id
          AND wm.company_id = v_company_id
          AND wm.is_active = true
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_warehouse_manager(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_warehouse_access(UUID, UUID, UUID) TO authenticated;

