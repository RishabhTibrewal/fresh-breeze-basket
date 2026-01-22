-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Create company and admin user in one transaction
CREATE OR REPLACE FUNCTION public.create_company_with_admin(
  p_company_name TEXT,
  p_company_slug TEXT,
  p_email TEXT,
  p_password TEXT,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id UUID;
  new_user_id UUID;
  auth_instance_id UUID;
BEGIN
  IF p_company_name IS NULL OR p_email IS NULL OR p_password IS NULL THEN
    RAISE EXCEPTION 'company_name, email, and password are required';
  END IF;

  IF p_company_slug IS NULL OR btrim(p_company_slug) = '' THEN
    RAISE EXCEPTION 'company_slug is required';
  END IF;

  IF EXISTS (SELECT 1 FROM public.companies WHERE slug = p_company_slug) THEN
    RAISE EXCEPTION 'Company slug already in use';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RAISE EXCEPTION 'Email already registered';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE email = p_email) THEN
    RAISE EXCEPTION 'Email already registered';
  END IF;

  SELECT id INTO auth_instance_id
  FROM auth.instances
  LIMIT 1;

  IF auth_instance_id IS NULL THEN
    SELECT instance_id INTO auth_instance_id
    FROM auth.users
    WHERE instance_id IS NOT NULL
    LIMIT 1;
  END IF;

  IF auth_instance_id IS NULL THEN
    RAISE EXCEPTION 'Auth instance not found';
  END IF;

  INSERT INTO public.companies (name, slug)
  VALUES (p_company_name, p_company_slug)
  RETURNING id INTO new_company_id;

  new_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    encrypted_password
  ) VALUES (
    new_user_id,
    auth_instance_id,
    'authenticated',
    'authenticated',
    p_email,
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object(
      'first_name', p_first_name,
      'last_name', p_last_name,
      'phone', p_phone,
      'company_id', new_company_id,
      'role', 'admin'
    ),
    now(),
    now(),
    extensions.crypt(p_password, extensions.gen_salt('bf'))
  );

  INSERT INTO auth.identities (
    user_id,
    provider,
    provider_id,
    identity_data,
    created_at,
    updated_at
  ) VALUES (
    new_user_id,
    'email',
    new_user_id::text,
    jsonb_build_object('sub', new_user_id::text, 'email', p_email),
    now(),
    now()
  );

  RETURN jsonb_build_object(
    'company_id', new_company_id,
    'user_id', new_user_id
  );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.create_company_with_admin(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;
