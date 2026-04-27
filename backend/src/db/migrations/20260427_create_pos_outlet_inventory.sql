-- POS Outlet Inventory Pool
-- Separate inventory pool per POS outlet/warehouse.
-- Stock is transferred FROM warehouse_inventory INTO this table via pos-transfer flow.
-- POS sales deduct from this pool (falls back to warehouse_inventory if no pool row exists).

-- 1. New table: pos_outlet_inventory
CREATE TABLE IF NOT EXISTS public.pos_outlet_inventory (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id   UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  qty          NUMERIC(12,4) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, warehouse_id, variant_id)
);

CREATE INDEX IF NOT EXISTS idx_pos_outlet_inventory_company    ON public.pos_outlet_inventory (company_id);
CREATE INDEX IF NOT EXISTS idx_pos_outlet_inventory_warehouse  ON public.pos_outlet_inventory (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_pos_outlet_inventory_variant    ON public.pos_outlet_inventory (variant_id);

-- updated_at trigger (reuses set_updated_at created in pos_menu migration)
CREATE TRIGGER trg_pos_outlet_inventory_updated_at
  BEFORE UPDATE ON public.pos_outlet_inventory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. RLS — same company_memberships pattern used by pos_menu_items
ALTER TABLE public.pos_outlet_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY pos_outlet_inventory_select ON public.pos_outlet_inventory
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM public.company_memberships
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY pos_outlet_inventory_insert ON public.pos_outlet_inventory
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_memberships
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY pos_outlet_inventory_update ON public.pos_outlet_inventory
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM public.company_memberships
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY pos_outlet_inventory_delete ON public.pos_outlet_inventory
  FOR DELETE USING (
    company_id IN (
      SELECT company_id FROM public.company_memberships
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

-- 3. Extend stock_movements.movement_type CHECK to include new POS movement types
-- Drop the existing CHECK constraint (name may differ), then recreate it.
DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  SELECT conname INTO v_constraint
  FROM pg_constraint
  WHERE conrelid = 'public.stock_movements'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%movement_type%'
  LIMIT 1;

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.stock_movements DROP CONSTRAINT %I', v_constraint);
  END IF;
END $$;

ALTER TABLE public.stock_movements
  ADD CONSTRAINT valid_movement_type CHECK (
    movement_type IN (
      'SALE', 'RETURN', 'PURCHASE', 'ADJUSTMENT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT',
      'TRANSFER', 'RECEIPT', 'REPACK_OUT', 'REPACK_IN',
      'POS_TRANSFER_IN', 'POS_SALE'
    )
  );

-- 4. Extend stock_movements.source_type CHECK to include 'pos_transfer'
DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  SELECT conname INTO v_constraint
  FROM pg_constraint
  WHERE conrelid = 'public.stock_movements'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%source_type%'
  LIMIT 1;

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.stock_movements DROP CONSTRAINT %I', v_constraint);
  END IF;
END $$;

ALTER TABLE public.stock_movements
  ADD CONSTRAINT valid_source_type CHECK (
    source_type IN (
      'sales', 'purchase', 'return', 'transfer', 'adjustment', 'receipt', 'repack', 'pos_transfer'
    )
  );
