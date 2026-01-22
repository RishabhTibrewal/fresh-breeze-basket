-- Create a default company (used for existing data)
INSERT INTO public.companies (name, slug)
VALUES ('Default Company', 'default')
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
  default_company_id UUID;
BEGIN
  SELECT id INTO default_company_id FROM public.companies WHERE slug = 'default' LIMIT 1;

  UPDATE public.profiles SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE public.categories SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE public.products SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE public.product_images SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE public.warehouses SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE public.warehouse_inventory SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE public.inventory_old SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE public.addresses SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE public.orders SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE public.order_status_history SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE public.order_items SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE public.payments SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE public.carts SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE public.cart_items SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE public.customers SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE public.credit_periods SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE public.leads SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE public.sales_targets SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE public.suppliers SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE public.supplier_bank_accounts SET company_id = default_company_id WHERE company_id IS NULL;

  UPDATE procurement.purchase_orders SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE procurement.purchase_order_items SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE procurement.goods_receipts SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE procurement.goods_receipt_items SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE procurement.purchase_invoices SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE procurement.supplier_payments SET company_id = default_company_id WHERE company_id IS NULL;
END $$;

-- Enforce NOT NULL after backfill
ALTER TABLE public.profiles ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.categories ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.products ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.product_images ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.warehouses ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.warehouse_inventory ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.inventory_old ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.addresses ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.orders ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.order_status_history ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.order_items ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.payments ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.carts ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.cart_items ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.customers ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.credit_periods ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.leads ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.sales_targets ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.suppliers ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.supplier_bank_accounts ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE procurement.purchase_orders ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE procurement.purchase_order_items ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE procurement.goods_receipts ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE procurement.goods_receipt_items ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE procurement.purchase_invoices ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE procurement.supplier_payments ALTER COLUMN company_id SET NOT NULL;
