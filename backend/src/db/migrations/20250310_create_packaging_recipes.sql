-- Migration: Create packaging_recipes table for repack conversions
-- Defines bulk-to-retail conversion relationships: conversion_ratio = input qty (in input variant unit) per 1 output unit

CREATE TABLE IF NOT EXISTS public.packaging_recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  input_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  input_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  output_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  output_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  conversion_ratio DECIMAL(12,6) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(input_variant_id, output_variant_id)
);

CREATE INDEX IF NOT EXISTS idx_packaging_recipes_company ON public.packaging_recipes(company_id);
CREATE INDEX IF NOT EXISTS idx_packaging_recipes_input_variant ON public.packaging_recipes(input_variant_id);
CREATE INDEX IF NOT EXISTS idx_packaging_recipes_output_variant ON public.packaging_recipes(output_variant_id);

ALTER TABLE public.packaging_recipes ENABLE ROW LEVEL SECURITY;

-- Company users can view recipes for their company
CREATE POLICY "Company users can view packaging recipes"
  ON public.packaging_recipes FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

-- Admins can manage recipes
CREATE POLICY "Company admins can manage packaging recipes"
  ON public.packaging_recipes FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid())
    AND company_id = public.current_company_id()
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    AND company_id = public.current_company_id()
  );

-- Warehouse managers can manage recipes (inventory operations)
CREATE POLICY "Warehouse managers can manage packaging recipes"
  ON public.packaging_recipes FOR ALL TO authenticated
  USING (
    public.is_warehouse_manager(auth.uid())
    AND company_id = public.current_company_id()
  )
  WITH CHECK (
    public.is_warehouse_manager(auth.uid())
    AND company_id = public.current_company_id()
  );

COMMENT ON TABLE public.packaging_recipes IS 'Defines bulk-to-retail conversion: conversion_ratio = input quantity per 1 output unit';
