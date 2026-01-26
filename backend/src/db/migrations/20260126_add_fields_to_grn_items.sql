-- Add product detail fields to goods_receipt_items table
ALTER TABLE procurement.goods_receipt_items 
ADD COLUMN IF NOT EXISTS unit VARCHAR(50),
ADD COLUMN IF NOT EXISTS product_code VARCHAR(100),
ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS tax_percentage DECIMAL(5,2) DEFAULT 0;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_gri_product_code ON procurement.goods_receipt_items(product_code);
CREATE INDEX IF NOT EXISTS idx_gri_hsn_code ON procurement.goods_receipt_items(hsn_code);

-- Add comments
COMMENT ON COLUMN procurement.goods_receipt_items.unit IS 'Unit of measurement from product at time of GRN creation';
COMMENT ON COLUMN procurement.goods_receipt_items.product_code IS 'Product code from product at time of GRN creation';
COMMENT ON COLUMN procurement.goods_receipt_items.hsn_code IS 'HSN code from product at time of GRN creation';
COMMENT ON COLUMN procurement.goods_receipt_items.tax_percentage IS 'Tax percentage from product at time of GRN creation';

