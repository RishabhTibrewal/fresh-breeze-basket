-- Add UPDATE and DELETE policies for service_role on profiles table
-- The INSERT policy already exists, but upsert operations need UPDATE as well

-- Allow service role to update profiles
DROP POLICY IF EXISTS "Allow profile update from service role" ON public.profiles;
CREATE POLICY "Allow profile update from service role"
  ON public.profiles FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow service role to delete profiles (for cleanup operations)
DROP POLICY IF EXISTS "Allow profile delete from service role" ON public.profiles;
CREATE POLICY "Allow profile delete from service role"
  ON public.profiles FOR DELETE
  TO service_role
  USING (true);

-- Add comments
COMMENT ON POLICY "Allow profile update from service role" ON public.profiles IS 
'Allows service role to update profiles, needed for upsert operations during user registration and profile management.';

COMMENT ON POLICY "Allow profile delete from service role" ON public.profiles IS 
'Allows service role to delete profiles for cleanup operations.';

