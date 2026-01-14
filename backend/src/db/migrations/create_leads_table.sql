-- Create leads table for Lead Management System
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sales_executive_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Lead Information
    company_name VARCHAR(255),
    contact_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    contact_position VARCHAR(100),
    
    -- Lead Details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    source VARCHAR(100) NOT NULL DEFAULT 'other', -- website, referral, cold_call, email, social_media, trade_show, other
    estimated_value DECIMAL(12, 2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Lead Status
    stage VARCHAR(50) NOT NULL DEFAULT 'new', -- new, contacted, qualified, proposal, negotiation, won, lost
    priority VARCHAR(20) NOT NULL DEFAULT 'medium', -- low, medium, high, urgent
    
    -- Additional Information
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    website VARCHAR(255),
    notes TEXT,
    
    -- Dates
    expected_close_date DATE,
    last_contact_date TIMESTAMP WITH TIME ZONE,
    converted_at TIMESTAMP WITH TIME ZONE,
    lost_at TIMESTAMP WITH TIME ZONE,
    lost_reason TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_leads_sales_executive ON public.leads(sales_executive_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON public.leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_priority ON public.leads(priority);
CREATE INDEX IF NOT EXISTS idx_leads_source ON public.leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_expected_close_date ON public.leads(expected_close_date);

-- Enable Row Level Security
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for leads
-- Sales executives can view and manage their own leads
CREATE POLICY "Sales executives can view their own leads"
    ON public.leads FOR SELECT
    TO authenticated
    USING (
        sales_executive_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Sales executives can insert their own leads
CREATE POLICY "Sales executives can create their own leads"
    ON public.leads FOR INSERT
    TO authenticated
    WITH CHECK (
        sales_executive_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Sales executives can update their own leads
CREATE POLICY "Sales executives can update their own leads"
    ON public.leads FOR UPDATE
    TO authenticated
    USING (
        sales_executive_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    )
    WITH CHECK (
        sales_executive_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Sales executives can delete their own leads
CREATE POLICY "Sales executives can delete their own leads"
    ON public.leads FOR DELETE
    TO authenticated
    USING (
        sales_executive_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_leads_updated_at_trigger
    BEFORE UPDATE ON public.leads
    FOR EACH ROW
    EXECUTE FUNCTION update_leads_updated_at();
