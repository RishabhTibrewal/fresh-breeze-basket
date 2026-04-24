-- Seed permission codes for the six medium-effort POS analytics reports (Batch B).
-- Admin roles bypass permission checks in reportPermission middleware, so
-- seeding the permissions is sufficient for admin. Non-admin roles are granted
-- selectively below.

INSERT INTO public.permissions (code, module, action, description) VALUES
  ('sales.category_brand.view',      'reports_sales', 'view', 'View Category-wise & Brand-wise Sales Report'),
  ('sales.basket_metrics.view',      'reports_sales', 'view', 'View Average Basket Metrics Report'),
  ('sales.modifier_revenue.view',    'reports_sales', 'view', 'View Modifier / Add-on Revenue Report'),
  ('sales.trend_comparison.view',    'reports_sales', 'view', 'View Hourly & Weekday Trend Comparison Report'),
  ('sales.movers.view',              'reports_sales', 'view', 'View Top / Bottom Movers Report'),
  ('sales.outlet_leaderboard.view',  'reports_sales', 'view', 'View Outlet Comparison Leaderboard (admin/accounts)')
ON CONFLICT (code) DO NOTHING;

-- Sales role: everything except the outlet leaderboard (admin-only insight).
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name = 'sales'
  AND p.code IN (
    'sales.category_brand.view',
    'sales.basket_metrics.view',
    'sales.modifier_revenue.view',
    'sales.trend_comparison.view',
    'sales.movers.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Accounts role: full visibility including outlet leaderboard.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name = 'accounts'
  AND p.code IN (
    'sales.category_brand.view',
    'sales.basket_metrics.view',
    'sales.modifier_revenue.view',
    'sales.trend_comparison.view',
    'sales.movers.view',
    'sales.outlet_leaderboard.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;
