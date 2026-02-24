-- Migration: Verify / document that existing RLS policies on orders remain valid
-- NOTE: Current RLS in 20260118_rls_company_isolation.sql already enforces:
--   - company_id scoping
--   - role-based access (admin / sales)
-- This migration is intentionally a no-op to keep schema history aligned with
-- the introduction of explicit order_type, order_source, and fulfillment_type.

DO $$
BEGIN
  RAISE NOTICE 'RLS for public.orders already enforced via 20260118_rls_company_isolation.sql. No changes applied in 20260202_update_orders_rls.sql.';
END $$;


