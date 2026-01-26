-- Create warehouse_managers table for assigning warehouse managers to warehouses
CREATE TABLE IF NOT EXISTS public.warehouse_managers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, warehouse_id, company_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_warehouse_managers_user ON public.warehouse_managers(user_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_managers_warehouse ON public.warehouse_managers(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_managers_company ON public.warehouse_managers(company_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_managers_active ON public.warehouse_managers(is_active);

-- Enable RLS
ALTER TABLE public.warehouse_managers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own warehouse assignments
CREATE POLICY "Users can view their own warehouse assignments"
    ON public.warehouse_managers FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() AND company_id = public.current_company_id());

-- Policy: Admins can manage all warehouse assignments
CREATE POLICY "Admins can manage warehouse assignments"
    ON public.warehouse_managers FOR ALL
    TO authenticated
    USING (
        public.is_admin(auth.uid()) 
        AND company_id = public.current_company_id()
    )
    WITH CHECK (
        public.is_admin(auth.uid()) 
        AND company_id = public.current_company_id()
    );

-- Policy: Warehouse managers can view their assigned warehouses
CREATE POLICY "Warehouse managers can view their assignments"
    ON public.warehouse_managers FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND ur.company_id = public.current_company_id()
            AND r.name = 'warehouse_manager'
        )
        AND company_id = public.current_company_id()
    );

