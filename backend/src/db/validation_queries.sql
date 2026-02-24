-- ============================================================================
-- ERP System Validation Queries
-- ============================================================================
-- This file contains SQL queries to validate data consistency, stock safety,
-- and system integrity after the explicit order model and return orders refactor.
-- 
-- Usage: Replace '<company_id>' with actual company UUID before running
-- ============================================================================

-- ============================================================================
-- 1. DATA CONSISTENCY VALIDATION
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1.1 Order Table Integrity Checks
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- 1.2 Stock Movements Integrity Checks
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- 1.3 Return Order Validation
-- ----------------------------------------------------------------------------

-- Check 1: Verify cumulative return quantities don't exceed original
-- Replace '<original_order_id>' with actual order UUID
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
  AND COALESCE(rt.variant_id::text, 'default') = COALESCE(ot.variant_id::text, 'default')
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

-- ============================================================================
-- 2. STOCK SAFETY VALIDATION
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1 Double Inventory Update Prevention
-- ----------------------------------------------------------------------------

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
  AND o.company_id = '<company_id>'
GROUP BY o.id, o.order_type, o.status, o.inventory_updated
HAVING COUNT(sm.id) > (
  SELECT COUNT(*) 
  FROM public.order_items oi 
  WHERE oi.order_id = o.id
);

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
  AND o.company_id = '<company_id>'
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
  AND sm.quantity > 0
  AND o.company_id = '<company_id>';

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
  AND sm.quantity < 0
  AND o.company_id = '<company_id>';

-- Expected: Empty result set (returns should have positive quantities)

-- ----------------------------------------------------------------------------
-- 2.2 Purchase Flow Stock Safety
-- ----------------------------------------------------------------------------

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
  COUNT(sm.id) as total_movements,
  (
    SELECT COUNT(DISTINCT gri.product_id || '-' || COALESCE(gri.variant_id::text, 'default'))
    FROM procurement.goods_receipt_items gri
    WHERE gri.goods_receipt_id = gr.id
      AND gri.quantity_accepted > 0
  ) as expected_movements
FROM procurement.purchase_invoices pi
JOIN procurement.goods_receipts gr ON pi.goods_receipt_id = gr.id
LEFT JOIN public.stock_movements sm ON sm.reference_id = gr.id 
  AND sm.reference_type = 'goods_receipt'
WHERE gr.status = 'completed'
  AND gr.company_id = '<company_id>'
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
  AND o.company_id = '<company_id>'
GROUP BY o.id, o.order_type
HAVING COUNT(sm.id) > 0;

-- Expected: Empty result set (purchase orders in orders table are for reporting only, not stock)

-- ============================================================================
-- 3. EDGE CASE SCENARIOS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1 Multiple Partial Returns
-- ----------------------------------------------------------------------------

-- Verify cumulative returns don't exceed original
-- Replace '<sales_order_id>' with actual order UUID
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
  AND COALESCE(o.variant_id::text, 'default') = COALESCE(r.variant_id::text, 'default')
WHERE COALESCE(r.total_returned, 0) > o.total;

-- Expected: Empty result set

-- ----------------------------------------------------------------------------
-- 3.2 Return After Cancellation
-- ----------------------------------------------------------------------------

-- Verify no returns exist for cancelled orders
SELECT 
  r.id as return_id,
  o.id as original_id,
  o.status as original_status
FROM public.orders r
JOIN public.orders o ON r.original_order_id = o.id
WHERE r.order_type = 'return'
  AND o.status = 'cancelled';

-- Expected: Empty result set

-- ----------------------------------------------------------------------------
-- 3.3 Status Transition Safety
-- ----------------------------------------------------------------------------

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
  AND o.company_id = '<company_id>'
GROUP BY o.id, o.status, o.inventory_updated
HAVING COUNT(sm.id) > 0;

-- Expected: Empty result set (cancelled orders without inventory_updated shouldn't have movements)

-- ============================================================================
-- 4. RLS VALIDATION
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 4.1 Company-Level Isolation
-- ----------------------------------------------------------------------------

-- Check 1: Verify orders are company-scoped
SELECT 
  o1.id,
  o1.company_id,
  o2.id as cross_company_order,
  o2.company_id as original_company_id
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

-- ----------------------------------------------------------------------------
-- 4.2 Warehouse Isolation
-- ----------------------------------------------------------------------------

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

-- ============================================================================
-- 5. REPORTING & ANALYTICS VALIDATION
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 5.1 Sales Analytics Accuracy
-- ----------------------------------------------------------------------------

-- Check 1: Verify sales analytics only includes order_type='sales'
SELECT 
  COUNT(*) as non_sales_in_sales_analytics
FROM public.orders
WHERE company_id = '<company_id>'
  AND order_type != 'sales'
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
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

-- ============================================================================
-- 6. PERFORMANCE REVIEW
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 6.1 Index Validation
-- ----------------------------------------------------------------------------

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

