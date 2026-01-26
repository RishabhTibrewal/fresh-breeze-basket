-- Create Purchase Invoice Items Table
CREATE TABLE IF NOT EXISTS procurement.purchase_invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_invoice_id UUID NOT NULL REFERENCES procurement.purchase_invoices(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  goods_receipt_item_id UUID REFERENCES procurement.goods_receipt_items(id) ON DELETE SET NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(50),
  unit_price DECIMAL(10,2) NOT NULL,
  tax_percentage DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  line_total DECIMAL(10,2) NOT NULL,
  hsn_code VARCHAR(50),
  product_code VARCHAR(100),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT positive_quantity CHECK (quantity > 0),
  CONSTRAINT positive_line_total CHECK (line_total >= 0),
  CONSTRAINT non_negative_tax CHECK (tax_amount >= 0),
  CONSTRAINT non_negative_discount CHECK (discount_amount >= 0)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pii_invoice ON procurement.purchase_invoice_items(purchase_invoice_id);
CREATE INDEX IF NOT EXISTS idx_pii_product ON procurement.purchase_invoice_items(product_id);
CREATE INDEX IF NOT EXISTS idx_pii_company ON procurement.purchase_invoice_items(company_id);
CREATE INDEX IF NOT EXISTS idx_pii_product_code ON procurement.purchase_invoice_items(product_code);
CREATE INDEX IF NOT EXISTS idx_pii_hsn_code ON procurement.purchase_invoice_items(hsn_code);
CREATE INDEX IF NOT EXISTS idx_pii_grn_item ON procurement.purchase_invoice_items(goods_receipt_item_id);

-- Enable RLS
ALTER TABLE procurement.purchase_invoice_items ENABLE ROW LEVEL SECURITY;

-- Add comments
COMMENT ON TABLE procurement.purchase_invoice_items IS 'Stores detailed product line items for purchase invoices';
COMMENT ON COLUMN procurement.purchase_invoice_items.unit IS 'Unit of measurement from product at time of invoice';
COMMENT ON COLUMN procurement.purchase_invoice_items.product_code IS 'Product code from product at time of invoice';
COMMENT ON COLUMN procurement.purchase_invoice_items.hsn_code IS 'HSN code from product at time of invoice';
COMMENT ON COLUMN procurement.purchase_invoice_items.tax_percentage IS 'Tax percentage from product at time of invoice';

