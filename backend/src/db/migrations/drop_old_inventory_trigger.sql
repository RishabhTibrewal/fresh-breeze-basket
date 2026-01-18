-- Drop the old inventory sync triggers and functions
-- The inventory table was renamed to inventory_old and replaced with warehouse_inventory
-- These triggers are no longer needed and cause errors when products/orders are updated
-- Stock management is now handled through warehouse_inventory table

-- Drop product sync trigger and function
DROP TRIGGER IF EXISTS sync_inventory_with_product_trigger ON public.products;
DROP FUNCTION IF EXISTS public.sync_inventory_with_product();

-- Drop order inventory update trigger and function
DROP TRIGGER IF EXISTS update_inventory_on_order_item ON public.order_items;
DROP FUNCTION IF EXISTS public.update_inventory_on_order();

-- Drop inventory updated_at trigger (table no longer exists)
DROP TRIGGER IF EXISTS update_inventory_updated_at ON public.inventory;
