-- Migration: Fix unique constraints for procurement tables to be company-scoped
-- PO numbers, GRN numbers, invoice numbers, and payment numbers should be unique per company, not globally

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. purchase_orders: po_number should be unique per company
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the existing unique constraint on po_number
ALTER TABLE procurement.purchase_orders 
DROP CONSTRAINT IF EXISTS purchase_orders_po_number_key;

-- Add composite unique constraint on (po_number, company_id)
CREATE UNIQUE INDEX IF NOT EXISTS purchase_orders_po_number_company_id_key
ON procurement.purchase_orders (po_number, company_id);

-- Add comment
COMMENT ON INDEX procurement.purchase_orders_po_number_company_id_key IS 
'Ensures PO numbers are unique per company, allowing different companies to use the same PO number';


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. goods_receipts: grn_number should be unique per company
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the existing unique constraint on grn_number
ALTER TABLE procurement.goods_receipts 
DROP CONSTRAINT IF EXISTS goods_receipts_grn_number_key;

-- Add composite unique constraint on (grn_number, company_id)
CREATE UNIQUE INDEX IF NOT EXISTS goods_receipts_grn_number_company_id_key
ON procurement.goods_receipts (grn_number, company_id);

-- Add comment
COMMENT ON INDEX procurement.goods_receipts_grn_number_company_id_key IS 
'Ensures GRN numbers are unique per company, allowing different companies to use the same GRN number';


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. purchase_invoices: invoice_number should be unique per company
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the existing unique constraint on invoice_number
ALTER TABLE procurement.purchase_invoices 
DROP CONSTRAINT IF EXISTS purchase_invoices_invoice_number_key;

-- Add composite unique constraint on (invoice_number, company_id)
CREATE UNIQUE INDEX IF NOT EXISTS purchase_invoices_invoice_number_company_id_key
ON procurement.purchase_invoices (invoice_number, company_id);

-- Add comment
COMMENT ON INDEX procurement.purchase_invoices_invoice_number_company_id_key IS 
'Ensures invoice numbers are unique per company, allowing different companies to use the same invoice number';


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. supplier_payments: payment_number should be unique per company
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the existing unique constraint on payment_number
ALTER TABLE procurement.supplier_payments 
DROP CONSTRAINT IF EXISTS supplier_payments_payment_number_key;

-- Add composite unique constraint on (payment_number, company_id)
CREATE UNIQUE INDEX IF NOT EXISTS supplier_payments_payment_number_company_id_key
ON procurement.supplier_payments (payment_number, company_id);

-- Add comment
COMMENT ON INDEX procurement.supplier_payments_payment_number_company_id_key IS 
'Ensures payment numbers are unique per company, allowing different companies to use the same payment number';

