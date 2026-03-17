-- Seed report-module permission codes into the existing public.permissions table.
-- Uses ON CONFLICT (code) DO NOTHING so this migration is idempotent.

INSERT INTO public.permissions (code, module, action, description) VALUES
  -- Sales Reports
  ('sales.order_summary.view',         'reports_sales',       'view',   'View Sales Order Summary'),
  ('sales.salesperson.view',           'reports_sales',       'view',   'View Salesperson Performance'),
  ('sales.customer_wise.view',         'reports_sales',       'view',   'View Customer-wise Sales'),
  ('sales.product_wise.view',          'reports_sales',       'view',   'View Product-wise Sales'),
  ('sales.quotation_conversion.view',  'reports_sales',       'view',   'View Quotation Conversion Report'),
  ('sales.pending_deliveries.view',    'reports_sales',       'view',   'View Pending Deliveries Report'),
  ('sales.returns.view',               'reports_sales',       'view',   'View Sales Returns Report'),
  ('sales.target_vs_achievement.view', 'reports_sales',       'view',   'View Target vs Achievement Report'),
  ('sales.price_variance.view',        'reports_sales',       'view',   'View Price Variance Report'),
  ('sales.region_territory.view',      'reports_sales',       'view',   'View Region/Territory Report'),
  ('sales.export',                     'reports_sales',       'export', 'Export Sales Reports'),

  -- Inventory Reports
  ('inventory.stock_ledger.view',      'reports_inventory',   'view',   'View Stock Ledger'),
  ('inventory.current_stock.view',     'reports_inventory',   'view',   'View Current Stock Position'),
  ('inventory.valuation.view',         'reports_inventory',   'view',   'View Stock Valuation'),
  ('inventory.ageing.view',            'reports_inventory',   'view',   'View Ageing/Dead Stock'),
  ('inventory.reorder.view',           'reports_inventory',   'view',   'View Reorder Levels'),
  ('inventory.repack_summary.view',    'reports_inventory',   'view',   'View Repack/Job Work Summary'),
  ('inventory.wastage.view',           'reports_inventory',   'view',   'View Wastage Report'),
  ('inventory.export',                 'reports_inventory',   'export', 'Export Inventory Reports'),

  -- Procurement Reports
  ('procurement.po_register.view',     'reports_procurement', 'view',   'View PO Register'),
  ('procurement.vendor_wise.view',     'reports_procurement', 'view',   'View Vendor-wise Purchase'),
  ('procurement.grn.view',             'reports_procurement', 'view',   'View GRN Report'),
  ('procurement.pending_receipts.view','reports_procurement', 'view',   'View Pending Receipts'),
  ('procurement.rate_comparison.view', 'reports_procurement', 'view',   'View Rate Comparison'),
  ('procurement.invoice_ageing.view',  'reports_procurement', 'view',   'View Invoice Ageing'),
  ('procurement.export',               'reports_procurement', 'export', 'Export Procurement Reports'),

  -- Accounting Reports
  ('accounting.trial_balance.view',    'reports_accounting',  'view',   'View Trial Balance'),
  ('accounting.pl.view',               'reports_accounting',  'view',   'View P&L Statement'),
  ('accounting.balance_sheet.view',    'reports_accounting',  'view',   'View Balance Sheet'),
  ('accounting.ar_ageing.view',        'reports_accounting',  'view',   'View AR Ageing'),
  ('accounting.ap_ageing.view',        'reports_accounting',  'view',   'View AP Ageing'),
  ('accounting.export',                'reports_accounting',  'export', 'Export Accounting Reports'),

  -- POS Reports
  ('pos.daily_summary.view',           'reports_pos',         'view',   'View POS Daily Summary'),
  ('pos.cashier.view',                 'reports_pos',         'view',   'View Cashier/Shift Report'),
  ('pos.export',                       'reports_pos',         'export', 'Export POS Reports'),

  -- Master Reports
  ('master.customers.view',            'reports_master',      'view',   'View Customer Master'),
  ('master.vendors.view',              'reports_master',      'view',   'View Vendor Master'),
  ('master.items.view',                'reports_master',      'view',   'View Item Master'),
  ('master.audit_log.view',            'reports_master',      'view',   'View Audit Log'),
  ('master.export',                    'reports_master',      'export', 'Export Master Reports')
ON CONFLICT (code) DO NOTHING;
