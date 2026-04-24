-- Seed permission codes for the six high-impact POS analytics reports.
-- Admin roles bypass permission checks in the reportPermission middleware,
-- so seeding the permissions themselves is sufficient for those codes to be
-- recognised by the backend. Non-admin roles can be granted access later.

INSERT INTO public.permissions (code, module, action, description) VALUES
  ('sales.hourly_heatmap.view',    'reports_sales', 'view', 'View Hourly Sales Heatmap'),
  ('sales.payment_mix.view',       'reports_sales', 'view', 'View Payment Method Mix Report'),
  ('sales.fulfillment_mix.view',   'reports_sales', 'view', 'View Fulfillment Type Breakdown Report'),
  ('sales.discount_impact.view',   'reports_sales', 'view', 'View Discount Impact Report'),
  ('pos.cashier_performance.view', 'reports_pos',   'view', 'View Cashier / Session Performance Report')
ON CONFLICT (code) DO NOTHING;

-- Grant the new view permissions to the sales role so cashiers/salespeople
-- can see their own POS analytics widgets. Admin role already auto-bypasses.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name = 'sales'
  AND p.code IN (
    'sales.hourly_heatmap.view',
    'sales.payment_mix.view',
    'sales.fulfillment_mix.view',
    'sales.discount_impact.view',
    'pos.cashier_performance.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant the new view permissions to the accounts role for oversight.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name = 'accounts'
  AND p.code IN (
    'sales.hourly_heatmap.view',
    'sales.payment_mix.view',
    'sales.fulfillment_mix.view',
    'sales.discount_impact.view',
    'pos.cashier_performance.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;
