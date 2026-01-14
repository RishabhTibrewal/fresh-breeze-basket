-- Migration to update leads table: rename last_contact_date to last_follow_up and add next_follow_up

-- Rename last_contact_date to last_follow_up
ALTER TABLE public.leads 
RENAME COLUMN last_contact_date TO last_follow_up;

-- Add next_follow_up column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'leads'
        AND column_name = 'next_follow_up'
    ) THEN
        ALTER TABLE public.leads
        ADD COLUMN next_follow_up TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Create index for next_follow_up for better query performance
CREATE INDEX IF NOT EXISTS idx_leads_next_follow_up ON public.leads(next_follow_up);
