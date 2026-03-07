---
name: Sales Payments Page
overview: Create a Payments page at `/sales/payments` that displays all payments in a table format with filtering capabilities, and includes functionality to add new payments for orders. The page will follow the same pattern as SupplierPayments but for sales order payments.
todos: []
---

# Sales Payments Page Implementation

## Overview

Create a comprehensive Payments page for the sales module that displays all payment records from the `payments` table, with filtering, search, and the ability to create new payment records for orders.

## Backend Changes

### 1. Create `getAllPayments` Controller

**File**: `backend/src/controllers/payments.ts`

- Add new `getAllPayments` function similar to `getSupplierPayments`
- Filter by `company_id` for multi-tenancy
- Support query filters: `order_id`, `status`, `payment_method`, `date_from`, `date_to`
- For sales executives: filter payments to only show orders linked to their customers
- For admins: show all payments
- Include order details (order_number, customer info) in the response
- Return enriched payment data with related order information

### 2. Update Payment Routes

**File**: `backend/src/routes/payments.ts`

- Add `GET /` route that calls `getAllPayments`
- Ensure route is protected with `protect` middleware
- Add RBAC check (admin or sales role required)

### 3. Update Payment Service Interface

**File**: `frontend/src/api/payments.ts`

- Add `getAll()` method to fetch all payments with optional filters
- Add `create()` method for creating new payment records
- Update `Payment` interface to include new fields: `transaction_id`, `cheque_no`, `payment_date`
- Add `CreatePaymentData` interface matching the backend requirements

## Frontend Changes

### 4. Create Payments Page Component

**File**: `frontend/src/pages/sales/Payments.tsx`

- Create new component following the pattern of `SupplierPayments.tsx`
- Display payments in a table with columns:
- Payment ID / Date
- Order Number (with link to order)
- Customer Name
- Amount
- Payment Method
- Status (with badge)
- Transaction ID / Cheque No (if applicable)
- Payment Date (if applicable)
- Created At
- Add search functionality (by order number, customer name, transaction ID)
- Add filters:
- Status filter (all, completed, pending, failed, refunded)
- Payment Method filter (all, cash, card, bank_transfer, neft, rtgs, upi, cheque)
- Date range filter (date_from, date_to)
- Add summary cards:
- Total Payments (amount and count)
- Completed Payments
- Pending Payments
- Failed/Refunded Payments
- Add "Add Payment" button (visible to users with `sales.write` permission)
- Use React Query for data fetching with proper cache keys
- Implement pagination if needed

### 5. Create Payment Form Component

**File**: `frontend/src/pages/sales/CreatePayment.tsx`

- Create form component for adding new payments
- Fields:
- Order selection (searchable dropdown, filtered by user's customers for sales execs)
- Amount (with validation against order total)
- Payment Method (select: cash, card, bank_transfer, neft, rtgs, upi, cheque)
- Status (select: pending, completed, failed)
- Conditional fields based on payment_method:
    - For cheque: `cheque_no`, `payment_date`
    - For bank_transfer, neft, rtgs, upi: `transaction_id`, `payment_date`
    - For cash/card: no additional fields
- Form validation using `react-hook-form` and `zod`
- Submit handler that calls `paymentsService.create()`
- Success: show toast, navigate back to payments list, invalidate queries
- Error handling with user-friendly messages

### 6. Update App Routing

**File**: `frontend/src/App.tsx`

- Replace `<PlaceholderPage />` for `/sales/payments` route with `<Payments />`
- Add route for `/sales/payments/new` pointing to `<CreatePayment />`
- Ensure routes are within the Sales module protected route

### 7. Update Sidebar Configuration (if needed)

**File**: `frontend/src/config/modules.config.tsx`

- Verify the Payments route is already configured (it is at line 120)
- Ensure permission check is correct (`sales.read` for viewing, `sales.write` for creating)

## Data Flow

```javascript
User visits /sales/payments
  ↓
Frontend calls paymentsService.getAll()
  ↓
Backend getAllPayments() controller
  ↓
- Checks user role (admin/sales)
- For sales: filters orders by their customers
- Queries payments table with company_id filter
- Enriches with order and customer data
  ↓
Returns payment list with filters applied
  ↓
Frontend displays in table with search/filters
```



## Key Implementation Details

1. **Multi-tenancy**: All queries must filter by `company_id`
2. **RBAC**: Sales executives see only payments for their customers' orders; admins see all
3. **Payment Creation**: 

- Validate amount doesn't exceed order total (for partial payments, allow multiple)
- Use `PaymentService.processPayment()` on backend
- Include all new fields (transaction_id, cheque_no, payment_date)

4. **UI Consistency**: Follow the same design patterns as `SupplierPayments.tsx` and `Orders.tsx`
5. **Error Handling**: Proper error messages and loading states
6. **Query Invalidation**: Invalidate payment queries after creating new payment

## Files to Create/Modify

**Backend:**

- `backend/src/controllers/payments.ts` - Add `getAllPayments` function
- `backend/src/routes/payments.ts` - Add GET route

**Frontend:**

- `frontend/src/pages/sales/Payments.tsx` - New payments list page
- `frontend/src/pages/sales/CreatePayment.tsx` - New payment creation form
- `frontend/src/api/payments.ts` - Add `getAll()` and `create()` methods
- `frontend/src/App.tsx` - Update routes

## Testing Considerations

- Test payment list displays correctly for admin and sales users
- Test filtering by status, payment method, date range