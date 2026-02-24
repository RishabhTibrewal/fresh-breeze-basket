---
name: Procurement Frontend Enhancement
overview: Enhance the existing procurement frontend pages to fully utilize the new backend features including auto-create invoice from GRN, improved status transitions, workflow navigation, and better user experience.
todos: []
---

# Procurement Frontend Enhancement Plan

## Current State Analysis

The frontend already has basic pages for:

- Purchase Orders (list, create, detail)
- Goods Receipts (list, create, detail)
- Purchase Invoices (list, create, detail)
- Supplier Payments (list, create, detail)

However, they need enhancements to utilize the new backend features:

- Auto-create invoice from GRN endpoint (`/api/purchase-invoices/from-grn`)
- Status transition validations and feedback
- Workflow navigation between related entities
- Better status indicators and workflow visualization

## Implementation Plan

### Phase 1: API Service Updates

**File:** `frontend/src/api/purchaseInvoices.ts`

- Add `createFromGRN` method to use the new `/api/purchase-invoices/from-grn` endpoint
- Method should accept `goods_receipt_id` and optional fields (supplier_invoice_number, invoice_date, due_date, tax_amount, discount_amount, notes)

### Phase 2: Enhanced Detail Pages

#### 2.1 Purchase Order Detail Page

**File:** `frontend/src/pages/admin/PurchaseOrderDetail.tsx`**Enhancements:**

- Add workflow status indicator showing current stage (PO → GRN → Invoice → Payment)
- Add "Create GRN" button when PO is `approved` or `ordered` (with validation)
- Display received quantities vs ordered quantities per item
- Show related GRNs with links
- Show related invoices with links
- Add status transition buttons (Approve, Cancel) with proper validation feedback
- Display validation errors when status transitions are invalid

#### 2.2 Goods Receipt Detail Page

**File:** `frontend/src/pages/admin/GoodsReceiptDetail.tsx`**Enhancements:**

- Add comprehensive item details table (received, accepted, rejected quantities)
- Add "Create Invoice from GRN" button when GRN is `completed` (uses new auto-create endpoint)
- Add status transition buttons (Inspect, Approve, Reject, Complete) with validation
- Show related PO with link
- Show related invoice if exists with link
- Display warehouse information
- Add inspection notes section
- Show batch numbers and expiry dates for items

#### 2.3 Purchase Invoice Detail Page

**File:** `frontend/src/pages/admin/PurchaseInvoiceDetail.tsx`**Enhancements:**

- Add payment summary card showing paid amount, balance, and status
- Add "Record Payment" button linking to create payment page
- Show related PO and GRN with links
- Display payment history table
- Add status indicators (pending, partial, paid, overdue)
- Show due date prominently with overdue highlighting
- Add invoice file upload/view functionality

#### 2.4 Supplier Payment Detail Page

**File:** `frontend/src/pages/admin/SupplierPaymentDetail.tsx`**Enhancements:**

- Show related invoice with link
- Display payment method details
- Add status transition buttons (Mark as Processing, Complete, Fail, Cancel)
- Show payment reference details (cheque number, transaction ID, etc.)

### Phase 3: Enhanced Create Pages

#### 3.1 Create Purchase Invoice Page

**File:** `frontend/src/pages/admin/CreatePurchaseInvoice.tsx`**Enhancements:**

- Add "Quick Create from GRN" section at top
- When GRN is selected, show "Auto-fill from GRN" button that calls `createFromGRN`
- Pre-populate all fields from GRN data
- Show validation errors if GRN is not completed
- Add link to GRN detail page

### Phase 4: Workflow Navigation Components

**New File:** `frontend/src/components/procurement/ProcurementWorkflow.tsx`**Purpose:** Reusable component showing workflow status and navigation**Features:**

- Visual workflow indicator (PO → GRN → Invoice → Payment)
- Clickable stages that navigate to related entities
- Status badges for each stage
- Progress indicator showing current stage

**New File:** `frontend/src/components/procurement/StatusTransitionButton.tsx`**Purpose:** Reusable button component for status transitions**Features:**

- Validates status transition before showing button
- Shows confirmation dialog for critical transitions
- Displays validation errors
- Handles loading states

### Phase 5: Enhanced List Pages

#### 5.1 Purchase Orders List

**File:** `frontend/src/pages/admin/PurchaseOrders.tsx`**Enhancements:**

- Add quick action buttons (View, Create GRN, View GRNs)
- Show received quantity progress per PO
- Add status filter with all new statuses
- Add links to related GRNs and invoices

#### 5.2 Goods Receipts List

**File:** `frontend/src/pages/admin/GoodsReceipts.tsx`**Enhancements:**

- Add "Create Invoice" quick action for completed GRNs
- Show related PO number with link
- Add status filter
- Show completion status

#### 5.3 Purchase Invoices List

**File:** `frontend/src/pages/admin/PurchaseInvoices.tsx`**Enhancements:**

- Show payment status (paid amount / total amount)
- Highlight overdue invoices
- Add "Record Payment" quick action
- Show due date column
- Add date range filters

### Phase 6: Error Handling & Validation

**Enhancements across all pages:**

- Display validation errors from backend (status transition errors, quantity errors, etc.)
- Show helpful error messages
- Prevent invalid actions (disable buttons for invalid transitions)
- Add confirmation dialogs for critical actions (cancel PO, reject GRN, etc.)

### Phase 7: Status Badge Components

**New File:** `frontend/src/components/procurement/StatusBadge.tsx`**Purpose:** Consistent status badge styling across procurement pages**Features:**

- Color-coded badges for each status
- Consistent styling for PO, GRN, Invoice, and Payment statuses

## File Structure

```javascript
frontend/src/
├── api/
│   └── purchaseInvoices.ts (update)
├── components/
│   └── procurement/
│       ├── ProcurementWorkflow.tsx (new)
│       ├── StatusTransitionButton.tsx (new)
│       └── StatusBadge.tsx (new)
└── pages/
    └── admin/
        ├── PurchaseOrderDetail.tsx (enhance)
        ├── GoodsReceiptDetail.tsx (enhance)
        ├── PurchaseInvoiceDetail.tsx (enhance)
        ├── SupplierPaymentDetail.tsx (enhance)
        ├── CreatePurchaseInvoice.tsx (enhance)
        ├── PurchaseOrders.tsx (enhance)
        ├── GoodsReceipts.tsx (enhance)
        └── PurchaseInvoices.tsx (enhance)
```

## Key Features to Implement

1. **Auto-Create Invoice from GRN**

- Button on GRN detail page
- Quick action in GRN list
- Pre-filled form in create invoice page

2. **Workflow Navigation**

- Links between PO → GRN → Invoice → Payment
- Visual workflow indicator
- Quick navigation between related entities

3. **Status Transitions**

- Validation feedback
- Disabled buttons for invalid transitions
- Confirmation dialogs for critical actions

4. **Enhanced Detail Views**

- Complete information display
- Related entities with links
- Action buttons with proper validation

5. **Better UX**

- Loading states
- Error messages
- Success notifications
- Progress indicators

## Implementation Order

1. Update API service (`purchaseInvoices.ts`)