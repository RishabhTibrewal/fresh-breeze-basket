-- Allow auth admin/service role to insert profiles from auth trigger
DROP POLICY IF EXISTS "Allow profile insert from auth admin" ON public.profiles;
CREATE POLICY "Allow profile insert from auth admin"
  ON public.profiles FOR INSERT
  TO supabase_auth_admin
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow profile insert from service role" ON public.profiles;
CREATE POLICY "Allow profile insert from service role"
  ON public.profiles FOR INSERT
  TO service_role
  WITH CHECK (true);
