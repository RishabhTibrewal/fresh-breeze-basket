-- Create warehouse_inventory table for multi-warehouse stock management
-- This replaces the single stock_count in products table

-- Rename existing inventory table (backup)
ALTER TABLE public.inventory RENAME TO inventory_old;

-- Create new warehouse_inventory table
CREATE TABLE IF NOT EXISTS public.warehouse_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    stock_count INTEGER DEFAULT 0,
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(warehouse_id, product_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_warehouse ON public.warehouse_inventory(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_product ON public.warehouse_inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_stock ON public.warehouse_inventory(stock_count);

-- Add RLS policies for warehouse_inventory
ALTER TABLE public.warehouse_inventory ENABLE ROW LEVEL SECURITY;

-- Admin can manage all warehouse inventory
CREATE POLICY "Admin has full access to warehouse inventory"
ON public.warehouse_inventory FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Sales executives can view warehouse inventory
CREATE POLICY "Sales can view warehouse inventory"
ON public.warehouse_inventory FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'sales')
  )
);
