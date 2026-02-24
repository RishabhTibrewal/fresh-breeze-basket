---
name: ERP System Validation & Stabilization Plan
overview: ""
todos: []
---

# ERP System Validation & Stabilization Plan

## Overview

This plan provides a systematic review and hardening approach for the ERP system after two major refactors:

1. **Explicit Order Model & Stock Movement Architecture** - Added `order_type`, `order_source`, `fulfillment_type`, `original_order_id`, and `source_type` fields
2. **Return Orders Endpoint** - Implemented `POST /api/orders/returns` with partial/full return support

## 1. Data Consistency Validation

### 1.1 Order Table Integrity Checks

**SQL Validation Queries:**

```sql
-- Check 1: Ensure order_type, order_source, fulfillment_type are never NULL
SELECT 
  COUNT(*) as null_order_type_count,
  COUNT(*) FILTER (WHERE order_source IS NULL) as null_order_source_count,
  COUNT(*) FILTER (WHERE fulfillment_type IS NULL) as null_fulfillment_type_count
FROM public.orders
WHERE company_id = '<company_id>';

-- Expected: All counts should be 0

-- Check 2: Verify original_order_id is set ONLY for return orders
SELECT 
  COUNT(*) as invalid_original_order_id_count
FROM public.orders
WHERE original_order_id IS NOT NULL 
  AND order_type != 'return';

-- Expected: 0 (no non-return orders should have original_order_id)

-- Check 3: Verify all return orders have original_order_id
SELECT 
  COUNT(*) as return_without_original_count
FROM public.orders
WHERE order_type = 'return' 
  AND original_order_id IS NULL;

-- Expected: 0 (all returns must reference original)

-- Check 4: Verify original_order_id references valid sales orders
SELECT 
  r.id as return_order_id,
  r.original_order_id,
  o.order_type as original_order_type
FROM public.orders r
LEFT JOIN public.orders o ON r.original_order_id = o.id
WHERE r.order_type = 'return'
  AND (o.id IS NULL OR o.order_type != 'sales');

-- Expected: Empty result set

-- Check 5: Verify purchase orders have correct fields
SELECT 
  id,
  order_type,
  order_source,
  fulfillment_type,
  inventory_updated
FROM public.orders
WHERE order_type = 'purchase'
  AND (order_source != 'internal' 
    OR fulfillment_type != 'delivery'
    OR inventory_updated != true);

-- Expected: Empty result set (purchase orders should be internal, delivery, inventory_updated=true)

-- Check 6: Verify enum constraint violations
SELECT 
  id,
  order_type,
  order_source,
  fulfillment_type
FROM public.orders
WHERE order_type NOT IN ('sales', 'purchase', 'return')
   OR (order_source IS NOT NULL AND order_source NOT IN ('ecommerce', 'pos', 'sales', 'internal'))
   OR (fulfillment_type IS NOT NULL AND fulfillment_type NOT IN ('delivery', 'pickup', 'cash_counter'));

-- Expected: Empty result set
```

**Code Audit Checkpoints:**

- [ ] `OrderService.createOrder()` - Verify defaults are set when context fields are missing
- [ ] `createReturnOrder()` controller - Verify `original_order_id` is always set for returns
- [ ] `createPurchaseOrderFromInvoiceOrderRow()` - Verify purchase orders have `order_type='purchase'`, `order_source='internal'`, `inventory_updated=true`
- [ ] All order creation entry points (e-commerce, POS, sales, purchase) explicitly set required fields

### 1.2 Stock Movements Integrity Checks

**SQL Validation Queries:**

```sql
-- Check 1: Ensure all stock movements have required fields
SELECT 
  COUNT(*) FILTER (WHERE movement_type IS NULL) as null_movement_type,
  COUNT(*) FILTER (WHERE source_type IS NULL) as null_source_type,
  COUNT(*) FILTER (WHERE company_id IS NULL) as null_company_id,
  COUNT(*) FILTER (WHERE outlet_id IS NULL) as null_outlet_id,
  COUNT(*) FILTER (WHERE variant_id IS NULL) as null_variant_id
FROM public.stock_movements
WHERE company_id = '<company_id>';

-- Expected: All counts should be 0

-- Check 2: Verify source_type matches movement_type logic
SELECT 
  movement_type,
  source_type,
  COUNT(*) as count
FROM public.stock_movements
WHERE company_id = '<company_id>'
GROUP BY movement_type, source_type
ORDER BY movement_type, source_type;

-- Expected combinations:
-- SALE -> source_type='sales'
-- RETURN -> source_type='return'
-- PURCHASE -> source_type='purchase'
-- TRANSFER -> source_type='transfer'
-- ADJUSTMENT_IN/OUT -> source_type='adjustment'

-- Check 3: Verify reference_id links to valid orders for order-based movements
SELECT 
  sm.id,
  sm.movement_type,
  sm.source_type,
  sm.reference_id,
  o.id as order_exists,
  o.order_type
FROM public.stock_movements sm
LEFT JOIN public.orders o ON sm.reference_id = o.id
WHERE sm.reference_type = 'order'
  AND (o.id IS NULL OR o.company_id != sm.company_id);

-- Expected: Empty result set (all order references should be valid)

-- Check 4: Verify PURCHASE movements link to GRNs
SELECT 
  sm.id,
  sm.movement_type,
  sm.source_type,
  sm.reference_id,
  sm.reference_type
FROM public.stock_movements sm
WHERE sm.movement_type = 'PURCHASE'
  AND (sm.reference_type != 'goods_receipt' OR sm.reference_id IS NULL);

-- Expected: Empty result set (all PURCHASE movements should reference GRNs)
```

**Code Audit Checkpoints:**

- [ ] `InventoryService.recordStockMovement()` - Verify `sourceType` is always provided
- [ ] `InventoryService.handleOrderStockMovement()` - Verify correct `sourceType` mapping ('sales' or 'return')
- [ ] `InventoryService.handlePurchaseStockMovement()` - Verify `sourceType='purchase'` and `movementType='PURCHASE'`
- [ ] `OrderService.updateOrderStatus()` - Verify stock movements are created with correct `sourceType`

### 1.3 Return Order Validation

**SQL Validation Queries:**

```sql
-- Check 1: Verify cumulative return quantities don't exceed original
WITH return_totals AS (
  SELECT 
    oi.product_id,
    oi.variant_id,
    SUM(oi.quantity) as total_returned
  FROM public.orders r
  JOIN public.order_items oi ON r.id = oi.order_id
  WHERE r.order_type = 'return'
    AND r.original_order_id = '<original_order_id>'
    AND r.status != 'cancelled'
  GROUP BY oi.product_id, oi.variant_id
),
original_totals AS (
  SELECT 
    oi.product_id,
    oi.variant_id,
    SUM(oi.quantity) as total_original
  FROM public.orders o
  JOIN public.order_items oi ON o.id = oi.order_id
  WHERE o.id = '<original_order_id>'
  GROUP BY oi.product_id, oi.variant_id
)
SELECT 
  rt.product_id,
  rt.variant_id,
  rt.total_returned,
  ot.total_original,
  (rt.total_returned > ot.total_original) as exceeds_original
FROM return_totals rt
JOIN original_totals ot ON rt.product_id = ot.product_id 
  AND COALESCE(rt.variant_id, 'default') = COALESCE(ot.variant_id, 'default')
WHERE rt.total_returned > ot.total_original;

-- Expected: Empty result set (no returns should exceed original quantities)

-- Check 2: Verify return orders inherit correct fields from original
SELECT 
  r.id as return_id,
  r.order_source as return_source,
  o.order_source as original_source,
  r.fulfillment_type as return_fulfillment,
  o.fulfillment_type as original_fulfillment,
  r.user_id as return_user,
  o.user_id as original_user
FROM public.orders r
JOIN public.orders o ON r.original_order_id = o.id
WHERE r.order_type = 'return'
  AND (r.order_source != o.order_source 
    OR r.fulfillment_type != o.fulfillment_type
    OR r.user_id != o.user_id);

-- Expected: Empty result set (returns should inherit source, fulfillment, user)
```

**Code Audit Checkpoints:**

- [ ] `createReturnOrder()` - Verify cumulative return quantity validation logic
- [ ] `createReturnOrder()` - Verify return order inherits `order_source`, `fulfillment_type`, `user_id` from original
- [ ] `createReturnOrder()` - Verify permission checks (admin/sales can return any, customers only their own)

## 2. Stock Safety Validation

### 2.1 Double Inventory Update Prevention

**SQL Validation Queries:**

```sql
-- Check 1: Verify inventory_updated flag prevents double updates
SELECT 
  o.id,
  o.order_type,
  o.status,
  o.inventory_updated,
  COUNT(sm.id) as stock_movement_count
FROM public.orders o
LEFT JOIN public.stock_movements sm ON sm.reference_id = o.id 
  AND sm.reference_type = 'order'
WHERE o.industry_context = 'retail'
  AND o.order_type IN ('sales', 'return')
  AND o.status IN ('completed', 'processing', 'delivered')
  AND o.inventory_updated = true
GROUP BY o.id, o.order_type, o.status, o.inventory_updated
HAVING COUNT(sm.id) > 1;

-- Expected: Empty result set (each order should have exactly 1 stock movement per item, not multiple)

-- Check 2: Verify orders with inventory_updated=false don't have stock movements
SELECT 
  o.id,
  o.order_type,
  o.status,
  o.inventory_updated,
  COUNT(sm.id) as stock_movement_count
FROM public.orders o
LEFT JOIN public.stock_movements sm ON sm.reference_id = o.id 
  AND sm.reference_type = 'order'
WHERE o.industry_context = 'retail'
  AND o.order_type IN ('sales', 'return')
  AND o.status IN ('completed', 'processing', 'delivered')
  AND o.inventory_updated = false
GROUP BY o.id, o.order_type, o.status, o.inventory_updated
HAVING COUNT(sm.id) > 0;

-- Expected: Empty result set (orders not marked as updated shouldn't have movements)

-- Check 3: Verify sales orders reduce stock (negative quantity)
SELECT 
  sm.id,
  sm.movement_type,
  sm.source_type,
  sm.quantity,
  o.order_type
FROM public.stock_movements sm
JOIN public.orders o ON sm.reference_id = o.id
WHERE sm.reference_type = 'order'
  AND o.order_type = 'sales'
  AND sm.quantity > 0;

-- Expected: Empty result set (sales should have negative quantities)

-- Check 4: Verify return orders increase stock (positive quantity)
SELECT 
  sm.id,
  sm.movement_type,
  sm.source_type,
  sm.quantity,
  o.order_type
FROM public.stock_movements sm
JOIN public.orders o ON sm.reference_id = o.id
WHERE sm.reference_type = 'order'
  AND o.order_type = 'return'
  AND sm.quantity < 0;

-- Expected: Empty result set (returns should have positive quantities)
```

**Code Audit Checkpoints:**

- [ ] `OrderService.updateOrderStatus()` - Verify `inventory_updated` flag check before creating stock movements
- [ ] `OrderService.updateOrderStatus()` - Verify `inventory_updated` is set to `true` after stock movement creation
- [ ] `OrderService.updateOrderStatus()` - Verify stock movement creation is idempotent (won't run twice)
- [ ] `InventoryService.handleOrderStockMovement()` - Verify sales orders use negative quantity, returns use positive

### 2.2 Purchase Flow Stock Safety

**SQL Validation Queries:**

```sql
-- Check 1: Verify GRN completion creates PURCHASE stock movements
SELECT 
  gr.id as grn_id,
  gr.status as grn_status,
  COUNT(sm.id) as purchase_movement_count
FROM procurement.goods_receipts gr
LEFT JOIN public.stock_movements sm ON sm.reference_id = gr.id 
  AND sm.reference_type = 'goods_receipt'
  AND sm.movement_type = 'PURCHASE'
WHERE gr.status = 'completed'
  AND gr.company_id = '<company_id>'
GROUP BY gr.id, gr.status
HAVING COUNT(sm.id) = 0;

-- Expected: Empty result set (all completed GRNs should have PURCHASE movements)

-- Check 2: Verify purchase invoices DON'T create duplicate stock movements
SELECT 
  pi.id as invoice_id,
  gr.id as grn_id,
  COUNT(sm.id) as total_movements
FROM procurement.purchase_invoices pi
JOIN procurement.goods_receipts gr ON pi.goods_receipt_id = gr.id
LEFT JOIN public.stock_movements sm ON sm.reference_id = gr.id 
  AND sm.reference_type = 'goods_receipt'
WHERE gr.status = 'completed'
GROUP BY pi.id, gr.id
HAVING COUNT(sm.id) > (
  SELECT COUNT(DISTINCT gri.product_id || '-' || COALESCE(gri.variant_id::text, 'default'))
  FROM procurement.goods_receipt_items gri
  WHERE gri.goods_receipt_id = gr.id
    AND gri.quantity_accepted > 0
);

-- Expected: Empty result set (should have exactly one movement per product+variant, not duplicates)

-- Check 3: Verify purchase orders in orders table don't create stock movements
SELECT 
  o.id,
  o.order_type,
  COUNT(sm.id) as stock_movement_count
FROM public.orders o
LEFT JOIN public.stock_movements sm ON sm.reference_id = o.id 
  AND sm.reference_type = 'order'
WHERE o.order_type = 'purchase'
GROUP BY o.id, o.order_type
HAVING COUNT(sm.id) > 0;

-- Expected: Empty result set (purchase orders in orders table are for reporting only, not stock)
```

**Code Audit Checkpoints:**

- [ ] `completeGoodsReceipt()` - Verify `handlePurchaseStockMovement()` is called exactly once
- [ ] `createPurchaseOrderFromInvoiceOrderRow()` - Verify purchase order has `inventory_updated=true` (already updated via GRN)
- [ ] `createInvoiceFromGRN()` and `createPurchaseInvoice()` - Verify they don't call stock movement functions
- [ ] `InventoryService.handlePurchaseStockMovement()` - Verify it creates movements with `movementType='PURCHASE'`, `sourceType='purchase'`

## 3. Edge Case Scenarios

### 3.1 Multiple Partial Returns

**Validation Scenario:**

1. Create sales order with 10 units of Product A
2. Create return order for 3 units
3. Create another return order for 4 units
4. Attempt to return 4 more units (should fail - only 3 remaining)

**SQL Check:**

```sql
-- Verify cumulative returns don't exceed original
WITH original AS (
  SELECT product_id, variant_id, SUM(quantity) as total
  FROM public.order_items
  WHERE order_id = '<sales_order_id>'
  GROUP BY product_id, variant_id
),
returns AS (
  SELECT 
    oi.product_id, 
    oi.variant_id, 
    SUM(oi.quantity) as total_returned
  FROM public.orders r
  JOIN public.order_items oi ON r.id = oi.order_id
  WHERE r.original_order_id = '<sales_order_id>'
    AND r.order_type = 'return'
    AND r.status != 'cancelled'
  GROUP BY oi.product_id, oi.variant_id
)
SELECT 
  o.product_id,
  o.variant_id,
  o.total as original_qty,
  COALESCE(r.total_returned, 0) as returned_qty,
  (o.total - COALESCE(r.total_returned, 0)) as remaining_qty
FROM original o
LEFT JOIN returns r ON o.product_id = r.product_id 
  AND COALESCE(o.variant_id, 'default') = COALESCE(r.variant_id, 'default')
WHERE COALESCE(r.total_returned, 0) > o.total;
```

**Code Audit:**

- [ ] `createReturnOrder()` - Verify it queries existing returns and calculates cumulative quantities
- [ ] `createReturnOrder()` - Verify validation error when return quantity exceeds available

### 3.2 Return After Cancellation

**Validation Scenario:**

- Original order is cancelled
- Attempt to create return order (should fail)

**SQL Check:**

```sql
-- Verify no returns exist for cancelled orders
SELECT 
  r.id as return_id,
  o.id as original_id,
  o.status as original_status
FROM public.orders r
JOIN public.orders o ON r.original_order_id = o.id
WHERE r.order_type = 'return'
  AND o.status = 'cancelled';
```

**Code Audit:**

- [ ] `createReturnOrder()` - Verify it checks `originalOrder.status !== 'cancelled'`

### 3.3 Status Transition Safety

**Validation Scenarios:**

1. Order: `pending` → `completed` → stock movement created
2. Order: `pending` → `cancelled` → no stock movement, reserved stock released
3. Order: `completed` → `cancelled` → reverse stock movement created
4. Return: `pending` → `completed` → stock increases

**SQL Check:**

```sql
-- Verify cancelled orders don't have stock movements (unless they were completed first)
SELECT 
  o.id,
  o.status,
  o.inventory_updated,
  COUNT(sm.id) as movement_count
FROM public.orders o
LEFT JOIN public.stock_movements sm ON sm.reference_id = o.id 
  AND sm.reference_type = 'order'
WHERE o.status = 'cancelled'
  AND o.inventory_updated = false
  AND o.order_type IN ('sales', 'return')
GROUP BY o.id, o.status, o.inventory_updated
HAVING COUNT(sm.id) > 0;

-- Expected: Empty result set (cancelled orders without inventory_updated shouldn't have movements)
```

**Code Audit:**

- [ ] `OrderService.cancelOrder()` - Verify it releases reserved stock for pending orders
- [ ] `OrderService.cancelOrder()` - Verify it creates reverse RETURN movement for completed sales orders
- [ ] `OrderService.updateOrderStatus()` - Verify it only creates movements when status transitions to non-pending/non-cancelled

### 3.4 Return Order Deletion

**Business Rule Question:** Should return orders be deletable?**Recommendation:** Return orders should NOT be deletable (only cancellable) to maintain audit trail.**SQL Check:**

```sql
-- Verify no deleted return orders exist (if soft delete is used)
SELECT COUNT(*) 
FROM public.orders 
WHERE order_type = 'return' 
  AND deleted_at IS NOT NULL;
```

**Code Audit:**

- [ ] Verify DELETE endpoint doesn't exist for return orders
- [ ] Verify only cancellation is allowed

## 4. RLS Validation

### 4.1 Company-Level Isolation

**SQL Validation Queries:**

```sql
-- Check 1: Verify orders are company-scoped
SELECT 
  o1.id,
  o1.company_id,
  o2.id as cross_company_order
FROM public.orders o1
JOIN public.orders o2 ON o1.original_order_id = o2.id
WHERE o1.company_id != o2.company_id;

-- Expected: Empty result set (returns should never link across companies)

-- Check 2: Verify stock movements are company-scoped
SELECT 
  sm1.id,
  sm1.company_id,
  sm2.company_id as cross_company_movement
FROM public.stock_movements sm1
JOIN public.stock_movements sm2 ON sm1.reference_id = sm2.reference_id
WHERE sm1.company_id != sm2.company_id;

-- Expected: Empty result set

-- Check 3: Test RLS policy enforcement (run as non-admin user)
-- This should return 0 rows if RLS is working
SELECT COUNT(*) 
FROM public.orders 
WHERE company_id != current_company_id();
```

**Code Audit Checkpoints:**

- [ ] `createReturnOrder()` - Verify it checks `originalOrder.company_id === req.companyId`
- [ ] `OrderService.createOrder()` - Verify `company_id` is always set from service context
- [ ] `InventoryService.recordStockMovement()` - Verify `company_id` is always set
- [ ] All RLS policies use `company_id = current_company_id()` helper

### 4.2 Warehouse Isolation

**SQL Validation Queries:**

```sql
-- Verify stock movements reference warehouses within same company
SELECT 
  sm.id,
  sm.company_id,
  sm.outlet_id,
  w.company_id as warehouse_company_id
FROM public.stock_movements sm
JOIN public.warehouses w ON sm.outlet_id = w.id
WHERE sm.company_id != w.company_id;

-- Expected: Empty result set
```

**Code Audit:**

- [ ] `InventoryService.recordStockMovement()` - Verify warehouse belongs to company before creating movement
- [ ] RLS policies for `stock_movements` verify `has_warehouse_access()` for warehouse managers

## 5. Reporting & Analytics Validation

### 5.1 Sales Analytics Accuracy

**SQL Validation Queries:**

```sql
-- Check 1: Verify sales analytics only includes order_type='sales'
SELECT 
  COUNT(*) as non_sales_in_sales_analytics
FROM public.orders
WHERE company_id = '<company_id>'
  AND order_type != 'sales'
  AND created_at >= '<analytics_start_date>'
  AND created_at <= '<analytics_end_date>'
  AND status != 'cancelled';

-- This should match the count from sales analytics endpoint

-- Check 2: Verify KPI endpoints filter correctly
-- Sales KPI should only count order_type='sales'
SELECT 
  COUNT(*) as total_orders,
  COUNT(*) FILTER (WHERE order_type = 'sales') as sales_orders,
  COUNT(*) FILTER (WHERE order_type = 'purchase') as purchase_orders,
  COUNT(*) FILTER (WHERE order_type = 'return') as return_orders
FROM public.orders
WHERE company_id = '<company_id>'
  AND created_at >= CURRENT_DATE - INTERVAL '30 days';
```

**Code Audit Checkpoints:**

- [ ] `getSalesAnalytics()` - Verify it filters `order_type='sales'`
- [ ] `getModuleKPIs()` - Verify 'sales' module filters `order_type='sales'`
- [ ] `getModuleKPIs()` - Verify 'pos' module filters `order_type='sales' AND order_source='pos'`
- [ ] `getModuleKPIs()` - Verify 'ecommerce' module filters `order_type='sales' AND order_source='ecommerce'`
- [ ] `getModuleKPIs()` - Verify 'accounting' module filters `order_type='sales'` for receivables

### 5.2 Legacy NULL-Based Inference Removal

**SQL Validation Queries:**

```sql
-- Check: Verify no queries use NULL-based inference for order_source
-- This requires code review, but we can check for patterns:
-- - Queries that check `user_id IS NULL` to infer POS
-- - Queries that join customers to infer sales_executive
-- - Queries that check shipping_address_id to infer fulfillment_type
```

**Code Audit:**

- [ ] Search codebase for `user_id IS NULL` patterns in order queries
- [ ] Search for `shipping_address_id IS NULL` patterns
- [ ] Verify all order creation uses explicit `order_source` and `fulfillment_type`
- [ ] Verify all analytics queries use explicit fields, not NULL inference

## 6. Performance Review

### 6.1 Index Validation

**SQL Validation Queries:**

```sql
-- Check existing indexes
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('orders', 'stock_movements')
ORDER BY tablename, indexname;

-- Verify critical indexes exist:
-- orders: order_type, order_source, fulfillment_type, original_order_id
-- stock_movements: source_type, movement_type, reference_type, reference_id

```