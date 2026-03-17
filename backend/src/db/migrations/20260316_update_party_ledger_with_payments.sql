-- Migration: Extend party_ledger to include customer and supplier payments

CREATE OR REPLACE VIEW public.party_ledger AS
  -- Receivables: sales orders linked via customers -> auth.users
  SELECT
    cp.id            AS party_id,
    cp.company_id    AS company_id,
    cp.name          AS name,
    'receivable'     AS ledger_side,
    'sale'           AS doc_type,
    o.id             AS doc_id,
    o.total_amount   AS amount,
    o.created_at     AS doc_date,
    o.status         AS status
  FROM public.contact_parties cp
  JOIN public.customers c
    ON c.party_id = cp.id
  JOIN public.orders o
    ON o.user_id = c.user_id
   AND o.company_id = cp.company_id
  WHERE cp.is_customer = TRUE
    AND c.user_id IS NOT NULL

  UNION ALL

  -- Receivables: customer payments against orders
  SELECT
    cp.id            AS party_id,
    cp.company_id    AS company_id,
    cp.name          AS name,
    'receivable'     AS ledger_side,
    'payment_in'     AS doc_type,
    p.id             AS doc_id,
    p.amount         AS amount,
    COALESCE(p.payment_date::timestamptz, p.created_at) AS doc_date,
    p.status         AS status
  FROM public.contact_parties cp
  JOIN public.customers c
    ON c.party_id = cp.id
  JOIN public.orders o
    ON o.user_id = c.user_id
   AND o.company_id = cp.company_id
  JOIN public.payments p
    ON p.order_id = o.id
   AND p.company_id = cp.company_id
  WHERE cp.is_customer = TRUE
    AND c.user_id IS NOT NULL

  UNION ALL

  -- Payables: purchase invoices via suppliers -> purchase_orders
  SELECT
    cp.id             AS party_id,
    cp.company_id     AS company_id,
    cp.name           AS name,
    'payable'         AS ledger_side,
    'purchase'        AS doc_type,
    pi.id             AS doc_id,
    pi.total_amount   AS amount,
    pi.invoice_date   AS doc_date,
    pi.status         AS status
  FROM public.contact_parties cp
  JOIN public.suppliers s
    ON s.party_id = cp.id
  JOIN procurement.purchase_orders po
    ON po.supplier_id = s.id
   AND po.company_id = cp.company_id
  JOIN procurement.purchase_invoices pi
    ON pi.purchase_order_id = po.id
   AND pi.company_id = cp.company_id
  WHERE cp.is_supplier = TRUE

  UNION ALL

  -- Payables: supplier payments
  SELECT
    cp.id               AS party_id,
    cp.company_id       AS company_id,
    cp.name             AS name,
    'payable'           AS ledger_side,
    'payment_out'       AS doc_type,
    sp.id               AS doc_id,
    sp.amount           AS amount,
    sp.payment_date::timestamptz AS doc_date,
    sp.status           AS status
  FROM public.contact_parties cp
  JOIN public.suppliers s
    ON s.party_id = cp.id
   AND s.company_id = cp.company_id
  JOIN procurement.supplier_payments sp
    ON sp.supplier_id = s.id
   AND sp.company_id = cp.company_id
  WHERE cp.is_supplier = TRUE;

