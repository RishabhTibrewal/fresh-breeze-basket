-- Migration to allow negative stock_count in products
-- This is needed for sales dashboard orders where stock can go negative
-- 
-- NOTE: The inventory table exists but is not actively used for stock operations.
-- All stock operations use products.stock_count directly. The inventory table
-- has a trigger that syncs from products.stock_count, but the constraint was
-- blocking negative values. We'll remove the constraint to allow the sync to work.

-- Drop the constraint on inventory table that prevents negative values
-- This allows the trigger to sync negative stock_count values from products table
ALTER TABLE public.inventory 
DROP CONSTRAINT IF EXISTS positive_quantity;

-- Modify the sync_inventory_with_product function to allow negative values
-- This trigger automatically syncs products.stock_count to inventory.quantity
CREATE OR REPLACE FUNCTION public.sync_inventory_with_product()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if inventory record exists for this product
    IF NOT EXISTS (SELECT 1 FROM public.inventory WHERE product_id = NEW.id) THEN
        -- Create new inventory record if it doesn't exist
        -- Allow negative values for sales orders
        INSERT INTO public.inventory (product_id, quantity, low_stock_threshold)
        VALUES (NEW.id, NEW.stock_count, 10);
    ELSE
        -- Update existing inventory record
        -- Allow negative values for sales orders
        UPDATE public.inventory
        SET quantity = NEW.stock_count
        WHERE product_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';
