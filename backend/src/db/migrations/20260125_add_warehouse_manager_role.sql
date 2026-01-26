-- Add warehouse_manager role to roles table
INSERT INTO public.roles (name, description) VALUES
    ('warehouse_manager', 'Warehouse manager role for managing warehouse inventory and creating procurement documents')
ON CONFLICT (name) DO NOTHING;

