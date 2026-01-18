-- Update RLS policies for order_items to allow sales executives to create order items
-- for orders belonging to their customers

-- Drop the existing policy that only checks user ownership
DROP POLICY IF EXISTS "Users can create their own order items" ON public.order_items;

-- Create a new policy that allows:
-- 1. Users to create order items for their own orders
-- 2. Sales executives to create order items for orders belonging to their customers
-- 3. Admins to create order items for any order
CREATE POLICY "Users can create their own order items"
    ON public.order_items FOR INSERT
    TO authenticated
    WITH CHECK (
        -- User owns the order
        EXISTS (
            SELECT 1 FROM public.orders
            WHERE orders.id = order_items.order_id
            AND orders.user_id = auth.uid()
        )
        OR
        -- Sales executive creating order items for their customer's order
        EXISTS (
            SELECT 1 FROM public.orders
            INNER JOIN public.customers ON customers.user_id = orders.user_id
            WHERE orders.id = order_items.order_id
            AND customers.sales_executive_id = auth.uid()
        )
        OR
        -- Admin can create order items for any order
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Also update the SELECT policy to allow sales executives to view order items for their customers' orders
DROP POLICY IF EXISTS "Users can view their own order items" ON public.order_items;

CREATE POLICY "Users can view their own order items"
    ON public.order_items FOR SELECT
    TO authenticated
    USING (
        -- User owns the order
        EXISTS (
            SELECT 1 FROM public.orders
            WHERE orders.id = order_items.order_id
            AND orders.user_id = auth.uid()
        )
        OR
        -- Sales executive viewing order items for their customer's order
        EXISTS (
            SELECT 1 FROM public.orders
            INNER JOIN public.customers ON customers.user_id = orders.user_id
            WHERE orders.id = order_items.order_id
            AND customers.sales_executive_id = auth.uid()
        )
        OR
        -- Admin can view order items for any order
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );
