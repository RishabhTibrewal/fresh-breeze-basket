-- Company-level module enablement
CREATE TABLE IF NOT EXISTS public.company_modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    module_code VARCHAR(50) NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, module_code)
);

-- Enable all modules for existing companies by default
INSERT INTO public.company_modules (company_id, module_code, is_enabled)
SELECT c.id, module_code, true
FROM public.companies c
CROSS JOIN (
    VALUES 
        ('ecommerce'),
        ('sales'),
        ('inventory'),
        ('procurement'),
        ('accounting'),
        ('reports'),
        ('pos'),
        ('settings')
) AS modules(module_code)
ON CONFLICT (company_id, module_code) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_company_modules_company_id ON public.company_modules(company_id);
CREATE INDEX IF NOT EXISTS idx_company_modules_module_code ON public.company_modules(module_code);

-- Enable RLS on company_modules table
ALTER TABLE public.company_modules ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view company modules for their company
CREATE POLICY "Users can view company modules"
    ON public.company_modules FOR SELECT
    TO authenticated
    USING (
        company_id IN (
            SELECT ur.company_id 
            FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
        )
    );

-- Policy: Admins can manage company modules
CREATE POLICY "Admins can manage company modules"
    ON public.company_modules FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND ur.company_id = company_modules.company_id
              AND r.name = 'admin'
        )
    );
