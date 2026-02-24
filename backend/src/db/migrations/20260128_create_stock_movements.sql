-- Migration: Create stock_movements table
-- Audit trail for all inventory movements
-- Tracks SALE, RETURN, ADJUSTMENT, TRANSFER movements

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id),
  variant_id UUID REFERENCES public.product_variants(id),
  outlet_id UUID NOT NULL REFERENCES public.warehouses(id),
  movement_type VARCHAR(50) NOT NULL, -- SALE, RETURN, ADJUSTMENT, TRANSFER, RECEIPT
  quantity INTEGER NOT NULL, -- positive for increase, negative for decrease
  reference_type VARCHAR(50), -- order, adjustment, transfer, goods_receipt, etc.
  reference_id UUID, -- ID of the related record (order_id, adjustment_id, etc.)
  notes TEXT,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES auth.users(id) -- User who created the movement
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_variant ON public.stock_movements(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_movements_outlet ON public.stock_movements(outlet_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON public.stock_movements(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_company_id ON public.stock_movements(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_movement_type ON public.stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON public.stock_movements(created_at);

-- Add RLS policies (will be configured based on company isolation)
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Add constraint for valid movement types
ALTER TABLE public.stock_movements
ADD CONSTRAINT valid_movement_type 
CHECK (movement_type IN ('SALE', 'RETURN', 'ADJUSTMENT', 'TRANSFER', 'RECEIPT'));

-- Add constraint to ensure quantity is not zero
ALTER TABLE public.stock_movements
ADD CONSTRAINT check_non_zero_quantity 
CHECK (quantity != 0);

-- Add comments for documentation
COMMENT ON TABLE public.stock_movements IS 'Audit trail for all inventory movements - retail baseline logic';
COMMENT ON COLUMN public.stock_movements.movement_type IS 'Type of movement: SALE (reduces stock), RETURN (increases stock), ADJUSTMENT, TRANSFER, RECEIPT';
COMMENT ON COLUMN public.stock_movements.quantity IS 'Quantity change: positive for increase, negative for decrease';
COMMENT ON COLUMN public.stock_movements.reference_type IS 'Type of reference: order, adjustment, transfer, goods_receipt, etc.';
COMMENT ON COLUMN public.stock_movements.reference_id IS 'ID of the related record (order_id, adjustment_id, etc.)';

