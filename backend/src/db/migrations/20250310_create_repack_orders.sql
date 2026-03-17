-- Migration: Create repack_orders and repack_order_items tables
-- Repack orders track package breakdown transactions (bulk → retail)

CREATE TABLE IF NOT EXISTS public.repack_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_repack_orders_company ON public.repack_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_repack_orders_warehouse ON public.repack_orders(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_repack_orders_status ON public.repack_orders(status);

CREATE TABLE IF NOT EXISTS public.repack_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repack_order_id UUID NOT NULL REFERENCES public.repack_orders(id) ON DELETE CASCADE,
  input_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  input_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  input_quantity DECIMAL(12,4) NOT NULL,
  output_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  output_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  output_quantity INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_repack_order_items_repack_order ON public.repack_order_items(repack_order_id);

ALTER TABLE public.repack_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repack_order_items ENABLE ROW LEVEL SECURITY;

-- repack_orders RLS
CREATE POLICY "Company users can view repack orders"
  ON public.repack_orders FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY "Company admins can manage repack orders"
  ON public.repack_orders FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid())
    AND company_id = public.current_company_id()
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    AND company_id = public.current_company_id()
  );

CREATE POLICY "Warehouse managers can manage repack orders"
  ON public.repack_orders FOR ALL TO authenticated
  USING (
    public.is_warehouse_manager(auth.uid())
    AND company_id = public.current_company_id()
  )
  WITH CHECK (
    public.is_warehouse_manager(auth.uid())
    AND company_id = public.current_company_id()
  );

-- repack_order_items RLS: access via parent repack_order
CREATE POLICY "Company users can view repack order items"
  ON public.repack_order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.repack_orders ro
      WHERE ro.id = repack_order_items.repack_order_id
        AND ro.company_id = public.current_company_id()
    )
  );

CREATE POLICY "Company admins can manage repack order items"
  ON public.repack_order_items FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.repack_orders ro
      WHERE ro.id = repack_order_items.repack_order_id
        AND ro.company_id = public.current_company_id()
    )
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.repack_orders ro
      WHERE ro.id = repack_order_items.repack_order_id
        AND ro.company_id = public.current_company_id()
    )
  );

CREATE POLICY "Warehouse managers can manage repack order items"
  ON public.repack_order_items FOR ALL TO authenticated
  USING (
    public.is_warehouse_manager(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.repack_orders ro
      WHERE ro.id = repack_order_items.repack_order_id
        AND ro.company_id = public.current_company_id()
    )
  )
  WITH CHECK (
    public.is_warehouse_manager(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.repack_orders ro
      WHERE ro.id = repack_order_items.repack_order_id
        AND ro.company_id = public.current_company_id()
    )
  );

COMMENT ON TABLE public.repack_orders IS 'Repack order header: package breakdown transaction';
COMMENT ON TABLE public.repack_order_items IS 'Repack order line items: input consumed, output produced';
