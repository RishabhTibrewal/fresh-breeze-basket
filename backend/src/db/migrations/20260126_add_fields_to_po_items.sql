-- Add product detail fields to purchase_order_items table
ALTER TABLE procurement.purchase_order_items 
ADD COLUMN IF NOT EXISTS unit VARCHAR(50),
ADD COLUMN IF NOT EXISTS product_code VARCHAR(100),
ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS tax_percentage DECIMAL(5,2) DEFAULT 0;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_poi_product_code ON procurement.purchase_order_items(product_code);
CREATE INDEX IF NOT EXISTS idx_poi_hsn_code ON procurement.purchase_order_items(hsn_code);

-- Add comments
COMMENT ON COLUMN procurement.purchase_order_items.unit IS 'Unit of measurement from product at time of PO creation';
COMMENT ON COLUMN procurement.purchase_order_items.product_code IS 'Product code from product at time of PO creation';
COMMENT ON COLUMN procurement.purchase_order_items.hsn_code IS 'HSN code from product at time of PO creation';
COMMENT ON COLUMN procurement.purchase_order_items.tax_percentage IS 'Tax percentage from product at time of PO creation';

