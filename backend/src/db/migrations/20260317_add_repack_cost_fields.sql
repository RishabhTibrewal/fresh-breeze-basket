-- Migration: Add cost & wastage columns to repack_order_items and packaging_recipes
-- Required for the full pricing formula (usable qty → unit cost → weighted-average price update)

-- repack_order_items: track per-item wastage and computed cost
ALTER TABLE public.repack_order_items
  ADD COLUMN IF NOT EXISTS wastage_quantity          NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_cost                 NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS additional_cost_per_unit  NUMERIC NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.repack_order_items.wastage_quantity IS
  'Declared wastage in same unit as input variant (e.g. kg). actual_wastage may differ after floor division.';
COMMENT ON COLUMN public.repack_order_items.unit_cost IS
  'Computed: (input_qty × input_price) / output_qty + additional_cost_per_unit';
COMMENT ON COLUMN public.repack_order_items.additional_cost_per_unit IS
  'Extra processing cost per output unit (labour, packing material, etc.)';

-- packaging_recipes: track expected wastage and additional cost per template
ALTER TABLE public.packaging_recipes
  ADD COLUMN IF NOT EXISTS wastage_per_input         NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS additional_cost_per_unit  NUMERIC NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.packaging_recipes.wastage_per_input IS
  'Expected wastage per input unit (same unit as input variant). Used to pre-fill the repack form.';
COMMENT ON COLUMN public.packaging_recipes.additional_cost_per_unit IS
  'Default additional cost per output unit for this recipe.';
