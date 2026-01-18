-- Purchase Orders Table
CREATE TABLE IF NOT EXISTS procurement.purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  warehouse_id UUID REFERENCES warehouses(id),
  status VARCHAR(50) DEFAULT 'draft',
  po_number VARCHAR(100) UNIQUE NOT NULL,
  order_date DATE DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  total_amount DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  terms_conditions TEXT,
  created_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_status CHECK (status IN ('draft', 'pending', 'approved', 'ordered', 'partially_received', 'received', 'cancelled'))
);

-- Purchase Order Items Table
CREATE TABLE IF NOT EXISTS procurement.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID REFERENCES procurement.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  line_total DECIMAL(10,2) NOT NULL,
  received_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT positive_quantity CHECK (quantity > 0),
  CONSTRAINT valid_received_quantity CHECK (received_quantity >= 0 AND received_quantity <= quantity)
);

-- Goods Receipts (GRN) Table
CREATE TABLE IF NOT EXISTS procurement.goods_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID REFERENCES procurement.purchase_orders(id),
  grn_number VARCHAR(100) UNIQUE NOT NULL,
  receipt_date DATE DEFAULT CURRENT_DATE,
  warehouse_id UUID REFERENCES warehouses(id),
  received_by UUID REFERENCES profiles(id),
  inspected_by UUID REFERENCES profiles(id),
  inspection_notes TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  total_received_amount DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_grn_status CHECK (status IN ('pending', 'inspected', 'approved', 'rejected', 'completed'))
);

-- Goods Receipt Items Table
CREATE TABLE IF NOT EXISTS procurement.goods_receipt_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goods_receipt_id UUID REFERENCES procurement.goods_receipts(id) ON DELETE CASCADE,
  purchase_order_item_id UUID REFERENCES procurement.purchase_order_items(id),
  product_id UUID REFERENCES products(id),
  quantity_received INTEGER NOT NULL,
  quantity_accepted INTEGER NOT NULL,
  quantity_rejected INTEGER DEFAULT 0,
  unit_price DECIMAL(10,2) NOT NULL,
  batch_number VARCHAR(100),
  expiry_date DATE,
  condition_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT positive_received CHECK (quantity_received > 0),
  CONSTRAINT valid_quantities CHECK (quantity_accepted + quantity_rejected = quantity_received)
);

-- Purchase Invoices Table
CREATE TABLE IF NOT EXISTS procurement.purchase_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID REFERENCES procurement.purchase_orders(id),
  goods_receipt_id UUID REFERENCES procurement.goods_receipts(id),
  invoice_number VARCHAR(100) UNIQUE NOT NULL,
  supplier_invoice_number VARCHAR(100),
  invoice_date DATE NOT NULL,
  due_date DATE,
  subtotal DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  paid_amount DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',
  invoice_file_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_invoice_status CHECK (status IN ('pending', 'partial', 'paid', 'overdue', 'cancelled'))
);

-- Supplier Payments Table
CREATE TABLE IF NOT EXISTS procurement.supplier_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_invoice_id UUID REFERENCES procurement.purchase_invoices(id),
  supplier_id UUID REFERENCES suppliers(id),
  payment_number VARCHAR(100) UNIQUE NOT NULL,
  payment_date DATE NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  reference_number VARCHAR(100),
  bank_name VARCHAR(255),
  cheque_number VARCHAR(100),
  transaction_id VARCHAR(255),
  notes TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_payment_method CHECK (payment_method IN ('cash', 'bank_transfer', 'cheque', 'card', 'other')),
  CONSTRAINT valid_payment_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'))
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_po_supplier ON procurement.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_warehouse ON procurement.purchase_orders(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON procurement.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_poi_po ON procurement.purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_poi_product ON procurement.purchase_order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_grn_po ON procurement.goods_receipts(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_grn_warehouse ON procurement.goods_receipts(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_gri_grn ON procurement.goods_receipt_items(goods_receipt_id);
CREATE INDEX IF NOT EXISTS idx_pi_po ON procurement.purchase_invoices(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_pi_status ON procurement.purchase_invoices(status);
CREATE INDEX IF NOT EXISTS idx_sp_invoice ON procurement.supplier_payments(purchase_invoice_id);
CREATE INDEX IF NOT EXISTS idx_sp_supplier ON procurement.supplier_payments(supplier_id);

-- Add RLS policies for procurement schema
ALTER TABLE procurement.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement.goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement.goods_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement.purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement.supplier_payments ENABLE ROW LEVEL SECURITY;

-- Admin has full access to all procurement tables
CREATE POLICY "Admin has full access to purchase_orders"
ON procurement.purchase_orders FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admin has full access to purchase_order_items"
ON procurement.purchase_order_items FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admin has full access to goods_receipts"
ON procurement.goods_receipts FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admin has full access to goods_receipt_items"
ON procurement.goods_receipt_items FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admin has full access to purchase_invoices"
ON procurement.purchase_invoices FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admin has full access to supplier_payments"
ON procurement.supplier_payments FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Sales can view procurement data
CREATE POLICY "Sales can view purchase_orders"
ON procurement.purchase_orders FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'sales')
  )
);

CREATE POLICY "Sales can view purchase_order_items"
ON procurement.purchase_order_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'sales')
  )
);

CREATE POLICY "Sales can view goods_receipts"
ON procurement.goods_receipts FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'sales')
  )
);

CREATE POLICY "Sales can view goods_receipt_items"
ON procurement.goods_receipt_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'sales')
  )
);

CREATE POLICY "Sales can view purchase_invoices"
ON procurement.purchase_invoices FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'sales')
  )
);

CREATE POLICY "Sales can view supplier_payments"
ON procurement.supplier_payments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'sales')
  )
);
