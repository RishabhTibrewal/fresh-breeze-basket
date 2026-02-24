-- Role to permissions mapping
CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role_id, permission_id)
);

-- Seed default role permissions
-- Admin gets all permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Sales Executive permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name = 'sales' AND p.code IN (
    'sales.read', 'sales.write', 'sales.delete',
    'inventory.read',
    'pos.access',
    'reports.read'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Accountant permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name = 'accounts' AND p.code IN (
    'accounting.read', 'accounting.write', 'accounting.reconcile',
    'sales.read',
    'procurement.read',
    'reports.read', 'reports.export'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Warehouse Manager permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name = 'warehouse_manager' AND p.code IN (
    'inventory.read', 'inventory.write', 'inventory.adjust', 'inventory.transfer',
    'procurement.read',
    'reports.read'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Procurement Officer permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name = 'procurement' AND p.code IN (
    'procurement.read', 'procurement.write', 'procurement.approve',
    'inventory.read',
    'reports.read'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON public.role_permissions(permission_id);

-- Enable RLS on role_permissions table
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view role permissions for their company
CREATE POLICY "Users can view role permissions"
    ON public.role_permissions FOR SELECT
    TO authenticated
    USING (true);
