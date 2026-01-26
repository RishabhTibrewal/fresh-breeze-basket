-- Update RLS policies to use new multi-role helper functions
-- The functions is_admin(), is_sales(), and is_admin_or_sales() have already been updated
-- in 20260124_update_role_functions.sql to use the new user_roles table.
-- Existing RLS policies that use these functions will automatically benefit from the new system.

-- Grant execute permissions on new role functions to authenticated users
-- (These functions are created in 20260124_update_role_functions.sql)
GRANT EXECUTE ON FUNCTION public.has_role(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(UUID, TEXT[], UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_all_roles(UUID, TEXT[], UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_roles(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_sales(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_sales(UUID) TO authenticated;

-- Note: Existing RLS policies that use is_admin(), is_sales(), or is_admin_or_sales() 
-- will automatically work with the new multi-role system because these functions
-- have been updated to use the user_roles table and include admin override logic.

-- Optional: Update policies to add accounts role support where needed
-- Example for invoices table (uncomment if you have an invoices table):
-- DROP POLICY IF EXISTS "Invoices are viewable by admins and accounts" ON public.invoices;
-- CREATE POLICY "Invoices are viewable by admins and accounts"
--     ON public.invoices FOR SELECT
--     TO authenticated
--     USING (public.has_any_role(auth.uid(), ARRAY['admin', 'accounts'], public.current_company_id()));

-- Example for supplier_payments (uncomment if needed):
-- DROP POLICY IF EXISTS "Supplier payments are viewable by admins and accounts" ON procurement.supplier_payments;
-- CREATE POLICY "Supplier payments are viewable by admins and accounts"
--     ON procurement.supplier_payments FOR SELECT
--     TO authenticated
--     USING (public.has_any_role(auth.uid(), ARRAY['admin', 'accounts'], public.current_company_id()));

-- Summary:
-- - All existing RLS policies continue to work with updated functions
-- - New functions (has_role, has_any_role, has_all_roles) are available for use
-- - To add accounts role to policies, use: public.has_any_role(auth.uid(), ARRAY['admin', 'accounts'], public.current_company_id())

