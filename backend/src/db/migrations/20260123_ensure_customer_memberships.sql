-- Ensure memberships and profile company_id are created when customers are added

CREATE OR REPLACE FUNCTION public.ensure_membership_for_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.company_memberships (
    user_id,
    company_id,
    role,
    is_active
  )
  VALUES (
    NEW.id,
    NEW.company_id,
    COALESCE(NEW.role, 'user'),
    true
  )
  ON CONFLICT (user_id, company_id) DO UPDATE
    SET role = EXCLUDED.role,
        is_active = true,
        updated_at = CURRENT_TIMESTAMP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_membership_on_profile_upsert ON public.profiles;
CREATE TRIGGER ensure_membership_on_profile_upsert
  AFTER INSERT OR UPDATE OF company_id, role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_membership_for_profile();

CREATE OR REPLACE FUNCTION public.ensure_membership_for_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
BEGIN
  IF NEW.user_id IS NULL OR NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Sync profile company_id if profile exists
  UPDATE public.profiles
     SET company_id = NEW.company_id,
         updated_at = CURRENT_TIMESTAMP
   WHERE id = NEW.user_id
     AND (company_id IS NULL OR company_id <> NEW.company_id);

  -- If profile doesn't exist, create it when we have an email
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF NOT FOUND THEN
    v_role := 'user';
    IF NEW.email IS NOT NULL THEN
      BEGIN
        INSERT INTO public.profiles (
          id,
          email,
          phone,
          company_id,
          role
        )
        VALUES (
          NEW.user_id,
          NEW.email,
          NEW.phone,
          NEW.company_id,
          v_role
        );
      EXCEPTION WHEN unique_violation THEN
        -- Ignore if profile/email already exists
        NULL;
      END;
    END IF;
  END IF;

  INSERT INTO public.company_memberships (
    user_id,
    company_id,
    role,
    is_active
  )
  VALUES (
    NEW.user_id,
    NEW.company_id,
    COALESCE(v_role, 'user'),
    true
  )
  ON CONFLICT (user_id, company_id) DO UPDATE
    SET role = EXCLUDED.role,
        is_active = true,
        updated_at = CURRENT_TIMESTAMP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_membership_on_customer_insert ON public.customers;
CREATE TRIGGER ensure_membership_on_customer_insert
  AFTER INSERT ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_membership_for_customer();

