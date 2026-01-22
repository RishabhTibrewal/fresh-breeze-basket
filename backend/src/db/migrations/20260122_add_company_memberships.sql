-- Create company memberships to allow users in multiple companies
CREATE TABLE IF NOT EXISTS public.company_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role user_role DEFAULT 'user',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_company_memberships_user_id ON public.company_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_company_memberships_company_id ON public.company_memberships(company_id);

-- Allow profiles without a fixed company_id; memberships become primary
ALTER TABLE public.profiles
  ALTER COLUMN company_id DROP NOT NULL;

-- Backfill memberships from existing profiles
INSERT INTO public.company_memberships (user_id, company_id, role, is_active)
SELECT id, company_id, role, true
FROM public.profiles
WHERE company_id IS NOT NULL
ON CONFLICT (user_id, company_id) DO NOTHING;

-- Update helper function to resolve a user's company
DROP FUNCTION IF EXISTS public.profile_company_id(UUID);
CREATE FUNCTION public.profile_company_id(user_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT company_id
     FROM public.profiles
     WHERE id = user_id AND company_id IS NOT NULL
     LIMIT 1),
    (SELECT company_id
     FROM public.company_memberships cm
     WHERE cm.user_id = user_id AND cm.is_active = true
     ORDER BY cm.created_at ASC
     LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS UUID AS $$
  SELECT public.profile_company_id(auth.uid());
$$ LANGUAGE sql STABLE;

-- Update admin helper to use membership role for current company
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_memberships
    WHERE user_id = user_id
      AND company_id = public.current_company_id()
      AND role = 'admin'
      AND is_active = true
  );
$$ LANGUAGE sql STABLE;

-- RLS for memberships (read-only for the owning user)
ALTER TABLE public.company_memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their memberships" ON public.company_memberships;
CREATE POLICY "Users can view their memberships"
  ON public.company_memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Grant execute permission on the updated function
GRANT EXECUTE ON FUNCTION public.profile_company_id(UUID) TO authenticated;
