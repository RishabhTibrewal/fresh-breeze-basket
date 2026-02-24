-- Update roles table to add missing fields for module system
ALTER TABLE public.roles 
ADD COLUMN IF NOT EXISTS display_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id),
ADD COLUMN IF NOT EXISTS is_system_role BOOLEAN DEFAULT false;

-- Update existing roles with display names and mark as system roles
UPDATE public.roles 
SET display_name = CASE 
    WHEN name = 'admin' THEN 'Administrator'
    WHEN name = 'sales' THEN 'Sales Executive'
    WHEN name = 'accounts' THEN 'Accountant'
    WHEN name = 'user' THEN 'User'
    ELSE INITCAP(name)
END,
is_system_role = true
WHERE display_name IS NULL;

-- Add warehouse_manager and procurement roles if they don't exist
INSERT INTO public.roles (name, display_name, description, is_system_role) VALUES
('warehouse_manager', 'Warehouse Manager', 'Inventory and warehouse operations', true),
('procurement', 'Procurement Officer', 'Purchase orders and suppliers', true)
ON CONFLICT (name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_roles_company_id ON public.roles(company_id);
