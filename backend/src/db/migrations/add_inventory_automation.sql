-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Add inventory_updated column to orders table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'orders'
        AND column_name = 'inventory_updated'
    ) THEN
        ALTER TABLE public.orders
        ADD COLUMN inventory_updated BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Create a function to safely decrement inventory
CREATE OR REPLACE FUNCTION public.decrement_quantity(item_id UUID, amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  current_quantity INTEGER;
BEGIN
  -- Get current quantity with a lock to prevent race conditions
  SELECT quantity INTO current_quantity
  FROM inventory
  WHERE product_id = item_id
  FOR UPDATE;
  
  -- Calculate new quantity, ensuring it doesn't go below zero
  current_quantity := GREATEST(0, current_quantity - amount);
  
  -- Update and return the new quantity
  UPDATE inventory
  SET quantity = current_quantity
  WHERE product_id = item_id;
  
  RETURN current_quantity;
END;
$$;

-- Create a function that will be called when a new order is placed
CREATE OR REPLACE FUNCTION public.schedule_inventory_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only schedule if not already marked as updated
  IF NEW.inventory_updated = false AND (NEW.status = 'confirmed' OR NEW.status = 'processing') THEN
    -- Schedule an inventory update 5 minutes after the order using direct HTTP call to edge function
    PERFORM extensions.cron.schedule(
      'update-inventory-for-order-' || NEW.id,
      NOW() + INTERVAL '5 minutes',
      format('SELECT extensions.http_post(''https://%s.functions.supabase.co/update-inventory'', 
             ''{"order_id": "%s"}'', 
             ''{"Content-Type": "application/json", "Authorization": "Bearer %s"}'')',
             current_setting('supabase_functions.project_ref'),
             NEW.id,
             current_setting('supabase.anon_key')
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger on your orders table
DROP TRIGGER IF EXISTS schedule_inventory_update_trigger ON public.orders;
CREATE TRIGGER schedule_inventory_update_trigger
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.schedule_inventory_update(); 