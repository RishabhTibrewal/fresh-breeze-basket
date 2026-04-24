-- Globalize profiles and keep tenant access in company_memberships.
-- Profiles remain one row per auth user; memberships stay tenant-scoped.

BEGIN;

-- 1) Backfill missing profiles from auth.users for existing memberships/users.
INSERT INTO public.profiles (id, email, first_name, last_name, phone, role)
SELECT
  au.id,
  COALESCE(au.email, CONCAT('unknown+', au.id::text, '@no-profile.local')),
  NULLIF(au.raw_user_meta_data->>'first_name', ''),
  NULLIF(au.raw_user_meta_data->>'last_name', ''),
  NULLIF(au.raw_user_meta_data->>'phone', ''),
  COALESCE(NULLIF(au.raw_user_meta_data->>'role', ''), 'user')::user_role
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;

-- 2) Ensure membership uniqueness and useful indexes for tenant lookup.
CREATE UNIQUE INDEX IF NOT EXISTS uq_company_memberships_user_company
ON public.company_memberships(user_id, company_id);

CREATE INDEX IF NOT EXISTS idx_company_memberships_user_company_active
ON public.company_memberships(user_id, company_id, is_active);

-- 3) Profiles are global. Stop deriving memberships from profile.company_id.
CREATE OR REPLACE FUNCTION public.ensure_membership_for_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- No-op by design: memberships are managed independently from profiles.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_membership_on_profile_upsert ON public.profiles;
CREATE TRIGGER ensure_membership_on_profile_upsert
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_membership_for_profile();

-- 4) Resolve current company strictly from memberships.
CREATE OR REPLACE FUNCTION public.profile_company_id(user_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cm.company_id
  FROM public.company_memberships cm
  WHERE cm.user_id = $1
    AND cm.is_active = true
  ORDER BY cm.created_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT public.profile_company_id(auth.uid());
$$;

-- 5) Ensure auth trigger creates global profiles (not tenant-bound profiles).
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
    role
  )
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'first_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'last_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    v_role
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name),
        last_name = COALESCE(EXCLUDED.last_name, public.profiles.last_name),
        phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
        role = COALESCE(EXCLUDED.role, public.profiles.role),
        updated_at = CURRENT_TIMESTAMP;

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

COMMIT;
