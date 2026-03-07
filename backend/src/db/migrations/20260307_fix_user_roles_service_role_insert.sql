-- Fix RLS issue when inserting user_roles with service role
-- Create a SECURITY DEFINER function to assign user roles that bypasses RLS
-- This is more reliable than relying on service role client bypassing RLS

CREATE OR REPLACE FUNCTION public.assign_user_roles(
    p_user_id UUID,
    p_company_id UUID,
    p_role_names TEXT[]
)
RETURNS JSONB AS $$
DECLARE
    v_role_id UUID;
    v_role_name TEXT;
    v_role_ids UUID[];
    v_deleted_count INTEGER;
    v_inserted_count INTEGER;
BEGIN
    -- Validate that all role names exist and collect their IDs
    v_role_ids := ARRAY[]::UUID[];
    
    FOREACH v_role_name IN ARRAY p_role_names
    LOOP
        SELECT id INTO v_role_id
        FROM public.roles
        WHERE name = v_role_name
        LIMIT 1;
        
        IF v_role_id IS NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', format('Invalid role: %s', v_role_name)
            );
        END IF;
        
        v_role_ids := array_append(v_role_ids, v_role_id);
    END LOOP;
    
    -- Delete existing roles for this user-company combination
    DELETE FROM public.user_roles
    WHERE user_id = p_user_id
      AND company_id = p_company_id;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    -- Insert new roles
    IF array_length(v_role_ids, 1) > 0 THEN
        INSERT INTO public.user_roles (user_id, company_id, role_id)
        SELECT p_user_id, p_company_id, unnest(v_role_ids)
        ON CONFLICT (user_id, company_id, role_id) DO NOTHING;
        
        GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
    ELSE
        v_inserted_count := 0;
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'deleted_count', v_deleted_count,
        'inserted_count', v_inserted_count
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION public.assign_user_roles(UUID, UUID, TEXT[]) IS 
'Assigns roles to a user in a company. Replaces all existing roles. Uses SECURITY DEFINER to bypass RLS.';

