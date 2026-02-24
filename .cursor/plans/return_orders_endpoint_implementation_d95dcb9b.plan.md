---
name: Return Orders Endpoint Implementation
overview: Implement a comprehensive return orders endpoint that supports partial and full returns, increases stock on completion, allows all authenticated users (with proper permission checks), and maintains original order status unchanged.
todos: []
---

#Return Orders Endpoint Implementation

## Overview

Create a `POST /api/orders/returns` endpoint that allows users to create return orders against existing sales orders. Returns support both partial and full item returns, increase stock when completed, and maintain proper audit trails.

## Requirements Summary

- **Return Scope**: Support both partial and full returns
- **Stock Timing**: Increase stock when return status changes to 'completed'
- **Permissions**: All authenticated users (customers can only return their own orders, admins/sales can return any)
- **Original Order**: Status remains unchanged when return is created

## Phase 1: Update OrderService.createOrder

### 1.1 Fix original_order_id Logic

**File**: `backend/src/services/core/OrderService.ts`**Change**: Only set `original_order_id` when `orderType === 'return'`

```typescript
// Line ~200
original_order_id: orderType === 'return' ? originalOrderId : null,
```

**Reason**: Currently sets `original_order_id` for all order types. Should only be set for returns.

## Phase 2: Create Return Order Controller

### 2.1 Add createReturnOrder Function

**File**: `backend/src/controllers/orders.ts`**New Function**: `createReturnOrder`**Logic**:

1. **Validate Request**:

- `original_order_id` (required)
- `items` array (required, at least one item)
- `reason` (optional, for notes)

2. **Validate Original Order**:

- Fetch original order with `order_items`
- Verify order exists and belongs to company
- Verify order is a sales order (`order_type = 'sales'`)
- Verify order is not already cancelled
- **Permission Check**:
    - If user is admin/sales → can return any order
    - If user is customer → verify `original_order.user_id === req.user.id`

3. **Validate Return Items**:

- Each item must have `product_id`, `variant_id` (or use default), `quantity`
- Verify each item exists in original order
- Verify return quantity ≤ original quantity
- Track total quantities returned per item (for partial returns)

4. **Calculate Return Amount**:

- Sum of `(item.quantity * item.unit_price)` for returned items
- Optionally apply restocking fees or deductions

5. **Create Return Order**:

- Use `OrderService.createOrder()` with:
    - `orderType: 'return'`
    - `orderSource`: Inherit from `original_order.order_source`
    - `fulfillmentType`: Inherit from `original_order.fulfillment_type`
    - `originalOrderId`: Set to `original_order_id`
    - `userId`: Same as original order (or current user if admin/sales)
    - `outletId`: Same as original order
    - `totalAmount`: Negative amount (or positive with sign in notes)
    - `paymentStatus`: 'pending' (will be handled separately)
    - `notes`: Include return reason and reference to original order

6. **Create Return Order Items**:

- Map returned items to `order_items` table
- Use same `product_id`, `variant_id`, `warehouse_id` as original
- Set `quantity` to returned quantity
- Set `unit_price` to original price (for reference)

7. **Response**:

- Return created return order with full details
- Include link to original order

## Phase 3: Update OrderService.updateOrderStatus for Returns

### 3.1 Handle Return Stock Movements

**File**: `backend/src/services/core/OrderService.ts` → `updateOrderStatus()`**Change**: Add logic to handle return orders when status changes to 'completed'**Current Logic** (lines 339-386):

- Only handles `order_type === 'sales'`

**New Logic**:

```typescript
// Handle inventory updates for retail sales orders AND return orders
if (
  currentOrder.industry_context === 'retail' &&
  (currentOrder.order_type === 'sales' || currentOrder.order_type === 'return') &&
  status !== 'pending' &&
  status !== 'cancelled' &&
  !currentOrder.inventory_updated
) {
  // For return orders, stock increases (positive quantity)
  // For sales orders, stock decreases (negative quantity)
  await this.inventoryService.handleOrderStockMovement(
    orderId, 
    currentOrder.order_type, // 'sales' or 'return'
    items
  );
  
  // ... rest of logic
}
```

**Note**: `InventoryService.handleOrderStockMovement()` already handles 'return' type correctly:

- Sets `movementType='RETURN'`
- Sets `sourceType='return'`
- Sets `quantity=+item.quantity` (positive, increases stock)

## Phase 4: Add Return Route

### 4.1 Register Return Endpoint

**File**: `backend/src/routes/orders.ts`**Add Route**:

```typescript
import { createReturnOrder } from '../controllers';

// Add before /:id route to avoid route conflicts
router.post('/returns', protect, createReturnOrder);
```

**Note**: Place before `router.get('/:id', ...)` to avoid `/returns` being matched as `/:id`.

## Phase 5: Frontend API Integration

### 5.1 Add Return Order Service

**File**: `frontend/src/api/orders.ts`**Add Interface**:

```typescript
export interface CreateReturnOrderData {
  original_order_id: string;
  items: {
    product_id: string;
    variant_id?: string;
    quantity: number;
  }[];
  reason?: string;
}
```

**Add Method**:

```typescript
async createReturn(orderData: CreateReturnOrderData): Promise<Order> {
  const { data } = await apiClient.post<{ success: boolean, data: Order }>(
    '/orders/returns', 
    orderData
  );
  return data.data;
}
```



## Phase 6: Validation & Error Handling

### 6.1 Validation Rules

**In `createReturnOrder` controller**:

1. **Original Order Validation**:

- Must exist
- Must belong to company
- Must be `order_type = 'sales'`
- Must not be `status = 'cancelled'`
- User must have permission (own order OR admin/sales)

2. **Return Items Validation**:

- At least one item required
- Each item must exist in original order
- Return quantity ≤ original quantity
- No duplicate items (same product_id + variant_id)

3. **Business Rules**:

- Can return items from delivered/processing orders
- Cannot return items from pending orders (use cancel instead)
- Track cumulative returns per original order item

### 6.2 Error Messages

- `400`: Invalid request (missing fields, invalid quantities)
- `403`: Permission denied (customer trying to return another's order)
- `404`: Original order not found
- `409`: Return quantity exceeds original quantity
- `500`: Server error

## Phase 7: Testing Checklist

### 7.1 Return Creation Tests

- [ ] Admin can create return for any order
- [ ] Sales executive can create return for their customers' orders
- [ ] Customer can create return for their own orders
- [ ] Customer cannot create return for another's order
- [ ] Return order inherits `order_source` and `fulfillment_type` from original
- [ ] Return order has `order_type='return'` and `original_order_id` set
- [ ] Partial returns work (only some items)
- [ ] Full returns work (all items)
- [ ] Return quantity validation (cannot exceed original)
- [ ] Original order status remains unchanged

### 7.2 Stock Movement Tests

- [ ] Return order created with status 'pending' → no stock movement
- [ ] Return order status changed to 'completed' → stock increases (IN movement)
- [ ] Stock movement has `movement_type='RETURN'` and `source_type='return'`
- [ ] Stock movement links to return order via `reference_id`
- [ ] Multiple partial returns for same original order work correctly

### 7.3 Edge Cases

- [ ] Cannot return from cancelled order
- [ ] Cannot return more quantity than original
- [ ] Cannot return items not in original order
- [ ] Return order shows correct negative/positive amount
- [ ] Return order items reference correct variants

## Files to Modify

### Backend

- `backend/src/services/core/OrderService.ts` (fix `original_order_id` logic, update `updateOrderStatus` for returns)
- `backend/src/controllers/orders.ts` (add `createReturnOrder` function)
- `backend/src/routes/orders.ts` (add `/returns` route)

### Frontend

- `frontend/src/api/orders.ts` (add return order interface and method)

## Implementation Order

1. **Fix OrderService.createOrder** (Phase 1) - Critical bug fix
2. **Update OrderService.updateOrderStatus** (Phase 3) - Enable stock movements for returns
3. **Create Return Controller** (Phase 2) - Core functionality
4. **Add Route** (Phase 4) - Expose endpoint