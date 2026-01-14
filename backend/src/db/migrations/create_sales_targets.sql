-- Create sales_targets table for managing sales goals
CREATE TABLE IF NOT EXISTS public.sales_targets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sales_executive_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    target_amount DECIMAL(10,2) NOT NULL,
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'yearly')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES auth.users(id),
    CONSTRAINT positive_target_amount CHECK (target_amount > 0),
    CONSTRAINT valid_period CHECK (period_end > period_start)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_sales_targets_executive ON public.sales_targets(sales_executive_id);
CREATE INDEX IF NOT EXISTS idx_sales_targets_period ON public.sales_targets(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_sales_targets_active ON public.sales_targets(is_active);

-- Enable Row Level Security
ALTER TABLE public.sales_targets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Sales executives can view their own targets
CREATE POLICY "Sales executives can view their own targets"
ON public.sales_targets FOR SELECT TO authenticated
USING (
    sales_executive_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- Only admins can create, update, or delete targets
CREATE POLICY "Admins can manage all sales targets"
ON public.sales_targets FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);
