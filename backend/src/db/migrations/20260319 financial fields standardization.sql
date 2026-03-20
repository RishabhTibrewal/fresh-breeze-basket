-- =============================================================================
-- Migration: Financial fields standardization  (v2 — complete)
-- Date: 2026-03-19
-- Description:
--   Adds/renames financial fields across all document tables for consistency.
--
-- Formula contract (enforced by app, not DB triggers):
--   line_total    = (unit_price × qty) − discount_amount + tax_amount
--   subtotal      = SUM(unit_price × qty)                 ← gross, before disc/tax
--   total_discount= SUM(discount_amount) across items
--   total_tax     = SUM(tax_amount) across items
--   extra_discount_amount = flat header-level discount after line totals
--   total_amount  = subtotal − total_discount + total_tax − extra_discount_amount
--
-- GRN note:
--   goods_receipts.total_received_amount keeps its name (physical receipt value).
--   Only total_tax is added — no discount fields on GRNs.
--
-- cart_items note:
--   Price snapshot added so cart → order conversion uses the price at add-time,
--   not the live price at checkout.
-- =============================================================================

BEGIN;

-- =============================================================================
-- SECTION 1: LINE ITEM TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1a. quotation_items
--     Has:    tax_amount, discount_amount
--     Adding: tax_percentage, discount_percentage, line_total
-- -----------------------------------------------------------------------------
ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS tax_percentage      NUMERIC NOT NULL DEFAULT 0
                             CHECK (tax_percentage >= 0 AND tax_percentage <= 100),
  ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC NOT NULL DEFAULT 0
                             CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  ADD COLUMN IF NOT EXISTS line_total          NUMERIC NOT NULL DEFAULT 0
                             CHECK (line_total >= 0);

COMMENT ON COLUMN public.quotation_items.tax_percentage      IS 'Tax rate (%) snapshotted at time of quotation creation';
COMMENT ON COLUMN public.quotation_items.discount_percentage IS 'Line discount rate (%) snapshotted at time of quotation creation';
COMMENT ON COLUMN public.quotation_items.line_total          IS '(unit_price × qty) − discount_amount + tax_amount';

-- -----------------------------------------------------------------------------
-- 1b. order_items
--     Has:    tax_amount
--     Adding: tax_percentage, discount_percentage, discount_amount, line_total
-- -----------------------------------------------------------------------------
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS tax_percentage      NUMERIC NOT NULL DEFAULT 0
                             CHECK (tax_percentage >= 0 AND tax_percentage <= 100),
  ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC NOT NULL DEFAULT 0
                             CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  ADD COLUMN IF NOT EXISTS discount_amount     NUMERIC NOT NULL DEFAULT 0
                             CHECK (discount_amount >= 0),
  ADD COLUMN IF NOT EXISTS line_total          NUMERIC NOT NULL DEFAULT 0
                             CHECK (line_total >= 0);

COMMENT ON COLUMN public.order_items.tax_percentage      IS 'Tax rate (%) snapshotted at time of order creation';
COMMENT ON COLUMN public.order_items.discount_percentage IS 'Line discount rate (%) snapshotted at time of order creation';
COMMENT ON COLUMN public.order_items.discount_amount     IS 'Calculated discount amount for this line';
COMMENT ON COLUMN public.order_items.line_total          IS '(unit_price × qty) − discount_amount + tax_amount';

-- -----------------------------------------------------------------------------
-- 1c. purchase_order_items
--     Has:    tax_percentage, line_total
--     Adding: tax_amount, discount_percentage, discount_amount
-- -----------------------------------------------------------------------------
ALTER TABLE procurement.purchase_order_items
  ADD COLUMN IF NOT EXISTS tax_amount          NUMERIC NOT NULL DEFAULT 0
                             CHECK (tax_amount >= 0),
  ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC NOT NULL DEFAULT 0
                             CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  ADD COLUMN IF NOT EXISTS discount_amount     NUMERIC NOT NULL DEFAULT 0
                             CHECK (discount_amount >= 0);

COMMENT ON COLUMN procurement.purchase_order_items.tax_amount          IS 'Calculated tax amount for this line';
COMMENT ON COLUMN procurement.purchase_order_items.discount_percentage IS 'Line discount rate (%) snapshotted at time of PO creation';
COMMENT ON COLUMN procurement.purchase_order_items.discount_amount     IS 'Calculated discount amount for this line';

-- -----------------------------------------------------------------------------
-- 1d. purchase_invoice_items
--     Has:    tax_percentage, tax_amount, discount_amount, line_total
--     Adding: discount_percentage
-- -----------------------------------------------------------------------------
ALTER TABLE procurement.purchase_invoice_items
  ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC NOT NULL DEFAULT 0
                             CHECK (discount_percentage >= 0 AND discount_percentage <= 100);

COMMENT ON COLUMN procurement.purchase_invoice_items.discount_percentage IS 'Line discount rate (%) snapshotted at time of invoice creation';

-- -----------------------------------------------------------------------------
-- 1e. goods_receipt_items
--     Has:    tax_percentage
--     Adding: tax_amount, line_total
--     No discount fields — GRNs are physical receiving docs only.
-- -----------------------------------------------------------------------------
ALTER TABLE procurement.goods_receipt_items
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC NOT NULL DEFAULT 0
                             CHECK (tax_amount >= 0),
  ADD COLUMN IF NOT EXISTS line_total NUMERIC NOT NULL DEFAULT 0
                             CHECK (line_total >= 0);

COMMENT ON COLUMN procurement.goods_receipt_items.tax_amount IS 'Calculated tax amount at time of receipt';
COMMENT ON COLUMN procurement.goods_receipt_items.line_total IS '(unit_price × quantity_accepted) + tax_amount';

-- -----------------------------------------------------------------------------
-- 1f. cart_items
--     Has:    quantity (no price snapshot at all)
--     Adding: unit_price, tax_percentage, tax_amount, line_total
--     Reason: Price must be locked when item is added to cart, not at checkout.
-- -----------------------------------------------------------------------------
ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS unit_price      NUMERIC NOT NULL DEFAULT 0
                             CHECK (unit_price >= 0),
  ADD COLUMN IF NOT EXISTS tax_percentage  NUMERIC NOT NULL DEFAULT 0
                             CHECK (tax_percentage >= 0 AND tax_percentage <= 100),
  ADD COLUMN IF NOT EXISTS tax_amount      NUMERIC NOT NULL DEFAULT 0
                             CHECK (tax_amount >= 0),
  ADD COLUMN IF NOT EXISTS line_total      NUMERIC NOT NULL DEFAULT 0
                             CHECK (line_total >= 0);

COMMENT ON COLUMN public.cart_items.unit_price     IS 'Price snapshotted from product_prices at time item was added to cart';
COMMENT ON COLUMN public.cart_items.tax_percentage IS 'Tax rate (%) snapshotted at time item was added to cart';
COMMENT ON COLUMN public.cart_items.tax_amount     IS 'Calculated tax amount: unit_price × qty × (tax_percentage/100)';
COMMENT ON COLUMN public.cart_items.line_total     IS '(unit_price × qty) + tax_amount';


-- =============================================================================
-- SECTION 2: HEADER TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 2a. quotations
--     Renames: tax_amount      → total_tax
--              discount_amount → total_discount
--              extra_discount  → extra_discount_amount
--     Adding:  subtotal (gross before disc/tax), extra_discount_percentage
--     Fix:     extra_discount_amount gets CHECK >= 0 after rename
-- -----------------------------------------------------------------------------
ALTER TABLE public.quotations
  RENAME COLUMN tax_amount      TO total_tax;
ALTER TABLE public.quotations
  RENAME COLUMN discount_amount TO total_discount;
ALTER TABLE public.quotations
  RENAME COLUMN extra_discount  TO extra_discount_amount;

ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_extra_discount_amount_check CHECK (extra_discount_amount >= 0);

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS subtotal                   NUMERIC NOT NULL DEFAULT 0
                             CHECK (subtotal >= 0),
  ADD COLUMN IF NOT EXISTS extra_discount_percentage  NUMERIC NOT NULL DEFAULT 0
                             CHECK (extra_discount_percentage >= 0 AND extra_discount_percentage <= 100);

COMMENT ON COLUMN public.quotations.subtotal                   IS 'Gross total: SUM(unit_price × qty) before any discount or tax';
COMMENT ON COLUMN public.quotations.total_tax                  IS 'SUM of all line-level tax amounts';
COMMENT ON COLUMN public.quotations.total_discount             IS 'SUM of all line-level discount amounts';
COMMENT ON COLUMN public.quotations.extra_discount_percentage  IS 'Header-level extra discount rate (%) applied after line totals';
COMMENT ON COLUMN public.quotations.extra_discount_amount      IS 'Calculated header-level extra discount value';
COMMENT ON COLUMN public.quotations.total_amount               IS 'subtotal − total_discount + total_tax − extra_discount_amount';

-- -----------------------------------------------------------------------------
-- 2b. orders
--     Has:    total_amount
--     Adding: subtotal, total_tax, total_discount,
--             extra_discount_percentage, extra_discount_amount
-- -----------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS subtotal                  NUMERIC NOT NULL DEFAULT 0
                             CHECK (subtotal >= 0),
  ADD COLUMN IF NOT EXISTS total_tax                 NUMERIC NOT NULL DEFAULT 0
                             CHECK (total_tax >= 0),
  ADD COLUMN IF NOT EXISTS total_discount            NUMERIC NOT NULL DEFAULT 0
                             CHECK (total_discount >= 0),
  ADD COLUMN IF NOT EXISTS extra_discount_percentage NUMERIC NOT NULL DEFAULT 0
                             CHECK (extra_discount_percentage >= 0 AND extra_discount_percentage <= 100),
  ADD COLUMN IF NOT EXISTS extra_discount_amount     NUMERIC NOT NULL DEFAULT 0
                             CHECK (extra_discount_amount >= 0);

COMMENT ON COLUMN public.orders.subtotal                   IS 'Gross total: SUM(unit_price × qty) before any discount or tax';
COMMENT ON COLUMN public.orders.total_tax                  IS 'SUM of all line-level tax amounts';
COMMENT ON COLUMN public.orders.total_discount             IS 'SUM of all line-level discount amounts';
COMMENT ON COLUMN public.orders.extra_discount_percentage  IS 'Header-level extra discount rate (%) applied after line totals';
COMMENT ON COLUMN public.orders.extra_discount_amount      IS 'Calculated header-level extra discount value';
COMMENT ON COLUMN public.orders.total_amount               IS 'subtotal − total_discount + total_tax − extra_discount_amount';

-- -----------------------------------------------------------------------------
-- 2c. purchase_orders
--     Has:    total_amount
--     Adding: subtotal, total_tax, total_discount,
--             extra_discount_percentage, extra_discount_amount
-- -----------------------------------------------------------------------------
ALTER TABLE procurement.purchase_orders
  ADD COLUMN IF NOT EXISTS subtotal                  NUMERIC NOT NULL DEFAULT 0
                             CHECK (subtotal >= 0),
  ADD COLUMN IF NOT EXISTS total_tax                 NUMERIC NOT NULL DEFAULT 0
                             CHECK (total_tax >= 0),
  ADD COLUMN IF NOT EXISTS total_discount            NUMERIC NOT NULL DEFAULT 0
                             CHECK (total_discount >= 0),
  ADD COLUMN IF NOT EXISTS extra_discount_percentage NUMERIC NOT NULL DEFAULT 0
                             CHECK (extra_discount_percentage >= 0 AND extra_discount_percentage <= 100),
  ADD COLUMN IF NOT EXISTS extra_discount_amount     NUMERIC NOT NULL DEFAULT 0
                             CHECK (extra_discount_amount >= 0);

COMMENT ON COLUMN procurement.purchase_orders.subtotal                   IS 'Gross total: SUM(unit_price × qty) before any discount or tax';
COMMENT ON COLUMN procurement.purchase_orders.total_tax                  IS 'SUM of all line-level tax amounts';
COMMENT ON COLUMN procurement.purchase_orders.total_discount             IS 'SUM of all line-level discount amounts';
COMMENT ON COLUMN procurement.purchase_orders.extra_discount_percentage  IS 'Header-level extra discount rate (%) applied after line totals';
COMMENT ON COLUMN procurement.purchase_orders.extra_discount_amount      IS 'Calculated header-level extra discount value';
COMMENT ON COLUMN procurement.purchase_orders.total_amount               IS 'subtotal − total_discount + total_tax − extra_discount_amount';

-- -----------------------------------------------------------------------------
-- 2d. purchase_invoices
--     Has:    subtotal, total_amount  ← already has subtotal, good
--     Renames: tax_amount      → total_tax
--              discount_amount → total_discount
--     Adding:  extra_discount_percentage, extra_discount_amount
-- -----------------------------------------------------------------------------
ALTER TABLE procurement.purchase_invoices
  RENAME COLUMN tax_amount      TO total_tax;
ALTER TABLE procurement.purchase_invoices
  RENAME COLUMN discount_amount TO total_discount;

ALTER TABLE procurement.purchase_invoices
  ADD COLUMN IF NOT EXISTS extra_discount_percentage NUMERIC NOT NULL DEFAULT 0
                             CHECK (extra_discount_percentage >= 0 AND extra_discount_percentage <= 100),
  ADD COLUMN IF NOT EXISTS extra_discount_amount     NUMERIC NOT NULL DEFAULT 0
                             CHECK (extra_discount_amount >= 0);

COMMENT ON COLUMN procurement.purchase_invoices.total_tax                  IS 'SUM of all line-level tax amounts';
COMMENT ON COLUMN procurement.purchase_invoices.total_discount             IS 'SUM of all line-level discount amounts';
COMMENT ON COLUMN procurement.purchase_invoices.extra_discount_percentage  IS 'Header-level extra discount rate (%) applied after line totals';
COMMENT ON COLUMN procurement.purchase_invoices.extra_discount_amount      IS 'Calculated header-level extra discount value';
COMMENT ON COLUMN procurement.purchase_invoices.total_amount               IS 'subtotal − total_discount + total_tax − extra_discount_amount';

-- -----------------------------------------------------------------------------
-- 2e. goods_receipts
--     Has:    total_received_amount (kept — physical receipt value, not renamed)
--     Adding: total_tax only
--     No discount fields — GRNs are physical receiving docs only.
-- -----------------------------------------------------------------------------
ALTER TABLE procurement.goods_receipts
  ADD COLUMN IF NOT EXISTS total_tax NUMERIC NOT NULL DEFAULT 0
                             CHECK (total_tax >= 0);

COMMENT ON COLUMN procurement.goods_receipts.total_received_amount IS 'Total value of accepted items: SUM(unit_price × quantity_accepted)';
COMMENT ON COLUMN procurement.goods_receipts.total_tax             IS 'SUM of all line-level tax amounts from goods_receipt_items';

COMMIT;