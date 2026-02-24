---
name: Explicit Order Model & Stock Movement Architecture
overview: Redesign order system with explicit order_type (sales/purchase/return), order_source (ecommerce/pos/sales), and fulfillment_type (delivery/pickup/cash_counter). Update stock movements to support PURCHASE flows and ensure GRN completion creates proper stock movements. Purchase invoices create final order entries.
todos: []
---

# Explicit Order Model & Stock Movement Architecture

## Overview

Transform the order system from implicit inference to explicit, auditable fields. Add `order_source`, `fulfillment_type`, expand `order_type` to include 'purchase', and ensure stock movements correctly handle all order types including purchases from GRN completion.

## Architecture Decisions

- **Purchase Orders**: Remain in `procurement.purchase_orders` schema (not final orders)
- **Final Purchase Orders**: Created in `orders` table when purchase invoice is generated (`order_type='purchase'`)
- **Stock Movements**: Created when GRN status = 'completed' (not on PO creation)
- **Returns**: Link to original order via `original_order_id` field

## Phase 1: Database Schema Changes

### 1.1 Orders Table Migration

**File**: `backend/src/db/migrations/20260202_add_explicit_order_fields.sql`Add three new columns:

- `order_source` VARCHAR(20): 'ecommerce', 'pos', 'sales', 'internal'
- `fulfillment_type` VARCHAR(20): 'delivery', 'pickup', 'cash_counter'
- `original_order_id` UUID: For returns, references the original order

**Changes**:

```sql
-- Add new columns
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS order_source VARCHAR(20),
ADD COLUMN IF NOT EXISTS fulfillment_type VARCHAR(20),
ADD COLUMN IF NOT EXISTS original_order_id UUID REFERENCES public.orders(id);

-- Update order_type constraint: SALE -> sales, add purchase
ALTER TABLE public.orders 
DROP CONSTRAINT IF EXISTS valid_order_type;

ALTER TABLE public.orders 
ADD CONSTRAINT valid_order_type 
CHECK (order_type IN ('sales', 'purchase', 'return'));

-- Add constraints for new fields
ALTER TABLE public.orders 
ADD CONSTRAINT valid_order_source 
CHECK (order_source IN ('ecommerce', 'pos', 'sales', 'internal'));

ALTER TABLE public.orders 
ADD CONSTRAINT valid_fulfillment_type 
CHECK (fulfillment_type IN ('delivery', 'pickup', 'cash_counter'));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_orders_order_source ON public.orders(order_source);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_type ON public.orders(fulfillment_type);
CREATE INDEX IF NOT EXISTS idx_orders_original_order_id ON public.orders(original_order_id);
```



### 1.2 Backfill Existing Orders

**File**: `backend/src/db/migrations/20260202_backfill_order_fields.sql`Infer values from existing data:

- `order_type`: Map 'SALE' -> 'sales', 'RETURN' -> 'return'
- `order_source`: 
- `user_id IS NULL` → 'pos'
- `user_id IS NOT NULL` + customer has `sales_executive_id` → 'sales'
- `user_id IS NOT NULL` + no `sales_executive_id` → 'ecommerce'
- `fulfillment_type`:
- `shipping_address_id IS NULL` → 'cash_counter' (if pos) or 'pickup'
- `shipping_address_id IS NOT NULL` → 'delivery'

### 1.3 Stock Movements Updates

**File**: `backend/src/db/migrations/20260202_update_stock_movements_for_purchase.sql`Add `source_type` field to distinguish order source:

```sql
ALTER TABLE public.stock_movements
ADD COLUMN IF NOT EXISTS source_type VARCHAR(20);

ALTER TABLE public.stock_movements
ADD CONSTRAINT valid_source_type
CHECK (source_type IN ('sales', 'purchase', 'return', 'transfer', 'adjustment', 'receipt'));

-- Update movement_type constraint to include PURCHASE
ALTER TABLE public.stock_movements
DROP CONSTRAINT IF EXISTS valid_movement_type;

ALTER TABLE public.stock_movements
ADD CONSTRAINT valid_movement_type
CHECK (movement_type IN ('SALE', 'RETURN', 'PURCHASE', 'ADJUSTMENT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER', 'RECEIPT'));

CREATE INDEX IF NOT EXISTS idx_stock_movements_source_type ON public.stock_movements(source_type);
```

**Note**: `movement_type` = direction (IN/OUT), `source_type` = business context (sales/purchase/return)

## Phase 2: Backend Type Definitions

### 2.1 Update Database Types

**File**: `backend/src/types/database.ts`Update `Order` interface:

```typescript
export interface Order {
  id: string;
  user_id: string | null;
  order_type: 'sales' | 'purchase' | 'return';
  order_source: 'ecommerce' | 'pos' | 'sales' | 'internal';
  fulfillment_type: 'delivery' | 'pickup' | 'cash_counter';
  original_order_id?: string | null; // For returns
  // ... existing fields
}
```



### 2.2 Update OrderService Context

**File**: `backend/src/services/core/OrderService.ts`Update `CreateOrderContext`:

```typescript
export interface CreateOrderContext {
  userId?: string | null;
  outletId?: string | null;
  industryContext?: 'retail' | 'restaurant' | 'service';
  orderType?: 'sales' | 'purchase' | 'return';
  orderSource?: 'ecommerce' | 'pos' | 'sales' | 'internal';
  fulfillmentType?: 'delivery' | 'pickup' | 'cash_counter';
  originalOrderId?: string | null; // For returns
}
```



## Phase 3: Order Creation Updates

### 3.1 E-commerce Orders

**File**: `backend/src/controllers/orders.ts` → `createOrder()`**Changes**:

- Set `order_type: 'sales'`
- Set `order_source: 'ecommerce'`
- Set `fulfillment_type: 'delivery'` (if shipping_address_id) or `'pickup'` (if no shipping)
- Pass context to `OrderService.createOrder()`

### 3.2 POS Orders

**File**: `backend/src/controllers/pos.ts` → `createPOSOrder()`**Changes**:

- Set `order_type: 'sales'`
- Set `order_source: 'pos'`
- Set `fulfillment_type: 'cash_counter'`
- `user_id: null` (already correct)

### 3.3 Sales Executive Orders

**File**: `backend/src/controllers/orderController.ts` → `createOrder()`**Changes**:

- Set `order_type: 'sales'`
- Set `order_source: 'sales'`
- Set `fulfillment_type: 'delivery'` or `'pickup'` based on shipping_address_id
- Validate `sales_executive_id` ownership (already exists)

### 3.4 Purchase Orders (Invoice Generation)

**File**: `backend/src/controllers/purchaseInvoices.ts`**New Function**: `createPurchaseOrderFromInvoice()`When purchase invoice is created/approved:

- Create entry in `orders` table:
- `order_type: 'purchase'`
- `order_source: 'internal'`
- `fulfillment_type: 'delivery'` (from PO)
- Link to purchase_invoice_id (may need new field or use notes)
- Link to purchase_order_id (may need new field)

**Note**: This is the "final order" entry point for purchases.

### 3.5 Return Orders

**New Endpoint**: `POST /api/orders/returns`**File**: `backend/src/controllers/orders.ts` → `createReturnOrder()`**Logic**:

- Validate original order exists and belongs to company
- Create new order:
- `order_type: 'return'`
- `order_source`: Inherit from original order
- `fulfillment_type`: Inherit from original order
- `original_order_id`: Link to original order
- Create stock movements (IN) when return is confirmed
- Update original order status if needed

## Phase 4: Stock Movement Integration

### 4.1 Update InventoryService

**File**: `backend/src/services/core/InventoryService.ts`**Update `handleOrderStockMovement()`**:

- Accept `sourceType` parameter
- Set `source_type` in stock movement record
- Handle 'purchase' source type (positive quantity)

**New Method**: `handlePurchaseStockMovement()`

- Called from GRN completion
- Creates PURCHASE movements with `source_type='purchase'`
- Links to GRN via `reference_type='goods_receipt'`

### 4.2 GRN Completion Integration

**File**: `backend/src/controllers/goodsReceipts.ts` → `completeGoodsReceipt()`**Changes**:

- After updating warehouse inventory, create stock movements:
- Call `InventoryService.handlePurchaseStockMovement()`
- For each accepted item, create movement:
    - `movement_type: 'PURCHASE'`
    - `source_type: 'purchase'`
    - `quantity`: positive (increases stock)
    - `reference_type: 'goods_receipt'`
    - `reference_id`: GRN ID

**Current Issue**: GRN completion uses `updateWarehouseStock()` directly. Need to also create stock movements for audit trail.

### 4.3 Return Stock Movements

**File**: `backend/src/services/core/OrderService.ts` → `updateOrderStatus()`**When return order status changes to 'completed'**:

- Create stock movements:
- `movement_type: 'RETURN'`
- `source_type: 'return'`
- `quantity`: positive (increases stock)
- Link to return order ID

## Phase 5: Order Fetching & Filtering

### 5.1 Update Order Queries

**File**: `backend/src/controllers/orders.ts` → `getOrders()`**Add Filters**:

- `order_type`: Filter by 'sales', 'purchase', 'return'
- `order_source`: Filter by 'ecommerce', 'pos', 'sales', 'internal'
- `fulfillment_type`: Filter by 'delivery', 'pickup', 'cash_counter'

**Update Query Builder**:

```typescript
if (order_type) query = query.eq('order_type', order_type);
if (order_source) query = query.eq('order_source', order_source);
if (fulfillment_type) query = query.eq('fulfillment_type', fulfillment_type);
```



### 5.2 Update Sales Analytics

**File**: `backend/src/controllers/orders.ts` → `getSalesAnalytics()`**Changes**:

- Filter by `order_type='sales'` explicitly
- Group by `order_source` and `fulfillment_type`
- Remove NULL-based inference logic

### 5.3 Update KPI Controller

**File**: `backend/src/controllers/kpiController.ts`**Update Module KPIs**:

- Sales module: Filter `order_type='sales'`
- Procurement module: Filter `order_type='purchase'`
- Use explicit fields instead of inference

## Phase 6: Data Migration & Backfill

### 6.1 Backfill Orders

**File**: `backend/src/db/migrations/20260202_backfill_order_fields.sql`**Logic**:

1. Update `order_type`: 'SALE' → 'sales', 'RETURN' → 'return'
2. Backfill `order_source`:
   ```sql
                     UPDATE orders o
                     SET order_source = CASE
                       WHEN o.user_id IS NULL THEN 'pos'
                       WHEN EXISTS (
                         SELECT 1 FROM customers c 
                         WHERE c.user_id = o.user_id 
                         AND c.sales_executive_id IS NOT NULL
                       ) THEN 'sales'
                       ELSE 'ecommerce'
                     END
                     WHERE order_source IS NULL;
   ```




3. Backfill `fulfillment_type`:
   ```sql
                     UPDATE orders
                     SET fulfillment_type = CASE
                       WHEN shipping_address_id IS NULL AND order_source = 'pos' THEN 'cash_counter'
                       WHEN shipping_address_id IS NULL THEN 'pickup'
                       ELSE 'delivery'
                     END
                     WHERE fulfillment_type IS NULL;
   ```




### 6.2 Backfill Stock Movements

**File**: `backend/src/db/migrations/20260202_backfill_stock_movements_source_type.sql`**Logic**:

- Set `source_type` based on `reference_type` and `movement_type`:
- `reference_type='order'` + `movement_type='SALE'` → `source_type='sales'`
- `reference_type='order'` + `movement_type='RETURN'` → `source_type='return'`
- `reference_type='goods_receipt'` → `source_type='purchase'`
- `reference_type='transfer'` → `source_type='transfer'`
- `reference_type='adjustment'` → `source_type='adjustment'`

## Phase 7: API Updates

### 7.1 Update Order Creation DTOs

**File**: `frontend/src/api/orders.ts`**Add Fields**:

```typescript
export interface CreateOrderData {
  // ... existing fields
  fulfillment_type?: 'delivery' | 'pickup';
  order_source?: 'ecommerce' | 'pos' | 'sales';
}
```



### 7.2 Update Order Response Types

**File**: `frontend/src/api/orders.ts`**Update Order Interface**:

```typescript
export interface Order {
  // ... existing fields
  order_type: 'sales' | 'purchase' | 'return';
  order_source: 'ecommerce' | 'pos' | 'sales' | 'internal';
  fulfillment_type: 'delivery' | 'pickup' | 'cash_counter';
  original_order_id?: string;
}
```



## Phase 8: RLS Policy Updates

### 8.1 Orders RLS

**File**: `backend/src/db/migrations/20260202_update_orders_rls.sql`**Ensure RLS policies work with new fields**:

- Company-scoped access (already exists)
- Role-based access (admin, sales) - no changes needed
- Verify `original_order_id` doesn't break policies

### 8.2 Stock Movements RLS

**File**: `backend/src/db/migrations/20260201_add_stock_movements_rls.sql` (already exists)**Verify**: Policies work with new `source_type` field (should be fine, company-scoped)

## Phase 9: Testing Checklist

### 9.1 Order Creation Tests

- [ ] E-commerce order creates with correct `order_source='ecommerce'`, `fulfillment_type='delivery'`
- [ ] POS order creates with `order_source='pos'`, `fulfillment_type='cash_counter'`
- [ ] Sales order creates with `order_source='sales'`, validates sales_executive ownership
- [ ] Purchase invoice creates order with `order_type='purchase'`, `order_source='internal'`
- [ ] Return order links to original order via `original_order_id`

### 9.2 Stock Movement Tests

- [ ] Sales order creates SALE stock movement with `source_type='sales'`
- [ ] GRN completion creates PURCHASE stock movement with `source_type='purchase'`
- [ ] Return order creates RETURN stock movement with `source_type='return'`
- [ ] Stock movements are company-scoped (RLS)
- [ ] Stock movements link correctly via `reference_id`

### 9.3 Filtering & Reporting Tests

- [ ] Filter orders by `order_type` works correctly
- [ ] Filter orders by `order_source` works correctly
- [ ] Filter orders by `fulfillment_type` works correctly
- [ ] Sales analytics only includes `order_type='sales'`
- [ ] KPI endpoints use explicit fields

### 9.4 Data Integrity Tests

- [ ] Backfill migration runs without errors
- [ ] Existing orders have valid `order_source` and `fulfillment_type`
- [ ] Stock movements have valid `source_type`
- [ ] No NULL values in required fields after migration
- [ ] Foreign key constraints work (original_order_id)

## Phase 10: Edge Cases & Risks

### 10.1 Edge Cases

1. **Old Orders Without Shipping Address**: Default to 'pickup' for ecommerce/sales, 'cash_counter' for pos
2. **Returns Without Original Order**: Should not be allowed (validation)
3. **GRN Without Purchase Order**: Already handled (GRN requires PO)
4. **Purchase Invoice Without GRN**: Stock already received, order created for accounting
5. **Multiple Returns for Same Order**: Each return is separate order with same `original_order_id`

### 10.2 Risks

1. **Data Migration**: Large datasets may take time - run during maintenance window
2. **API Breaking Changes**: Frontend must be updated simultaneously
3. **Stock Movement Audit**: Ensure all GRN completions create movements (currently missing)
4. **RLS Compatibility**: Verify company isolation still works with new fields
5. **Performance**: New indexes should help, but monitor query performance

### 10.3 Rollback Plan

1. Keep old `order_type` values ('SALE', 'RETURN') in migration for compatibility
2. Make new fields nullable initially, backfill gradually
3. Add feature flag to toggle between old/new logic
4. Database backup before migration

## Implementation Order

1. **Database Migrations** (Phase 1) - Foundation
2. **Type Definitions** (Phase 2) - Type safety
3. **Order Creation Updates** (Phase 3) - Core logic
4. **Stock Movement Integration** (Phase 4) - Critical for inventory
5. **Order Fetching Updates** (Phase 5) - Reporting
6. **Data Backfill** (Phase 6) - Historical data
7. **API Updates** (Phase 7) - Frontend compatibility
8. **RLS Updates** (Phase 8) - Security
9. **Testing** (Phase 9) - Validation
10. **Edge Case Handling** (Phase 10) - Robustness

## Files to Modify

### Backend

- `backend/src/db/migrations/20260202_add_explicit_order_fields.sql` (NEW)
- `backend/src/db/migrations/20260202_backfill_order_fields.sql` (NEW)
- `backend/src/db/migrations/20260202_update_stock_movements_for_purchase.sql` (NEW)
- `backend/src/types/database.ts`
- `backend/src/services/core/OrderService.ts`
- `backend/src/services/core/InventoryService.ts`
- `backend/src/controllers/orders.ts`
- `backend/src/controllers/pos.ts`
- `backend/src/controllers/orderController.ts`
- `backend/src/controllers/purchaseInvoices.ts`
- `backend/src/controllers/goodsReceipts.ts`
- `backend/src/controllers/kpiController.ts`

### Frontend

- `frontend/src/api/orders.ts`

## Success Criteria

- All orders have explicit `order_source` and `fulfillment_type`