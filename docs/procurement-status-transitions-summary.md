# Procurement Status Transitions Summary

## Overview

This document summarizes how status changes work automatically and manually throughout the Complete Procurement Flow.

## Purchase Order (PO) Status Flow

### Manual Status Transitions

1. **draft → pending**
   - **Action:** Submit for Approval
   - **Who:** Warehouse Manager or Admin
   - **Endpoint:** `POST /api/purchase-orders/:id/submit`
   - **Button:** "Submit for Approval" (shown when status is `draft`)

2. **pending → approved**
   - **Action:** Approve PO
   - **Who:** Accounts or Admin
   - **Endpoint:** `POST /api/purchase-orders/:id/approve`
   - **Button:** "Approve PO" (shown when status is `pending`)

3. **draft/pending → cancelled**
   - **Action:** Cancel PO
   - **Who:** Admin only
   - **Endpoint:** `DELETE /api/purchase-orders/:id`
   - **Button:** "Cancel PO" (shown when status is `draft` or `pending`)

### Automated Status Transitions

4. **approved → ordered** (AUTO)
   - **Trigger:** When GRN is created
   - **Location:** `backend/src/controllers/goodsReceipts.ts` (line 166-176)
   - **Logic:** If PO status is `approved`, automatically update to `ordered` when first GRN is created
   - **Reason:** Indicates goods have been ordered from supplier

5. **ordered → partially_received** (AUTO)
   - **Trigger:** When GRN is completed
   - **Location:** `backend/src/controllers/goodsReceipts.ts` (line 719-750)
   - **Logic:** If some PO items are received but not all, update status to `partially_received`
   - **Condition:** `anyPartiallyReceived = true` AND `allFullyReceived = false`

6. **ordered → received** (AUTO)
   - **Trigger:** When GRN is completed
   - **Location:** `backend/src/controllers/goodsReceipts.ts` (line 719-750)
   - **Logic:** If all PO items are fully received, update status to `received`
   - **Condition:** `allFullyReceived = true`

7. **partially_received → received** (AUTO)
   - **Trigger:** When subsequent GRN is completed
   - **Location:** `backend/src/controllers/goodsReceipts.ts` (line 719-750)
   - **Logic:** If all PO items become fully received, update status to `received`

## Goods Receipt Note (GRN) Status Flow

### Manual Status Transitions

1. **pending → inspected**
   - **Action:** Inspect Goods
   - **Who:** Warehouse Manager or Admin
   - **Method:** Update GRN status

2. **inspected → approved**
   - **Action:** Approve Inspection
   - **Who:** Accounts or Admin
   - **Method:** Update GRN status

3. **approved → completed**
   - **Action:** Complete GRN
   - **Who:** Accounts or Admin
   - **Endpoint:** `POST /api/goods-receipts/:id/complete`
   - **Button:** "Complete GRN" (shown when status allows completion)
   - **Side Effects:**
     - Updates warehouse inventory with accepted quantities
     - Updates PO item `received_quantity`
     - Auto-updates PO status (see PO automated transitions above)

4. **Any status → rejected**
   - **Action:** Reject GRN
   - **Who:** Accounts or Admin
   - **Method:** Update GRN status

### Automated Status Transitions

- **None** - All GRN status transitions are manual

## Purchase Invoice Status Flow

### Manual Status Transitions

1. **pending → cancelled**
   - **Action:** Cancel Invoice
   - **Who:** Admin only
   - **Method:** Update invoice status

### Automated Status Transitions

2. **pending → partial** (AUTO)
   - **Trigger:** When payment is created/updated
   - **Location:** `backend/src/controllers/supplierPayments.ts` (line 350-396)
   - **Logic:** If `paid_amount > 0` AND `paid_amount < total_amount`, update status to `partial`
   - **Condition:** `totalPaid > 0` AND `totalPaid < invoiceData.total_amount`

3. **pending → paid** (AUTO)
   - **Trigger:** When payment is created/updated
   - **Location:** `backend/src/controllers/supplierPayments.ts` (line 350-396)
   - **Logic:** If `paid_amount >= total_amount`, update status to `paid`
   - **Condition:** `totalPaid >= invoiceData.total_amount`

4. **partial → paid** (AUTO)
   - **Trigger:** When additional payment is made
   - **Location:** `backend/src/controllers/supplierPayments.ts` (line 350-396)
   - **Logic:** If `paid_amount >= total_amount`, update status to `paid`

5. **pending/partial → overdue** (AUTO - Scheduled)
   - **Trigger:** Daily scheduled task
   - **Location:** `backend/src/utils/invoiceScheduler.ts`
   - **Logic:** If `due_date < today` AND status is `pending` or `partial`, update status to `overdue`
   - **Frequency:** Runs every 24 hours
   - **Initialization:** Called on server startup via `initInvoiceScheduler()`

## Supplier Payment Status Flow

### Manual Status Transitions

1. **pending → processing**
   - **Action:** Mark as Processing
   - **Who:** Accounts or Admin
   - **Method:** Update payment status

2. **processing → completed**
   - **Action:** Mark as Completed
   - **Who:** Accounts or Admin
   - **Method:** Update payment status
   - **Side Effects:**
     - Updates invoice `paid_amount` (only completed payments count)
     - Auto-updates invoice status (see Invoice automated transitions above)

3. **processing → failed**
   - **Action:** Mark as Failed
   - **Who:** Accounts or Admin
   - **Method:** Update payment status

4. **Any status → cancelled**
   - **Action:** Cancel Payment
   - **Who:** Accounts or Admin
   - **Method:** Update payment status

### Automated Status Transitions

- **None** - All payment status transitions are manual, but they trigger invoice status updates

## Complete Flow Diagram with Status Transitions

```
┌─────────────────┐
│ Create PO       │
│ Status: draft   │ ← Manual creation
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Submit PO       │ ← Manual: Submit for Approval button
│ Status: pending │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Approve PO      │ ← Manual: Approve PO button
│ Status: approved│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create GRN      │ ← Manual: Create GRN button
│ Status: pending │
└────────┬────────┘
         │
         ▼ AUTO: PO status → 'ordered'
┌─────────────────┐
│ Inspect GRN     │ ← Manual: Update status
│ Status: inspected│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Approve GRN     │ ← Manual: Update status
│ Status: approved│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Complete GRN    │ ← Manual: Complete GRN button
│ Status: completed│
│                 │
│ • Update inventory│
│ • Update PO received_qty│
│ • Update PO status│ ← AUTO: 'partially_received' or 'received'
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create Invoice  │ ← Manual: Create Invoice button
│ Status: pending │
└────────┬────────┘
         │
         ▼ AUTO (Daily): Check due_date
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
│ Create Payment  │ ← Manual: Record Payment button
│ Status: pending │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Process Payment │ ← Manual: Mark as Processing
│ Status: processing│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Complete Payment│ ← Manual: Mark as Completed
│ Status: completed│
│                 │
│ • Update invoice│ ← AUTO: Update paid_amount and status
│   paid_amount   │
│ • Update invoice│
│   status        │
│   (partial/paid)│
└─────────────────┘
```

## Key Automated Processes

### 1. PO Status Auto-Update When GRN is Created
- **File:** `backend/src/controllers/goodsReceipts.ts` (line 166-176)
- **Trigger:** `createGoodsReceipt()` function
- **Action:** PO status → `ordered` (if PO was `approved`)
- **Purpose:** Indicates goods have been ordered from supplier

### 2. PO Status Auto-Update When GRN is Completed
- **File:** `backend/src/controllers/goodsReceipts.ts` (line 719-750)
- **Trigger:** `completeGoodsReceipt()` function
- **Actions:**
  - Updates PO item `received_quantity` for each item
  - Calculates if all items fully received or partially received
  - Updates PO status to `received` or `partially_received`
- **Purpose:** Track receipt progress automatically

### 3. Invoice Status Auto-Update When Payment is Made
- **File:** `backend/src/controllers/supplierPayments.ts` (line 350-396)
- **Trigger:** `createSupplierPayment()` and `updateSupplierPayment()` functions
- **Actions:**
  - Recalculates total `paid_amount` from all completed payments
  - Updates invoice `paid_amount` field
  - Updates invoice status:
    - `paid` if `paid_amount >= total_amount`
    - `partial` if `paid_amount > 0` but `< total_amount`
    - `pending` if `paid_amount = 0`
- **Purpose:** Keep invoice payment status synchronized

### 4. Overdue Invoice Detection (Scheduled)
- **File:** `backend/src/utils/invoiceScheduler.ts`
- **Trigger:** Daily scheduled task (every 24 hours)
- **Initialization:** Called on server startup via `initInvoiceScheduler()`
- **Action:** Marks invoices as `overdue` if:
  - `due_date < today`
  - Status is `pending` or `partial`
- **Purpose:** Automatically flag overdue invoices

## Validation Rules

All status transitions are validated by middleware in `backend/src/middleware/procurementValidation.ts`:

- **PO Status Transitions:** Validates transitions match allowed paths
- **GRN Creation:** Ensures GRN can only be created for `approved`, `ordered`, or `partially_received` POs
- **Invoice Creation:** Ensures invoice can only be created for `completed` GRNs
- **Payment Amount:** Ensures payment doesn't exceed invoice balance
- **PO Item Modification:** Prevents modifying items when PO is `approved` or beyond

## Summary

- **Manual Transitions:** draft→pending (submit), pending→approved (approve), GRN status changes, payment status changes
- **Automated Transitions:** approved→ordered (GRN created), ordered→partially_received/received (GRN completed), invoice status updates (payments made), overdue detection (scheduled)

All automated transitions ensure data consistency and reduce manual work while maintaining business rule compliance.

