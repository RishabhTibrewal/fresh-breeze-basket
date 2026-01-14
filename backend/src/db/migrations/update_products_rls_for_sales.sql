-- Migration to update RLS policy on products table
-- Allow sales executives to update products (specifically stock_count) when updating order status
-- This is needed for inventory updates when sales executives process orders

-- Drop the existing policy
DROP POLICY IF EXISTS "Products are editable by admins only" ON public.products;

-- Create new policy that allows both admins and sales executives to update products
CREATE POLICY "Products are editable by admins and sales executives"
    ON public.products FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'sales')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'sales')
        )
    );

-- Also update the INSERT policy if it exists (for consistency)
DROP POLICY IF EXISTS "Products are insertable by admins only" ON public.products;

CREATE POLICY "Products are insertable by admins and sales executives"
    ON public.products FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'sales')
        )
    );

-- Also update the DELETE policy if it exists (for consistency)
DROP POLICY IF EXISTS "Products are deletable by admins only" ON public.products;

CREATE POLICY "Products are deletable by admins only"
    ON public.products FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );
