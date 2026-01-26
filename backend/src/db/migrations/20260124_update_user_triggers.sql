-- Update handle_new_user() trigger to support roles array from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_role user_role;
  v_roles TEXT[];
  v_role_id UUID;
  v_role_name TEXT;
BEGIN
  v_company_id := (NEW.raw_user_meta_data->>'company_id')::uuid;
  
  -- Get primary role for backward compatibility
  v_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'user')::user_role;
  
  -- Try to get roles array from metadata, fallback to single role
  IF NEW.raw_user_meta_data->'roles' IS NOT NULL THEN
    -- Extract roles array from JSONB
    SELECT ARRAY(
      SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'roles')
    ) INTO v_roles;
  ELSE
    -- Fallback to single role
    v_roles := ARRAY[v_role::TEXT];
  END IF;

  -- Insert profile
  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    phone,
    company_id,
    role
  )
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'first_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'last_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    v_company_id,
    v_role
  )
  ON CONFLICT (id) DO UPDATE
    SET company_id = EXCLUDED.company_id,
        role = EXCLUDED.role;

  -- Create company membership if company_id is provided (for backward compatibility)
  IF v_company_id IS NOT NULL THEN
    INSERT INTO public.company_memberships (
      user_id,
      company_id,
      role,
      is_active
    )
    VALUES (
      NEW.id,
      v_company_id,
      v_role,
      true
    )
    ON CONFLICT (user_id, company_id) DO UPDATE
      SET role = EXCLUDED.role,
          is_active = true;

    -- Create user_roles entries for each role
    FOREACH v_role_name IN ARRAY v_roles
    LOOP
      -- Get role_id for the role name
      SELECT id INTO v_role_id
      FROM public.roles
      WHERE name = v_role_name
      LIMIT 1;

      -- Only insert if role exists
      IF v_role_id IS NOT NULL THEN
        INSERT INTO public.user_roles (
          user_id,
          company_id,
          role_id
        )
        VALUES (
          NEW.id,
          v_company_id,
          v_role_id
        )
        ON CONFLICT (user_id, company_id, role_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger is already created, no need to recreate it

