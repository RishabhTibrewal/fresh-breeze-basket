-- Create pos_managers table for assigning POS managers to outlets
CREATE TABLE IF NOT EXISTS public.pos_managers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, warehouse_id, company_id)
);

-- Seed pos_manager role
INSERT INTO public.roles (name, description) VALUES
    ('pos_manager', 'POS manager role with access to specific outlets and reports')
ON CONFLICT (name) DO NOTHING;

-- Grant standard POS view permissions to pos_manager role so they can see their POS analytics widgets
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name = 'pos_manager'
  AND p.code IN (
    'sales.hourly_heatmap.view',
    'sales.payment_mix.view',
    'sales.fulfillment_mix.view',
    'sales.discount_impact.view',
    'pos.cashier_performance.view',
    'sales.category_brand.view',
    'sales.basket_metrics.view',
    'sales.modifier_revenue.view',
    'sales.trend_comparison.view',
    'sales.movers.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pos_managers_user ON public.pos_managers(user_id);
CREATE INDEX IF NOT EXISTS idx_pos_managers_warehouse ON public.pos_managers(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_pos_managers_company ON public.pos_managers(company_id);
CREATE INDEX IF NOT EXISTS idx_pos_managers_active ON public.pos_managers(is_active);

-- Enable RLS
ALTER TABLE public.pos_managers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own POS assignments
CREATE POLICY "Users can view their own POS assignments"
    ON public.pos_managers FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() AND company_id = public.current_company_id());

-- Policy: Admins/accounts can manage all POS assignments
CREATE POLICY "Admins/accounts can manage POS assignments"
    ON public.pos_managers FOR ALL
    TO authenticated
    USING (
        (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'accounts'))
        AND company_id = public.current_company_id()
    )
    WITH CHECK (
        (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'accounts'))
        AND company_id = public.current_company_id()
    );

-- Policy: POS managers can view their assigned warehouses
CREATE POLICY "POS managers can view their assignments"
    ON public.pos_managers FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND ur.company_id = public.current_company_id()
            AND r.name = 'pos_manager'
        )
        AND company_id = public.current_company_id()
    );

-- Function to check if user has access to a specific POS outlet
CREATE OR REPLACE FUNCTION public.has_pos_outlet_access(
    p_user_id UUID,
    p_warehouse_id UUID,
    p_company_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_company_id UUID;
BEGIN
    v_company_id := COALESCE(p_company_id, public.current_company_id());

    -- Admin or Accounts override - they have access to all outlets
    IF public.is_admin(p_user_id) OR public.has_role(p_user_id, 'accounts', v_company_id) THEN
        RETURN true;
    END IF;

    -- Check if user is assigned as POS manager for this outlet
    RETURN EXISTS (
        SELECT 1
        FROM public.pos_managers pm
        WHERE pm.user_id = p_user_id
          AND pm.warehouse_id = p_warehouse_id
          AND pm.company_id = v_company_id
          AND pm.is_active = true
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.has_pos_outlet_access(UUID, UUID, UUID) TO authenticated;
