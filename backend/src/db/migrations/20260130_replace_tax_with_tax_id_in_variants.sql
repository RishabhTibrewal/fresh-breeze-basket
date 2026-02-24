-- Migration: Replace tax (DECIMAL) with tax_id (UUID) in product_variants table
-- References the taxes table for centralized tax management

-- Step 1: Add tax_id column
ALTER TABLE public.product_variants
ADD COLUMN IF NOT EXISTS tax_id UUID REFERENCES public.taxes(id) ON DELETE SET NULL;

-- Step 2: Create index for tax_id
CREATE INDEX IF NOT EXISTS idx_product_variants_tax_id ON public.product_variants(tax_id) WHERE tax_id IS NOT NULL;

-- Step 3: Migrate existing tax values to tax_id (if any exist)
-- This creates a default tax entry for each unique tax rate, then links variants to it
DO $$
DECLARE
  tax_record RECORD;
  default_tax_id UUID;
BEGIN
  -- For each unique tax rate in variants, create or find a matching tax entry
  FOR tax_record IN
    SELECT DISTINCT 
      pv.tax,
      pv.company_id
    FROM public.product_variants pv
    WHERE pv.tax IS NOT NULL 
      AND pv.tax > 0
      AND pv.tax_id IS NULL
  LOOP
    -- Try to find an existing tax with matching rate
    SELECT id INTO default_tax_id
    FROM public.taxes
    WHERE company_id = tax_record.company_id
      AND rate = tax_record.tax
      AND is_active = true
    LIMIT 1;

    -- If no matching tax found, create a default one
    IF default_tax_id IS NULL THEN
      INSERT INTO public.taxes (name, code, rate, company_id, is_active)
      VALUES (
        'Tax ' || tax_record.tax || '%',
        'TAX_' || REPLACE(tax_record.tax::text, '.', '_'),
        tax_record.tax,
        tax_record.company_id,
        true
      )
      RETURNING id INTO default_tax_id;
    END IF;

    -- Update all variants with this tax rate to use the tax_id
    UPDATE public.product_variants
    SET tax_id = default_tax_id
    WHERE company_id = tax_record.company_id
      AND tax = tax_record.tax
      AND tax_id IS NULL;
  END LOOP;
END $$;

-- Step 4: Drop the tax column (after migration)
ALTER TABLE public.product_variants
DROP COLUMN IF EXISTS tax;

-- Step 5: Update comments
COMMENT ON COLUMN public.product_variants.tax_id IS 'Reference to taxes table for centralized tax management';

