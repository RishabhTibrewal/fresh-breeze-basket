-- Create a trigger to sync new auth users to profiles with company context
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_role user_role;
BEGIN
  v_company_id := (NEW.raw_user_meta_data->>'company_id')::uuid;
  v_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'user')::user_role;

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
  );

  -- Create company membership if company_id is provided
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
    ON CONFLICT (user_id, company_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();
