-- Update user_roles table to add is_primary field if it doesn't exist
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

-- Set is_primary = true for the first role of each user per company
UPDATE public.user_roles ur1
SET is_primary = true
WHERE ur1.id IN (
    SELECT ur2.id
    FROM public.user_roles ur2
    WHERE ur2.user_id = ur1.user_id 
      AND ur2.company_id = ur1.company_id
    ORDER BY ur2.created_at ASC
    LIMIT 1
);

-- Ensure only one primary role per user per company
-- This constraint will be enforced at application level
-- as PostgreSQL doesn't support partial unique constraints easily
