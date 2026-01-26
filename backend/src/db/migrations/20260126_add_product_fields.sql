-- Add product identification fields to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS product_code VARCHAR(100),
ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS tax DECIMAL(5,2) DEFAULT 0;

-- Add unique constraint on (company_id, product_code) to ensure product codes are unique per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_company_product_code 
ON public.products(company_id, product_code) 
WHERE product_code IS NOT NULL;

-- Add index on product_code for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_product_code ON public.products(product_code);

-- Add index on hsn_code for tax reporting
CREATE INDEX IF NOT EXISTS idx_products_hsn_code ON public.products(hsn_code);

-- Add comment to columns
COMMENT ON COLUMN public.products.product_code IS 'Unique product code/SKU per company';
COMMENT ON COLUMN public.products.hsn_code IS 'HSN (Harmonized System of Nomenclature) code for tax purposes';
COMMENT ON COLUMN public.products.tax IS 'Tax percentage (e.g., 5.00 for 5%, 18.00 for 18%)';

