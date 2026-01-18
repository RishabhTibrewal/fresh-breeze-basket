-- Update RLS policies for order_items to allow sales executives and admins
-- to create order items for POS orders (orders with null user_id)

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Users can create their own order items" ON public.order_items;

-- Create a new policy that allows:
-- 1. Users to create order items for their own orders
-- 2. Sales executives to create order items for orders belonging to their customers
-- 3. Sales executives and admins to create order items for POS orders (user_id is null)
-- 4. Admins to create order items for any order
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
        -- Sales executive or admin creating order items for POS orders (user_id is null)
        (
            EXISTS (
                SELECT 1 FROM public.orders
                WHERE orders.id = order_items.order_id
                AND orders.user_id IS NULL
            )
            AND EXISTS (
                SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid()
                AND profiles.role IN ('admin', 'sales')
            )
        )
        OR
        -- Admin can create order items for any order
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Also update the SELECT policy to allow sales executives and admins to view order items for POS orders
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
        -- Sales executive or admin viewing order items for POS orders (user_id is null)
        (
            EXISTS (
                SELECT 1 FROM public.orders
                WHERE orders.id = order_items.order_id
                AND orders.user_id IS NULL
            )
            AND EXISTS (
                SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid()
                AND profiles.role IN ('admin', 'sales')
            )
        )
        OR
        -- Admin can view order items for any order
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );
