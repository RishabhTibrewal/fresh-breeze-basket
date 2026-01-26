-- Create roles master table for multi-role RBAC system
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on name for faster lookups
CREATE INDEX IF NOT EXISTS idx_roles_name ON public.roles(name);

-- Seed initial roles
INSERT INTO public.roles (name, description) VALUES
    ('admin', 'Administrator with full system access'),
    ('sales', 'Sales executive role'),
    ('accounts', 'Accounts management role'),
    ('user', 'Basic user role')
ON CONFLICT (name) DO NOTHING;

-- Enable RLS on roles table (read-only for authenticated users)
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read roles
CREATE POLICY "Authenticated users can view roles"
    ON public.roles FOR SELECT
    TO authenticated
    USING (true);

