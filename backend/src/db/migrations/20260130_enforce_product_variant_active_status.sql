-- Migration: Enforce product-level control over variant activation
-- Rule: If product.is_active = false, all variants must be inactive
-- Rule: Variants can only be set to active if product.is_active = true

-- Step 1: Create function to sync variant active status when product is deactivated
CREATE OR REPLACE FUNCTION public.sync_variant_active_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If product is being deactivated, deactivate all variants
  IF NEW.is_active = false AND (OLD.is_active IS NULL OR OLD.is_active = true) THEN
    UPDATE public.product_variants
    SET is_active = false
    WHERE product_id = NEW.id
      AND company_id = NEW.company_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create trigger to sync variants when product active status changes
DROP TRIGGER IF EXISTS trigger_sync_variant_active_status ON public.products;
CREATE TRIGGER trigger_sync_variant_active_status
  AFTER UPDATE OF is_active ON public.products
  FOR EACH ROW
  WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active)
  EXECUTE FUNCTION public.sync_variant_active_status();

-- Step 3: Create function to prevent activating variants when product is inactive
CREATE OR REPLACE FUNCTION public.prevent_variant_activation_if_product_inactive()
RETURNS TRIGGER AS $$
DECLARE
  product_active_status BOOLEAN;
BEGIN
  -- If trying to set variant to active, check if product is active
  IF NEW.is_active = true THEN
    SELECT is_active INTO product_active_status
    FROM public.products
    WHERE id = NEW.product_id
      AND company_id = NEW.company_id;
    
    -- If product is not active, prevent variant activation
    IF product_active_status = false OR product_active_status IS NULL THEN
      RAISE EXCEPTION 'Cannot activate variant: product is inactive. Activate the product first.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger to prevent variant activation when product is inactive
DROP TRIGGER IF EXISTS trigger_prevent_variant_activation_if_product_inactive ON public.product_variants;
CREATE TRIGGER trigger_prevent_variant_activation_if_product_inactive
  BEFORE INSERT OR UPDATE OF is_active ON public.product_variants
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION public.prevent_variant_activation_if_product_inactive();

-- Step 5: Update comments
COMMENT ON COLUMN public.products.is_active IS 'Product-level activation control. If false, all variants are automatically inactive. Variants can only be active if product is active.';
COMMENT ON COLUMN public.product_variants.is_active IS 'Variant activation status. Can only be true if parent product.is_active is true. Automatically set to false when product is deactivated.';

