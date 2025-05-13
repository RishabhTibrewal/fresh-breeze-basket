-- Update user_role enum to include 'sales'
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'sales';

-- Create customers table
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    sales_executive_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    trn_number TEXT,
    credit_period_days INTEGER DEFAULT 0,
    credit_limit DECIMAL(10,2) DEFAULT 0,
    current_credit DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT positive_credit_period CHECK (credit_period_days >= 0),
    CONSTRAINT positive_credit_limit CHECK (credit_limit >= 0),
    CONSTRAINT positive_current_credit CHECK (current_credit >= 0)
);

-- Create credit_transactions table
CREATE TABLE IF NOT EXISTS public.credit_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    period INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('credit', 'payment')),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_customers_user ON public.customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_sales_executive ON public.customers(sales_executive_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_customer ON public.credit_periods(customer_id);

-- Enable Row Level Security
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_periods ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customers table
CREATE POLICY "Sales executives can view their own customers"
ON public.customers FOR SELECT TO authenticated
USING (
    sales_executive_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'sales')
    )
);

CREATE POLICY "Sales executives can insert their own customers"
ON public.customers FOR INSERT TO authenticated
WITH CHECK (
    sales_executive_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'sales')
    )
);

CREATE POLICY "Sales executives can update their own customers"
ON public.customers FOR UPDATE TO authenticated
USING (
    sales_executive_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'sales')
    )
);

-- Admins have full access to customers table
CREATE POLICY "Admins have full access to customers table"
ON public.customers FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));


-- RLS Policies for credit_transactions table
CREATE POLICY "Sales executives can view their customers' transactions"
ON public.credit_periods FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM customers
        WHERE customers.id = credit_periods.customer_id
        AND customers.sales_executive_id = auth.uid()
    ) OR
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'sales')
    )
);

CREATE POLICY "Sales executives can insert transactions for their customers"
ON public.credit_periods FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM customers
        WHERE customers.id = credit_periods.customer_id
        AND customers.sales_executive_id = auth.uid()
    ) OR
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'sales')
    )
);

-- Admins have full access to credit_periods table
CREATE POLICY "Admins have full access to credit_periods table"
ON public.credit_periods FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Add trigger to update updated_at timestamp for customers
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON public.customers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Add RLS policy for customers to view their own data
CREATE POLICY "Customers can view their own data"
ON public.customers FOR SELECT TO authenticated
USING (
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'sales')
    )
);

-- Add RLS policy for customers to view their own credit periods
CREATE POLICY "Customers can view their own credit periods"
ON public.credit_periods FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM customers
        WHERE customers.id = credit_periods.customer_id
        AND customers.user_id = auth.uid()
    ) OR
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'sales')
    )
); 