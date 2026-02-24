-- Migration: Backfill new order_type, order_source, and fulfillment_type fields
-- NOTE: This assumes legacy order_type values were 'SALE' and 'RETURN'

-- 1. Normalise legacy order_type values into new business-level types
UPDATE public.orders
SET order_type = CASE
  WHEN order_type IS NULL THEN 'sales'
  WHEN order_type = 'SALE' THEN 'sales'
  WHEN order_type = 'RETURN' THEN 'return'
  ELSE order_type
END;

-- 2. Infer order_source based on presence of user_id and sales_executive mapping
--    - POS: user_id IS NULL
--    - Sales dashboard: user_id has a customer row with sales_executive_id
--    - E-commerce: remaining user_id-based orders
UPDATE public.orders o
SET order_source = CASE
  WHEN o.user_id IS NULL THEN 'pos'
  WHEN EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.user_id = o.user_id
      AND c.sales_executive_id IS NOT NULL
      AND c.company_id = o.company_id
  ) THEN 'sales'
  ELSE 'ecommerce'
END
WHERE order_source IS NULL;

-- 3. Infer fulfillment_type
--    - POS with no shipping address → cash_counter
--    - No shipping address (non-POS) → pickup
--    - Has shipping address → delivery
UPDATE public.orders
SET fulfillment_type = CASE
  WHEN fulfillment_type IS NOT NULL THEN fulfillment_type
  WHEN shipping_address_id IS NULL AND order_source = 'pos' THEN 'cash_counter'
  WHEN shipping_address_id IS NULL THEN 'pickup'
  ELSE 'delivery'
END
WHERE fulfillment_type IS NULL;

-- 4. Validate new constraints now that data is backfilled
ALTER TABLE public.orders VALIDATE CONSTRAINT valid_order_source;
ALTER TABLE public.orders VALIDATE CONSTRAINT valid_fulfillment_type;


