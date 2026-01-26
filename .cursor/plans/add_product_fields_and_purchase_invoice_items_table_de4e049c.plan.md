---
name: Add Product Fields and Purchase Invoice Items Table
overview: Add product_code, HSN_code, and tax fields to products table, add these fields plus unit to purchase_order_items and goods_receipt_items tables, and create purchase_invoices_items table to store detailed product information for each purchase invoice.
todos: []
---

# Add Product Fields and Purchase Invoice Items Table

## Overview

This plan adds product identification fields (product_code, HSN_code, tax) to the products table, adds these fields plus unit to purchase_order_items and goods_receipt_items tables for historical data preservation, and creates a purchase_invoices_items table to store detailed product line items for purchase invoices. This ensures consistent product information storage across the entire procurement workflow (PO → GRN → Invoice).

## Database Changes

### 1. Add Fields to Products Table

**File:** `backend/src/db/migrations/20260126_add_product_fields.sql` (new)Add three new columns to `public.products`:

- `product_code VARCHAR(100)` - Unique product code/sku per company
- `hsn_code VARCHAR(50)` - HSN (Harmonized System of Nomenclature) code for tax purposes
- `tax DECIMAL(5,2)` - Tax percentage (e.g., 5.00 for 5%, 18.00 for 18%)

Add constraints:

- Unique constraint on `(company_id, product_code)` to ensure product codes are unique per company
- Index on `product_code` for faster lookups
- Index on `hsn_code` for tax reporting

### 2. Add Fields to Purchase Order Items Table

**File:** `backend/src/db/migrations/20260126_add_fields_to_po_items.sql` (new)Add columns to `procurement.purchase_order_items`:

- `unit VARCHAR(50)` - Unit of measurement from product at time of PO creation
- `product_code VARCHAR(100)` - Product code from product at time of PO creation
- `hsn_code VARCHAR(50)` - HSN code from product at time of PO creation
- `tax_percentage DECIMAL(5,2)` - Tax percentage from product at time of PO creation

### 3. Add Fields to Goods Receipt Items Table

**File:** `backend/src/db/migrations/20260126_add_fields_to_grn_items.sql` (new)Add columns to `procurement.goods_receipt_items`:

- `unit VARCHAR(50)` - Unit of measurement from product at time of GRN creation
- `product_code VARCHAR(100)` - Product code from product at time of GRN creation
- `hsn_code VARCHAR(50)` - HSN code from product at time of GRN creation
- `tax_percentage DECIMAL(5,2)` - Tax percentage from product at time of GRN creation

### 4. Create Purchase Invoice Items Table

**File:** `backend/src/db/migrations/20260126_create_purchase_invoice_items.sql` (new)Create `procurement.purchase_invoice_items` table with:

- `id UUID PRIMARY KEY`
- `purchase_invoice_id UUID` - References purchase_invoices(id)
- `product_id UUID` - References products(id)
- `goods_receipt_item_id UUID` - Optional reference to goods_receipt_items(id) for traceability
- `quantity DECIMAL(10,2)` - Quantity invoiced
- `unit VARCHAR(50)` - Unit of measurement (e.g., "kg", "piece", "box") from product at time of invoice
- `unit_price DECIMAL(10,2)` - Unit price
- `tax_percentage DECIMAL(5,2)` - Tax percentage from product at time of invoice
- `tax_amount DECIMAL(10,2)` - Calculated tax amount for this line
- `discount_amount DECIMAL(10,2)` - Line-level discount (optional)
- `line_total DECIMAL(10,2)` - Total after tax and discount
- `hsn_code VARCHAR(50)` - HSN code from product at time of invoice
- `product_code VARCHAR(100)` - Product code from product at time of invoice
- `company_id UUID` - Company reference
- `created_at TIMESTAMP`
- `updated_at TIMESTAMP`

Add:

- Foreign key constraints
- Check constraints for positive quantities and amounts
- Indexes on `purchase_invoice_id`, `product_id`, `company_id`
- RLS policies (similar to purchase_invoices)

### 5. Update RLS Policies

**File:** `backend/src/db/migrations/20260126_add_purchase_invoice_items_rls.sql` (new)Add RLS policies for `purchase_invoice_items`:

- Admins: Full access
- Accounts: Full access (create, read, update, delete)
- Warehouse managers: Read access
- Sales: Read access

## Backend Changes

### 6. Update Product Model/Interface

**Files:**

- `backend/src/types/database.ts` (if exists) or relevant type definitions
- Update Product interface to include `product_code`, `hsn_code`, `tax`

### 7. Update Purchase Order Controllers

**File:** `backend/src/controllers/purchaseOrders.ts`**Changes:**

- **`createPurchaseOrder`**: When creating PO items, fetch product details and store:
- `unit` from product's `unit_type`
- `product_code` from product
- `hsn_code` from product
- `tax_percentage` from product
- **`updatePurchaseOrder`**: When updating PO items, fetch and store product details (unit, product_code, hsn_code, tax_percentage)
- **`getPurchaseOrderById`**: No changes needed (fields will be included automatically)
- **`getPurchaseOrders`**: No changes needed (fields will be included automatically)

### 8. Update Goods Receipt Controllers

**File:** `backend/src/controllers/goodsReceipts.ts`**Changes:**

- **`createGoodsReceipt`**: When creating GRN items, fetch product details and store:
- `unit` from product's `unit_type`
- `product_code` from product
- `hsn_code` from product
- `tax_percentage` from product
- **`updateGoodsReceipt`**: When updating GRN items, fetch and store product details (unit, product_code, hsn_code, tax_percentage)
- **`completeGoodsReceipt`**: No changes needed (fields already stored)
- **`getGoodsReceiptById`**: No changes needed (fields will be included automatically)
- **`getGoodsReceipts`**: No changes needed (fields will be included automatically)

### 9. Update Purchase Invoice Controllers

**File:** `backend/src/controllers/purchaseInvoices.ts`**Changes:**

- **`createInvoiceFromGRN`**: After creating invoice, copy items from `goods_receipt_items` to `purchase_invoice_items`
- For each GRN item, fetch product details (including tax, HSN code, product code, unit_type)
- Store unit from product's `unit_type` field
- Calculate tax amount per line: `(quantity * unit_price) * (tax_percentage / 100)`
- Calculate line_total: `(quantity * unit_price) + tax_amount - discount_amount`
- Insert into `purchase_invoice_items`
- **`createPurchaseInvoice`**: Accept `items` array in request body, create invoice items
- Validate items array
- For each item, fetch product details (including unit_type)
- Store unit from product's `unit_type` field
- Calculate tax and totals per line
- Insert invoice and items
- **`updatePurchaseInvoice`**: Support updating invoice items
- If `items` provided, delete existing items and insert new ones
- Recalculate invoice totals from items
- **`getPurchaseInvoiceById`**: Include `purchase_invoice_items` in response
- Fetch items separately and attach to invoice object
- **`getPurchaseInvoices`**: Optionally include items (for list view, may not be needed)

### 10. Update Purchase Invoice Routes

**File:** `backend/src/routes/purchaseInvoices.ts`No changes needed - existing routes will work with updated controllers.

### 11. Update Validation Middleware

**File:** `backend/src/middleware/procurementValidation.ts`**Changes:**

- **`validateInvoiceAmounts`**: Update to validate that invoice totals match sum of line items
- Fetch `purchase_invoice_items` for the invoice
- Sum up line totals
- Compare with invoice `total_amount`
- Allow small tolerance for rounding differences

## Frontend Changes

### 12. Update Product API Types

**File:** `frontend/src/api/products.ts`Add fields to Product interface:

- `product_code?: string`
- `hsn_code?: string`
- `tax?: number`

### 13. Update Product Form

**Files:**

- `frontend/src/pages/admin/Products.tsx` or product form component
- Add input fields for:
- Product Code (required, unique per company)
- HSN Code (optional)
- Tax Percentage (optional, default 0)

### 14. Update Purchase Order Types

**File:** `frontend/src/api/purchaseOrders.ts`Update `PurchaseOrderItem` interface to include:

- `unit?: string`
- `product_code?: string`
- `hsn_code?: string`
- `tax_percentage?: number`

### 15. Update Goods Receipt Types

**File:** `frontend/src/api/goodsReceipts.ts`Update `GoodsReceiptItem` interface to include:

- `unit?: string`
- `product_code?: string`
- `hsn_code?: string`
- `tax_percentage?: number`

### 16. Update Purchase Invoice Types

**File:** `frontend/src/api/purchaseInvoices.ts`Add `PurchaseInvoiceItem` interface:

```typescript
interface PurchaseInvoiceItem {
  id: string;
  purchase_invoice_id: string;
  product_id: string;
  goods_receipt_item_id?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  tax_percentage: number;
  tax_amount: number;
  discount_amount: number;
  line_total: number;
  hsn_code?: string;
  product_code?: string;
  products?: any;
}
```

Update `PurchaseInvoice` interface to include:

- `purchase_invoice_items?: PurchaseInvoiceItem[]`

### 17. Update Purchase Order Pages

**Files:**

- `frontend/src/pages/admin/CreatePurchaseOrder.tsx`
- `frontend/src/pages/admin/PurchaseOrderDetail.tsx`
- `frontend/src/pages/admin/PurchaseOrders.tsx`

**Changes:**

- Display product code, HSN code, and unit in PO items tables
- Show unit alongside quantity (e.g., "10 kg", "5 pieces")
- Display tax percentage if available

### 18. Update Goods Receipt Pages

**Files:**

- `frontend/src/pages/admin/CreateGoodsReceipt.tsx`
- `frontend/src/pages/admin/GoodsReceiptDetail.tsx`
- `frontend/src/pages/admin/GoodsReceipts.tsx`

**Changes:**

- Display product code, HSN code, and unit in GRN items tables
- Show unit alongside quantity (e.g., "10 kg", "5 pieces")
- Display tax percentage if available

### 19. Update Create Purchase Invoice Page

**File:** `frontend/src/pages/admin/CreatePurchaseInvoice.tsx`**Changes:**

- When creating from GRN, show items table with:
- Product name, code, HSN code
- Quantity, Unit (e.g., "kg", "piece")
- Unit price
- Tax percentage (from product)
- Tax amount (calculated)
- Line total
- Allow editing quantities, prices, discounts per line
- Show total tax and total amount summary
- In edit mode, show existing invoice items in editable table

### 20. Update Purchase Invoice Detail Page

**File:** `frontend/src/pages/admin/PurchaseInvoiceDetail.tsx`**Changes:**

- Display invoice items table showing:
- Product code, HSN code, Product name
- Quantity, Unit (e.g., "kg", "piece"), Unit price
- Tax %, Tax amount
- Discount
- Line total
- Show subtotal, total tax, total discount, grand total
- Format HSN code and product code prominently

## Data Migration

### 21. Backfill Product Codes

**File:** `backend/src/db/migrations/20260126_backfill_product_codes.sql` (new)

- Generate product codes for existing products (e.g., PROD-001, PROD-002)
- Set default tax to 0 if null
- Set default HSN code to empty string if null

### 22. Migrate Existing PO Items Data

**File:** `backend/src/db/migrations/20260126_backfill_po_items_fields.sql` (new)

- For existing purchase_order_items, fetch product details and populate:
- `unit` from product's `unit_type`
- `product_code` from product
- `hsn_code` from product
- `tax_percentage` from product (or 0 if not available)

### 23. Migrate Existing GRN Items Data

**File:** `backend/src/db/migrations/20260126_backfill_grn_items_fields.sql` (new)

- For existing goods_receipt_items, fetch product details and populate:
- `unit` from product's `unit_type`
- `product_code` from product
- `hsn_code` from product
- `tax_percentage` from product (or 0 if not available)

### 24. Migrate Existing Invoice Data (Optional)

**File:** `backend/src/db/migrations/20260126_migrate_existing_invoice_items.sql` (new)

- For existing purchase invoices, create `purchase_invoice_items` from related `goods_receipt_items`
- Use product details from GRN items (unit, product_code, hsn_code, tax_percentage) which should already be populated
- Calculate tax amount and line totals
- This ensures historical data integrity

## Testing Considerations

- Verify product code uniqueness per company
- Test PO creation with items (verify unit, product_code, hsn_code, tax_percentage are stored)
- Test GRN creation with items (verify unit, product_code, hsn_code, tax_percentage are stored)
- Test invoice creation with items
- Test PO/GRN/Invoice editing with item updates
- Verify tax calculations are correct
- Test RLS policies for all item tables
- Verify invoice totals match sum of line items
- Verify historical data preservation (product details stored even if product changes later)

## Notes

- Product code should be unique per company, not globally
- Tax percentage stored as decimal (e.g., 5.00 for 5%)
- Invoice items are copied from GRN items (not referenced) for data integrity
- HSN code, product code, unit, and tax_percentage are stored in PO items, GRN items, and invoice items to preserve historical values even if product details change later