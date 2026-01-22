-- Add companies table
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add company_id to core tables
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.product_images ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.warehouse_inventory ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.inventory_old ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.order_status_history ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.carts ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.credit_periods ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.sales_targets ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.supplier_bank_accounts ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

-- Procurement schema tables
ALTER TABLE procurement.purchase_orders ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE procurement.purchase_order_items ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE procurement.goods_receipts ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE procurement.goods_receipt_items ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE procurement.purchase_invoices ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE procurement.supplier_payments ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

-- Indexes for tenant scoping
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_categories_company_id ON public.categories(company_id);
CREATE INDEX IF NOT EXISTS idx_products_company_id ON public.products(company_id);
CREATE INDEX IF NOT EXISTS idx_product_images_company_id ON public.product_images(company_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_company_id ON public.warehouses(company_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_company_id ON public.warehouse_inventory(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_company_id ON public.inventory_old(company_id);
CREATE INDEX IF NOT EXISTS idx_addresses_company_id ON public.addresses(company_id);
CREATE INDEX IF NOT EXISTS idx_orders_company_id ON public.orders(company_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_company_id ON public.order_status_history(company_id);
CREATE INDEX IF NOT EXISTS idx_order_items_company_id ON public.order_items(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_company_id ON public.payments(company_id);
CREATE INDEX IF NOT EXISTS idx_carts_company_id ON public.carts(company_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_company_id ON public.cart_items(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON public.customers(company_id);
CREATE INDEX IF NOT EXISTS idx_credit_periods_company_id ON public.credit_periods(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_company_id ON public.leads(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_targets_company_id ON public.sales_targets(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_company_id ON public.suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_supplier_bank_accounts_company_id ON public.supplier_bank_accounts(company_id);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_company_id ON procurement.purchase_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_company_id ON procurement.purchase_order_items(company_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_company_id ON procurement.goods_receipts(company_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipt_items_company_id ON procurement.goods_receipt_items(company_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_company_id ON procurement.purchase_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_company_id ON procurement.supplier_payments(company_id);
