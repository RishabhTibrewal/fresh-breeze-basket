-- Materialized view: daily sales aggregation for fast Sales report queries.
-- Refresh nightly via: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sales_daily;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_sales_daily AS
SELECT
  DATE_TRUNC('day', o.created_at AT TIME ZONE 'Asia/Dubai')::DATE   AS sale_date,
  o.outlet_id                                                         AS warehouse_id,
  o.sales_executive_id,
  oi.product_id,
  oi.variant_id,
  o.company_id,
  COUNT(DISTINCT o.id)                                               AS order_count,
  SUM(oi.quantity)                                                   AS total_qty,
  SUM(oi.unit_price * oi.quantity)                                   AS gross_amount,
  SUM(COALESCE(oi.tax_amount, 0))                                    AS total_tax,
  SUM(oi.unit_price * oi.quantity + COALESCE(oi.tax_amount, 0))     AS net_amount,
  SUM(COALESCE(oi.discount, 0))                                      AS total_discount
FROM public.orders o
JOIN public.order_items oi ON oi.order_id = o.id
WHERE o.status NOT IN ('cancelled')
  AND o.order_type = 'sales'
GROUP BY
  DATE_TRUNC('day', o.created_at AT TIME ZONE 'Asia/Dubai')::DATE,
  o.outlet_id,
  o.sales_executive_id,
  oi.product_id,
  oi.variant_id,
  o.company_id
WITH DATA;

-- Unique index required for CONCURRENT refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_sales_daily_pk
  ON public.mv_sales_daily (sale_date, warehouse_id, COALESCE(sales_executive_id::TEXT,''), product_id, variant_id, company_id);

-- Additional query indexes
CREATE INDEX IF NOT EXISTS idx_mv_sales_daily_company_date
  ON public.mv_sales_daily (company_id, sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_mv_sales_daily_executive
  ON public.mv_sales_daily (company_id, sales_executive_id, sale_date DESC);

COMMENT ON MATERIALIZED VIEW public.mv_sales_daily IS
  'Daily sales aggregation. Refresh nightly with: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sales_daily';
