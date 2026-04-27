-- POS Menu Management Tables
-- Creates pos_menus, pos_menu_outlets, pos_menu_items with RLS

-- 1. Menu catalogue
CREATE TABLE IF NOT EXISTS public.pos_menus (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_menus_company ON public.pos_menus (company_id);

-- 2. Menu to Outlet/Warehouse binding (one active menu per outlet per company)
CREATE TABLE IF NOT EXISTS public.pos_menu_outlets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  menu_id      UUID NOT NULL REFERENCES public.pos_menus(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, warehouse_id)
);

CREATE INDEX IF NOT EXISTS idx_pos_menu_outlets_menu ON public.pos_menu_outlets (menu_id);
CREATE INDEX IF NOT EXISTS idx_pos_menu_outlets_warehouse ON public.pos_menu_outlets (warehouse_id);

-- 3. Per-menu product/variant settings
CREATE TABLE IF NOT EXISTS public.pos_menu_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  menu_id     UUID NOT NULL REFERENCES public.pos_menus(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id  UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  is_visible  BOOLEAN NOT NULL DEFAULT TRUE,
  pos_price   NUMERIC(12,2),   -- NULL = use default sale price
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (menu_id, variant_id)
);

CREATE INDEX IF NOT EXISTS idx_pos_menu_items_menu ON public.pos_menu_items (menu_id);
CREATE INDEX IF NOT EXISTS idx_pos_menu_items_variant ON public.pos_menu_items (variant_id);

-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pos_menus_updated_at
  BEFORE UPDATE ON public.pos_menus
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_pos_menu_items_updated_at
  BEFORE UPDATE ON public.pos_menu_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Row-Level Security
ALTER TABLE public.pos_menus        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_menu_outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_menu_items   ENABLE ROW LEVEL SECURITY;

CREATE POLICY pos_menus_select ON public.pos_menus
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM public.company_memberships
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY pos_menus_insert ON public.pos_menus
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_memberships
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY pos_menus_update ON public.pos_menus
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM public.company_memberships
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY pos_menus_delete ON public.pos_menus
  FOR DELETE USING (
    company_id IN (
      SELECT company_id FROM public.company_memberships
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY pos_menu_outlets_select ON public.pos_menu_outlets
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM public.company_memberships
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY pos_menu_outlets_insert ON public.pos_menu_outlets
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_memberships
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY pos_menu_outlets_update ON public.pos_menu_outlets
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM public.company_memberships
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY pos_menu_outlets_delete ON public.pos_menu_outlets
  FOR DELETE USING (
    company_id IN (
      SELECT company_id FROM public.company_memberships
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY pos_menu_items_select ON public.pos_menu_items
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM public.company_memberships
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY pos_menu_items_insert ON public.pos_menu_items
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_memberships
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY pos_menu_items_update ON public.pos_menu_items
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM public.company_memberships
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY pos_menu_items_delete ON public.pos_menu_items
  FOR DELETE USING (
    company_id IN (
      SELECT company_id FROM public.company_memberships
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );
