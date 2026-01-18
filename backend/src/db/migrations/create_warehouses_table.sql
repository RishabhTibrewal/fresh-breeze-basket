-- Create warehouses table for multi-warehouse inventory management
CREATE TABLE IF NOT EXISTS public.warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    contact_name VARCHAR(255),
    contact_phone VARCHAR(50),
    contact_email VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create default warehouse
INSERT INTO public.warehouses (name, code, is_active)
VALUES ('Main Warehouse', 'WH-001', true)
ON CONFLICT (code) DO NOTHING;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_warehouses_code ON public.warehouses(code);
CREATE INDEX IF NOT EXISTS idx_warehouses_active ON public.warehouses(is_active);

-- Add RLS policies for warehouses
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

-- Admin can manage all warehouses
CREATE POLICY "Admin has full access to warehouses"
ON public.warehouses FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Sales executives can view active warehouses
CREATE POLICY "Sales can view active warehouses"
ON public.warehouses FOR SELECT TO authenticated
USING (
  is_active = true AND (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'sales')
    )
  )
);
