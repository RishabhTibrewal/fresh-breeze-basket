-- Granular permissions table
CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(100) UNIQUE NOT NULL,
    module VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed default permissions
INSERT INTO public.permissions (code, module, action, description) VALUES
-- E-commerce
('ecommerce.read', 'ecommerce', 'read', 'View e-commerce dashboard and orders'),
('ecommerce.write', 'ecommerce', 'write', 'Manage e-commerce products and settings'),
('ecommerce.delete', 'ecommerce', 'delete', 'Delete e-commerce data'),

-- Sales
('sales.read', 'sales', 'read', 'View sales orders and customers'),
('sales.write', 'sales', 'write', 'Create and update sales orders'),
('sales.delete', 'sales', 'delete', 'Delete sales orders'),
('sales.approve', 'sales', 'approve', 'Approve sales orders'),

-- Inventory
('inventory.read', 'inventory', 'read', 'View inventory and products'),
('inventory.write', 'inventory', 'write', 'Manage inventory and products'),
('inventory.delete', 'inventory', 'delete', 'Delete inventory items'),
('inventory.adjust', 'inventory', 'adjust', 'Adjust stock levels'),
('inventory.transfer', 'inventory', 'transfer', 'Transfer stock between warehouses'),

-- Procurement
('procurement.read', 'procurement', 'read', 'View purchase orders and suppliers'),
('procurement.write', 'procurement', 'write', 'Create purchase orders'),
('procurement.delete', 'procurement', 'delete', 'Delete purchase orders'),
('procurement.approve', 'procurement', 'approve', 'Approve purchase orders'),

-- Accounting
('accounting.read', 'accounting', 'read', 'View financial data'),
('accounting.write', 'accounting', 'write', 'Manage accounting entries'),
('accounting.reconcile', 'accounting', 'reconcile', 'Reconcile accounts'),

-- Reports
('reports.read', 'reports', 'read', 'View all reports'),
('reports.export', 'reports', 'export', 'Export reports'),

-- POS
('pos.access', 'pos', 'access', 'Access POS system'),

-- Settings (Admin only)
('settings.read', 'settings', 'read', 'View system settings'),
('settings.write', 'settings', 'write', 'Manage system settings')
ON CONFLICT (code) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_permissions_module ON public.permissions(module);
CREATE INDEX IF NOT EXISTS idx_permissions_code ON public.permissions(code);

-- Enable RLS on permissions table
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read permissions
CREATE POLICY "Authenticated users can view permissions"
    ON public.permissions FOR SELECT
    TO authenticated
    USING (true);
