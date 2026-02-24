---
name: File Uploads, Bills, POS, and Purchase Orders
overview: Implement file uploads (categories, products, purchase bills) with image compression, invoice/bill generation (HTML for POS, PDF for customers), POS ordering page with optional customer details, and purchase order management system.
todos:
  - id: image-compression
    content: Create image compression utility using Sharp library
    status: completed
  - id: upload-endpoints
    content: Add upload endpoints for categories, products, and purchase bills with compression
    status: completed
  - id: supplier-schema
    content: Create database migration for suppliers table with RLS policies
    status: completed
  - id: procurement-schema
    content: Create procurement schema and all procurement tables (purchase_orders, purchase_order_items, goods_receipts, goods_receipt_items, purchase_invoices, supplier_payments)
    status: completed
  - id: supplier-backend
    content: Create supplier controllers and routes (CRUD operations)
    status: completed
  - id: supplier-frontend
    content: Create supplier management pages (list, create, edit)
    status: completed
  - id: purchase-order-backend
    content: Create purchase order controllers and routes (CRUD operations)
    status: completed
  - id: goods-receipt-backend
    content: Create goods receipt controllers and routes (GRN management)
    status: completed
  - id: purchase-invoice-backend
    content: Create purchase invoice controllers and routes
    status: completed
  - id: supplier-payment-backend
    content: Create supplier payment controllers and routes
    status: completed
  - id: invoice-generation
    content: Implement HTML invoice for POS and PDF bill for customers
    status: completed
  - id: pos-page
    content: Create POS ordering page with optional customer details (name, phone only)
    status: completed
  - id: purchase-order-frontend
    content: Create purchase order management pages (list, create, detail)
    status: completed
  - id: goods-receipt-frontend
    content: Create goods receipt management pages (list, create, detail)
    status: completed
  - id: purchase-invoice-frontend
    content: Create purchase invoice management pages (list, detail, upload)
    status: completed
  - id: supplier-payment-frontend
    content: Create supplier payment management pages (list, create)
    status: completed
  - id: integrate-uploads
    content: Update category and product forms to use new upload endpoints
    status: completed
  - id: order-detail-buttons
    content: Add invoice/bill generation buttons to order detail pages
    status: completed
---

# File Uploads, Bills, POS, and Purchase Orders Implementation Plan

## Overview

This plan implements 8 major features: file uploads with compression, invoice/bill generation, POS ordering system, and purchase order management.

## 1. File Upload Endpoints (Backend)

### 1.1 Category Image Upload

**File**: `backend/src/routes/uploads.ts`

- Add endpoint: `POST /api/uploads/category/:categoryId`
- Upload single image for category
- Compress image before upload
- Update category `image_url` in database

### 1.2 Product Image Upload

**File**: `backend/src/routes/uploads.ts`

- Add endpoint: `POST /api/uploads/product/:productId`
- Support multiple images (array upload)
- Compress each image before upload
- Store in `product_images` table with `is_primary` flag
- Update existing product image endpoints to use R2

### 1.3 Purchase Invoice Upload

**File**: `backend/src/routes/uploads.ts`

- Add endpoint: `POST /api/uploads/purchase-invoice`
- Accept image or PDF
- Link to purchase invoice via `purchase_invoice_id`
- Store in `purchase_invoices/` folder in R2

## 2. Image Compression Utility

### 2.1 Compression Service

**File**: `backend/src/utils/imageCompression.ts` (new)

- Install `sharp` package for image processing
- Function: `compressImage(buffer, quality, maxWidth)`
- Quality: 80% (moderate compression)
- Max width: 1920px for categories/products, 1200px for bills
- Preserve aspect ratio
- Return compressed buffer

### 2.2 Integration

- Integrate compression into all upload endpoints
- Skip compression for PDFs
- Apply compression before R2 upload

## 3. Invoice/Bill Generation

### 3.1 POS Invoice (HTML)

**File**: `backend/src/controllers/invoices.ts` (new)

- Endpoint: `GET /api/invoices/pos/:orderId`
- Generate HTML invoice for POS machine
- Include: order items, prices, totals, order number, date
- Minimal design optimized for thermal printers
- Return HTML string

### 3.2 Customer Bill (PDF)

**File**: `backend/src/controllers/invoices.ts`

- Endpoint: `GET /api/invoices/customer/:orderId`
- Install `pdfkit` or `puppeteer` for PDF generation
- Include: company logo, customer details, order items, totals, payment info
- Professional design
- Return PDF buffer with proper headers

### 3.3 Routes

**File**: `backend/src/routes/invoices.ts` (new)

- Register invoice routes
- Protect with authentication middleware

## 4. Database Schema Updates

### 4.1 Suppliers Table

**File**: `backend/src/db/migrations/create_suppliers_table.sql` (new)

```sql
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_code text unique,              -- optional: SUP-001
  name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
   VARCHAR(100),
  payment_terms TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


create table supplier_bank_accounts (
  id uuid primary key default uuid_generate_v4(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  bank_name text,
  account_number text,
  ifsc_code text,
  account_holder_name text,
  is_primary boolean default false,
  created_at timestamptz default now()
);


-- Add RLS policies for suppliers
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin has full access to suppliers"
ON suppliers FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Sales can view suppliers"
ON suppliers FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'sales')
  )
);
```

### 4.2 Create Procurement Schema

**File**: `backend/src/db/migrations/create_procurement_schema.sql` (new)

```sql
-- Create procurement schema
CREATE SCHEMA IF NOT EXISTS procurement;

-- Grant permissions
GRANT USAGE ON SCHEMA procurement TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA procurement TO authenticated;
```

### 4.3 Procurement Tables

**File**: `backend/src/db/migrations/create_procurement_tables.sql` (new)

```sql
-- Purchase Orders Table
CREATE TABLE procurement.purchase_orders (
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
CREATE TABLE procurement.purchase_order_items (
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
CREATE TABLE procurement.goods_receipts (
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
CREATE TABLE procurement.goods_receipt_items (
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
CREATE TABLE procurement.purchase_invoices (
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
CREATE TABLE procurement.supplier_payments (
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
CREATE INDEX idx_po_supplier ON procurement.purchase_orders(supplier_id);
CREATE INDEX idx_po_warehouse ON procurement.purchase_orders(warehouse_id);
CREATE INDEX idx_po_status ON procurement.purchase_orders(status);
CREATE INDEX idx_poi_po ON procurement.purchase_order_items(purchase_order_id);
CREATE INDEX idx_poi_product ON procurement.purchase_order_items(product_id);
CREATE INDEX idx_grn_po ON procurement.goods_receipts(purchase_order_id);
CREATE INDEX idx_grn_warehouse ON procurement.goods_receipts(warehouse_id);
CREATE INDEX idx_gri_grn ON procurement.goods_receipt_items(goods_receipt_id);
CREATE INDEX idx_pi_po ON procurement.purchase_invoices(purchase_order_id);
CREATE INDEX idx_pi_status ON procurement.purchase_invoices(status);
CREATE INDEX idx_sp_invoice ON procurement.supplier_payments(purchase_invoice_id);
CREATE INDEX idx_sp_supplier ON procurement.supplier_payments(supplier_id);

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
```

## 5. POS Ordering Page

### 5.1 Frontend Page

**File**: `frontend/src/pages/pos/CreatePOSOrder.tsx` (new)

- Simplified order creation form
- Product selection with barcode scanner support (future)
- Cart display
- Customer section (optional):
- Name field (optional)
- Phone number field (optional)
- Payment method selection
- Generate HTML invoice on order completion
- Print invoice functionality

### 5.2 Backend Endpoint

**File**: `backend/src/controllers/orders.ts`

- Modify/create endpoint: `POST /api/pos/orders`
- Accept optional `customer_name` and `customer_phone`
- Create order without requiring full customer record
- Store customer info in order notes or separate POS customers table

### 5.3 Routes

**File**: `backend/src/routes/pos.ts` (new)

- Register POS-specific routes
- May reuse existing order routes with different validation

## 6. Supplier Management

### 6.1 Backend Controllers

**File**: `backend/src/controllers/suppliers.ts` (new)

- `createSupplier` - Create new supplier
- `getSuppliers` - List all suppliers with filters
- `getSupplierById` - Get supplier details
- `updateSupplier` - Update supplier information
- `deleteSupplier` - Soft delete (set is_active = false)

### 6.2 Backend Routes

**File**: `backend/src/routes/suppliers.ts` (new)

- `POST /api/suppliers` - Create supplier
- `GET /api/suppliers` - List suppliers
- `GET /api/suppliers/:id` - Get supplier details
- `PUT /api/suppliers/:id` - Update supplier
- `DELETE /api/suppliers/:id` - Delete supplier

### 6.3 Frontend Pages

**File**: `frontend/src/pages/admin/Suppliers.tsx` (new)

- List all suppliers
- Filters: active/inactive, search by name
- Create new supplier button
- Edit/delete actions

**File**: `frontend/src/pages/admin/SupplierForm.tsx` (new)

- Form to create/edit supplier
- All supplier fields (name, contact, address, etc.)
- Save/cancel actions

## 7. Purchase Order Management

### 7.1 Backend Controllers

**File**: `backend/src/controllers/purchaseOrders.ts` (new)

- `createPurchaseOrder` - Create new PO with items
- `getPurchaseOrders` - List all POs with filters
- `getPurchaseOrderById` - Get PO details
- `updatePurchaseOrder` - Update PO status/items
- `approvePurchaseOrder` - Approve PO (change status to approved)
- `generatePONumber` - Auto-generate PO number (e.g., PO-2024-001)

**File**: `backend/src/controllers/goodsReceipts.ts` (new)

- `createGoodsReceipt` - Create GRN from purchase order
- `getGoodsReceipts` - List all GRNs with filters
- `getGoodsReceiptById` - Get GRN details
- `updateGoodsReceipt` - Update GRN status/items
- `receiveGoods` - Mark items as received, update warehouse inventory
- `generateGRNNumber` - Auto-generate GRN number (e.g., GRN-2024-001)

**File**: `backend/src/controllers/purchaseInvoices.ts` (new)

- `createPurchaseInvoice` - Create invoice from GRN
- `getPurchaseInvoices` - List all invoices with filters
- `getPurchaseInvoiceById` - Get invoice details
- `updatePurchaseInvoice` - Update invoice details
- `uploadInvoiceFile` - Upload invoice PDF/image
- `generateInvoiceNumber` - Auto-generate invoice number

**File**: `backend/src/controllers/supplierPayments.ts` (new)

- `createSupplierPayment` - Record payment against invoice
- `getSupplierPayments` - List all payments with filters
- `getSupplierPaymentById` - Get payment details
- `updateSupplierPayment` - Update payment status
- `generatePaymentNumber` - Auto-generate payment number

### 7.2 Backend Routes

**File**: `backend/src/routes/purchaseOrders.ts` (new)

- `POST /api/purchase-orders` - Create PO
- `GET /api/purchase-orders` - List POs
- `GET /api/purchase-orders/:id` - Get PO details
- `PUT /api/purchase-orders/:id` - Update PO
- `POST /api/purchase-orders/:id/approve` - Approve PO
- `DELETE /api/purchase-orders/:id` - Cancel PO

**File**: `backend/src/routes/goodsReceipts.ts` (new)

- `POST /api/goods-receipts` - Create GRN
- `GET /api/goods-receipts` - List GRNs
- `GET /api/goods-receipts/:id` - Get GRN details
- `PUT /api/goods-receipts/:id` - Update GRN
- `POST /api/goods-receipts/:id/receive` - Receive goods and update inventory
- `POST /api/goods-receipts/:id/complete` - Complete GRN

**File**: `backend/src/routes/purchaseInvoices.ts` (new)

- `POST /api/purchase-invoices` - Create invoice
- `GET /api/purchase-invoices` - List invoices
- `GET /api/purchase-invoices/:id` - Get invoice details
- `PUT /api/purchase-invoices/:id` - Update invoice
- `POST /api/purchase-invoices/:id/upload` - Upload invoice file

**File**: `backend/src/routes/supplierPayments.ts` (new)

- `POST /api/supplier-payments` - Record payment
- `GET /api/supplier-payments` - List payments
- `GET /api/supplier-payments/:id` - Get payment details
- `PUT /api/supplier-payments/:id` - Update payment

### 7.3 Frontend Pages

**File**: `frontend/src/pages/admin/PurchaseOrders.tsx` (new)

- List all purchase orders
- Filters: status, warehouse, supplier (from suppliers table)
- Create new PO button
- Show supplier name from relationship

**File**: `frontend/src/pages/admin/CreatePurchaseOrder.tsx` (new)

- Form to create purchase order
- Supplier selection dropdown (from suppliers table)
- Warehouse selection
- Product selection with quantities
- Expected delivery date
- Auto-generate PO number
- Save as draft or submit

**File**: `frontend/src/pages/admin/PurchaseOrderDetail.tsx` (new)

- View PO details
- Upload purchase bill
- Receive items (update received quantities)
- Update PO status
- View associated bills

## 7. Frontend API Services

### 7.1 Upload Service

**File**: `frontend/src/api/uploads.ts` (new)

- `uploadCategoryImage(categoryId, file)`
- `uploadProductImage(productId, file)` 
- `uploadProductImages(productId, files[])`
- `uploadPurchaseBill(purchaseOrderId, file)`

### 7.2 Invoice Service

**File**: `frontend/src/api/invoices.ts` (new)

- `getPOSInvoice(orderId)` - Returns HTML
- `getCustomerBill(orderId)` - Returns PDF blob
- `downloadCustomerBill(orderId)` - Trigger download

### 7.3 Supplier Service

**File**: `frontend/src/api/suppliers.ts` (new)

- `createSupplier(data)`
- `getSuppliers(filters)`
- `getSupplierById(id)`
- `updateSupplier(id, data)`
- `deleteSupplier(id)`

### 7.4 Purchase Order Service

**File**: `frontend/src/api/purchaseOrders.ts` (new)

- `createPurchaseOrder(data)`
- `getPurchaseOrders(filters)`
- `getPurchaseOrderById(id)`
- `updatePurchaseOrder(id, data)`
- `approvePurchaseOrder(id)`
- `cancelPurchaseOrder(id)`

### 7.5 Goods Receipt Service

**File**: `frontend/src/api/goodsReceipts.ts` (new)

- `createGoodsReceipt(data)`
- `getGoodsReceipts(filters)`
- `getGoodsReceiptById(id)`
- `updateGoodsReceipt(id, data)`
- `receiveGoods(id, items)`
- `completeGoodsReceipt(id)`

### 7.6 Purchase Invoice Service

**File**: `frontend/src/api/purchaseInvoices.ts` (new)

- `createPurchaseInvoice(data)`
- `getPurchaseInvoices(filters)`
- `getPurchaseInvoiceById(id)`
- `updatePurchaseInvoice(id, data)`
- `uploadInvoiceFile(id, file)`

### 7.7 Supplier Payment Service

**File**: `frontend/src/api/supplierPayments.ts` (new)

- `createSupplierPayment(data)`
- `getSupplierPayments(filters)`
- `getSupplierPaymentById(id)`
- `updateSupplierPayment(id, data)`

## 8. Integration Points

### 8.1 Update Category Form

**File**: `frontend/src/pages/admin/CategoryList.tsx`

- Add image upload component
- Use new upload endpoint
- Display uploaded image

### 8.2 Update Product Form

**File**: `frontend/src/pages/admin/ProductForm.tsx`

- Update to use new R2 upload endpoints
- Support multiple image uploads
- Show compression status

### 8.3 Order Detail Pages

**File**: `frontend/src/pages/sales/OrderDetail.tsx`**File**: `frontend/src/pages/admin/AdminOrderDetails.tsx`

- Add "Generate Invoice" button (HTML for POS)
- Add "Generate Bill" button (PDF for customers)
- Download/print functionality

## 9. Dependencies to Install

### Backend

- `sharp` - Image compression
- `pdfkit` or `puppeteer` - PDF generation
- `@types/sharp` - TypeScript types

### Frontend

- No new dependencies (use existing components)

## 10. File Structure

```javascript
backend/src/
  controllers/
    invoices.ts (new)
    purchaseOrders.ts (new)
    goodsReceipts.ts (new)
    purchaseInvoices.ts (new)
    supplierPayments.ts (new)
    suppliers.ts (new)
  routes/
    invoices.ts (new)
    pos.ts (new)
    purchaseOrders.ts (new)
    goodsReceipts.ts (new)
    purchaseInvoices.ts (new)
    supplierPayments.ts (new)
    suppliers.ts (new)
  utils/
    imageCompression.ts (new)
  db/migrations/
    create_procurement_schema.sql (new)
    create_suppliers_table.sql (new)
    create_procurement_tables.sql (new)

frontend/src/
  pages/
    pos/
      CreatePOSOrder.tsx (new)
    admin/
      Suppliers.tsx (new)
      SupplierForm.tsx (new)
      PurchaseOrders.tsx (new)
      CreatePurchaseOrder.tsx (new)
      PurchaseOrderDetail.tsx (new)
      GoodsReceipts.tsx (new)
      CreateGoodsReceipt.tsx (new)
      GoodsReceiptDetail.tsx (new)
      PurchaseInvoices.tsx (new)
      PurchaseInvoiceDetail.tsx (new)
      SupplierPayments.tsx (new)
  api/
    uploads.ts (new)
    invoices.ts (new)
    suppliers.ts (new)
    purchaseOrders.ts (new)
    goodsReceipts.ts (new)
    purchaseInvoices.ts (new)
    supplierPayments.ts (new)
```

## 11. Implementation Order

1. Image compression utility
2. Upload endpoints (categories, products, purchase invoices)
3. Database migrations (procurement schema, suppliers, procurement tables)
4. Supplier management backend (controllers, routes)
5. Supplier management frontend pages
6. Purchase order backend (controllers, routes)
7. Goods receipt backend (controllers, routes)
8. Purchase invoice backend (controllers, routes)
9. Supplier payment backend (controllers, routes)
10. Invoice/bill generation (HTML & PDF)