# Procurement Workflow Documentation

## Overview

The procurement workflow in Fresh Breeze Basket manages the complete lifecycle of purchasing goods from suppliers, from creating purchase orders to making payments. This document describes the complete flow, status transitions, business rules, and API endpoints.

## Workflow Stages

### 1. Purchase Order (PO) Creation

**Status Flow:** `draft` → `pending` → `approved` → `ordered` → `partially_received` → `received` → `cancelled`

#### Status Definitions

- **draft**: Initial state when PO is created but not yet submitted
- **pending**: PO submitted for approval
- **approved**: PO approved by admin, ready to be sent to supplier
- **ordered**: PO sent to supplier (auto-updated when GRN is created)
- **partially_received**: Some items from PO have been received (auto-updated when GRN is completed)
- **received**: All items from PO have been received (auto-updated when GRN is completed)
- **cancelled**: PO cancelled (terminal state)

#### Business Rules

- PO items can only be modified when status is `draft` or `pending`
- PO status automatically transitions to `ordered` when first GRN is created
- PO status automatically transitions to `partially_received` or `received` based on received quantities when GRN is completed
- Cannot approve a cancelled PO
- Cannot modify PO items when PO is `approved`, `ordered`, `partially_received`, or `received`

#### API Endpoints

- `POST /api/purchase-orders` - Create new PO
- `GET /api/purchase-orders` - List all POs
- `GET /api/purchase-orders/:id` - Get PO by ID
- `PUT /api/purchase-orders/:id` - Update PO (with validations)
- `POST /api/purchase-orders/:id/approve` - Approve PO
- `DELETE /api/purchase-orders/:id` - Cancel PO

---

### 2. Goods Receipt Note (GRN) Creation

**Status Flow:** `pending` → `inspected` → `approved` → `completed` / `rejected`

#### Status Definitions

- **pending**: GRN created, goods received but not yet inspected
- **inspected**: Goods inspected by warehouse staff
- **approved**: GRN approved, ready to complete
- **completed**: GRN completed, inventory updated (terminal state)
- **rejected**: GRN rejected (terminal state)

#### Business Rules

- GRN can only be created for POs with status `approved`, `ordered`, or `partially_received`
- Cannot receive more quantity than ordered (validated per item)
- When GRN is created, PO status automatically transitions to `ordered` (if not already)
- When GRN is completed:
  - Warehouse inventory is updated with accepted quantities
  - PO item `received_quantity` is updated
  - PO status automatically transitions to `partially_received` or `received` based on all PO items

#### API Endpoints

- `POST /api/goods-receipts` - Create new GRN (requires PO to be approved/ordered)
- `GET /api/goods-receipts` - List all GRNs
- `GET /api/goods-receipts/:id` - Get GRN by ID
- `PUT /api/goods-receipts/:id` - Update GRN (with status validation)
- `POST /api/goods-receipts/:id/receive` - Receive goods and update inventory
- `POST /api/goods-receipts/:id/complete` - Complete GRN (updates inventory and PO status)

---

### 3. Purchase Invoice Creation

**Status Flow:** `pending` → `partial` → `paid` / `overdue` / `cancelled`

#### Status Definitions

- **pending**: Invoice created, awaiting payment
- **partial**: Partial payment received
- **paid**: Invoice fully paid (terminal state)
- **overdue**: Invoice due date passed without full payment (auto-updated daily)
- **cancelled**: Invoice cancelled (terminal state)

#### Business Rules

- Invoice can only be created for GRNs with status `completed`
- Invoice amounts should not significantly exceed GRN received amounts (validated)
- Invoice status automatically updates when payments are made:
  - `paid_amount >= total_amount` → Status = `paid`
  - `paid_amount > 0` → Status = `partial`
  - `paid_amount = 0` → Status = `pending`
- Invoices with `due_date < today` and status `pending` or `partial` are automatically marked as `overdue` (checked daily)
- Cannot create payment for cancelled or fully paid invoices

#### API Endpoints

- `POST /api/purchase-invoices` - Create new invoice (requires GRN to be completed)
- `POST /api/purchase-invoices/from-grn` - Auto-create invoice from completed GRN (pre-populated)
- `GET /api/purchase-invoices` - List all invoices
- `GET /api/purchase-invoices/:id` - Get invoice by ID
- `PUT /api/purchase-invoices/:id` - Update invoice (with status validation)
- `POST /api/purchase-invoices/:id/upload` - Upload invoice file

---

### 4. Supplier Payment

**Status Flow:** `pending` → `processing` → `completed` / `failed` / `cancelled`

#### Status Definitions

- **pending**: Payment created, awaiting processing
- **processing**: Payment being processed
- **completed**: Payment completed successfully (terminal state)
- **failed**: Payment failed (can be retried)
- **cancelled**: Payment cancelled (terminal state)

#### Business Rules

- Payment amount cannot exceed invoice balance (remaining amount)
- Payment amount must be greater than 0
- Only `completed` payments count towards invoice `paid_amount`
- When payment status changes to `completed`, invoice `paid_amount` and `status` are automatically updated
- When payment is `failed` or `cancelled`, it's excluded from invoice `paid_amount` calculation
- Cannot create payment for cancelled invoices
- Cannot create payment for fully paid invoices

#### API Endpoints

- `POST /api/supplier-payments` - Create new payment (validates amount)
- `GET /api/supplier-payments` - List all payments
- `GET /api/supplier-payments/:id` - Get payment by ID
- `PUT /api/supplier-payments/:id` - Update payment (with status validation)

---

## Complete Flow Diagram

```
┌─────────────────┐
│ Create PO       │
│ Status: draft   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Submit PO       │
│ Status: pending │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Approve PO      │
│ Status: approved│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Send to Supplier│
│ Status: ordered │ (auto-updated when GRN created)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Goods Arrive    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create GRN      │
│ Status: pending │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Inspect Goods   │
│ Status: inspected│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Approve GRN     │
│ Status: approved│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Complete GRN    │
│ Status: completed│
│                 │
│ • Update inventory│
│ • Update PO received_qty│
│ • Update PO status│
│   (partially_received│
│    or received) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create Invoice  │
│ Status: pending │
│ (from GRN)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Set Due Date    │
└────────┬────────┘
         │
         ▼
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐ ┌─────────┐
│ Overdue │ │ Pending │
│ (auto)  │ │ Payment │
└────┬────┘ └────┬─────┘
     │          │
     └────┬─────┘
          │
          ▼
┌─────────────────┐
│ Create Payment  │
│ Status: pending │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Process Payment │
│ Status: processing│
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐ ┌─────────┐
│ Success │ │ Failed  │
│ completed│ │ failed  │
└────┬────┘ └────┬─────┘
     │          │
     └────┬─────┘
          │
          ▼
┌─────────────────┐
│ Update Invoice  │
│ • paid_amount   │
│ • status        │
│   (partial/paid)│
└─────────────────┘
```

## Status Transition Rules

### Purchase Order Status Transitions

| Current Status | Allowed Transitions |
|---------------|-------------------|
| draft | pending, cancelled |
| pending | approved, cancelled |
| approved | ordered, cancelled |
| ordered | partially_received, received, cancelled |
| partially_received | received, cancelled |
| received | (none - terminal) |
| cancelled | (none - terminal) |

### GRN Status Transitions

| Current Status | Allowed Transitions |
|---------------|-------------------|
| pending | inspected, rejected |
| inspected | approved, rejected |
| approved | completed, rejected |
| rejected | (none - terminal) |
| completed | (none - terminal) |

### Invoice Status Transitions

| Current Status | Allowed Transitions |
|---------------|-------------------|
| pending | partial, paid, overdue, cancelled |
| partial | paid, overdue, cancelled |
| paid | (none - terminal) |
| overdue | paid, partial, cancelled |
| cancelled | (none - terminal) |

### Payment Status Transitions

| Current Status | Allowed Transitions |
|---------------|-------------------|
| pending | processing, cancelled |
| processing | completed, failed, cancelled |
| completed | (none - terminal) |
| failed | pending, processing, cancelled |
| cancelled | (none - terminal) |

## Validation Rules

### Quantity Validations

1. **GRN Quantities:**
   - Cannot receive more than ordered quantity per item
   - Validates: `quantity_received <= (ordered_quantity - already_received_quantity)`

2. **Invoice Amounts:**
   - Invoice amount should not significantly exceed GRN received amount
   - Allows tolerance for tax/discount adjustments (up to 20% higher)

### Payment Validations

1. **Payment Amount:**
   - Must be greater than 0
   - Cannot exceed invoice balance: `amount <= (total_amount - paid_amount)`
   - Cannot create payment for cancelled invoices
   - Cannot create payment for fully paid invoices

### Status Transition Validations

All status transitions are validated against the transition rules defined above. Invalid transitions will return a `ValidationError` with details about allowed transitions.

## Automated Processes

### 1. PO Status Auto-Update

- **When GRN is created:** PO status → `ordered` (if PO is `approved` or `pending`)
- **When GRN is completed:** PO status → `partially_received` or `received` based on received quantities

### 2. Invoice Status Auto-Update

- **When payment is created/updated:** Invoice `paid_amount` and `status` are automatically recalculated
- **Daily overdue check:** Invoices with `due_date < today` and status `pending` or `partial` are marked as `overdue`

### 3. Inventory Updates

- **When GRN is completed:** Warehouse inventory is updated with accepted quantities from GRN items

## Error Handling

All validation errors return HTTP 400 with a `ValidationError` containing:
- Error message describing the validation failure
- Details about allowed values/transitions

Common error scenarios:
- Invalid status transition
- Quantity exceeds available amount
- Payment exceeds invoice balance
- Attempting to modify restricted resources

## Best Practices

1. **Always check PO status before creating GRN** - Use the validation middleware
2. **Verify GRN is completed before creating invoice** - Required by validation
3. **Set appropriate due dates** - Helps with overdue detection
4. **Use auto-create invoice endpoint** - Pre-populates data from GRN
5. **Monitor overdue invoices** - Check daily via the scheduler
6. **Only count completed payments** - Failed/cancelled payments don't count towards paid_amount

## API Usage Examples

### Create PO and Complete Flow

```javascript
// 1. Create PO
POST /api/purchase-orders
{
  "supplier_id": "...",
  "warehouse_id": "...",
  "items": [...]
}

// 2. Approve PO
POST /api/purchase-orders/:id/approve

// 3. Create GRN (auto-updates PO to 'ordered')
POST /api/goods-receipts
{
  "purchase_order_id": "...",
  "items": [...]
}

// 4. Complete GRN (auto-updates PO status and inventory)
POST /api/goods-receipts/:id/complete

// 5. Create Invoice from GRN
POST /api/purchase-invoices/from-grn
{
  "goods_receipt_id": "...",
  "supplier_invoice_number": "...",
  "invoice_date": "2024-01-15",
  "due_date": "2024-02-15"
}

// 6. Create Payment
POST /api/supplier-payments
{
  "purchase_invoice_id": "...",
  "amount": 1000,
  "payment_method": "bank_transfer",
  "payment_date": "2024-01-20"
}
```

## Scheduled Tasks

### Overdue Invoice Detection

- **Frequency:** Daily (every 24 hours)
- **Function:** `checkOverdueInvoices()`
- **Action:** Marks invoices with `due_date < today` and status `pending` or `partial` as `overdue`
- **Initialization:** Runs on server startup and then every 24 hours

## Database Schema

All procurement tables are in the `procurement` schema:

- `procurement.purchase_orders`
- `procurement.purchase_order_items`
- `procurement.goods_receipts`
- `procurement.goods_receipt_items`
- `procurement.purchase_invoices`
- `procurement.supplier_payments`

All tables include `company_id` for multi-tenant isolation.

