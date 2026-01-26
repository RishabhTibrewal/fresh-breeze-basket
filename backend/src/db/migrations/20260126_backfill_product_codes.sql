-- Backfill product codes for existing products
-- Generate product codes for products that don't have one (format: PROD-001, PROD-002, etc.)

DO $$
DECLARE
  company_record RECORD;
  product_record RECORD;
  counter INTEGER;
  new_code VARCHAR(100);
BEGIN
  -- Loop through each company
  FOR company_record IN SELECT DISTINCT company_id FROM public.products WHERE product_code IS NULL OR product_code = ''
  LOOP
    counter := 1;
    
    -- Loop through products without codes for this company
    FOR product_record IN 
      SELECT id FROM public.products 
      WHERE company_id = company_record.company_id 
      AND (product_code IS NULL OR product_code = '')
      ORDER BY created_at ASC
    LOOP
      -- Generate code: PROD-001, PROD-002, etc.
      new_code := 'PROD-' || LPAD(counter::TEXT, 3, '0');
      
      -- Check if code already exists (shouldn't happen, but be safe)
      WHILE EXISTS (SELECT 1 FROM public.products WHERE company_id = company_record.company_id AND product_code = new_code)
      LOOP
        counter := counter + 1;
        new_code := 'PROD-' || LPAD(counter::TEXT, 3, '0');
      END LOOP;
      
      -- Update product with generated code
      UPDATE public.products 
      SET product_code = new_code
      WHERE id = product_record.id;
      
      counter := counter + 1;
    END LOOP;
  END LOOP;
END $$;

-- Set default tax to 0 if null
UPDATE public.products SET tax = 0 WHERE tax IS NULL;

-- Set default HSN code to empty string if null
UPDATE public.products SET hsn_code = '' WHERE hsn_code IS NULL;

