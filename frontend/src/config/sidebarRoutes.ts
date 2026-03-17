/**
 * Route mappings for sidebar menu items
 * This file maps menu item IDs to their corresponding routes
 * Used for validation and route checking
 */

export const sidebarRoutes: Record<string, string> = {
  // Dashboard
  dashboard: '/admin',

  // Stock/Inventory
  products: '/inventory/products',
  categories: '/inventory/categories',
  warehouses: '/inventory/warehouses',
  'stock-adjustment': '/inventory/adjust',
  'stock-transfer': '/inventory/transfer',
  'packaging-recipes': '/inventory/packaging-recipes',
  'repack-orders': '/inventory/repack-orders',
  'stock-ledger': '/inventory/movements',
  'stock-balance': '/inventory/balance',
  'warehouse-stock-balance': '/inventory/warehouse-balance',

  // Sales
  customers: '/admin/customers',
  leads: '/admin/leads',
  quotations: '/admin/quotations',
  orders: '/sales/orders',
  'order-invoices': '/admin/invoices',
  payments: '/sales/payments',
  'credit-management': '/sales/credit-management',
  'sales-targets': '/admin/sales-targets',
  'sales-persons': '/admin/sales-persons',
  pos: '/admin/pos',
  'sales-summary': '/admin/sales/reports/summary',
  'invoice-register': '/admin/sales/reports/invoice-register',
  'outstanding-receivables': '/admin/sales/reports/receivables',
  'sales-by-person': '/admin/sales/reports/by-person',
  'sales-analysis': '/admin/sales/analysis',

  // Procurement
  suppliers: '/admin/suppliers',
  'purchase-orders': '/admin/purchase-orders',
  'goods-receipts': '/admin/goods-receipts',
  'purchase-invoices': '/admin/purchase-invoices',
  'supplier-payments': '/admin/supplier-payments',
  'purchase-summary': '/admin/procurement/reports/summary',
  'grn-pending': '/admin/procurement/reports/grn-pending',
  'supplier-outstanding': '/admin/procurement/reports/supplier-outstanding',

  // Reports — Sales
  'reports-sales':              '/reports/sales',
  'report-sales-dashboard':     '/reports/sales',
  'report-order-summary':       '/reports/sales/order-summary',
  'report-salesperson':         '/reports/sales/salesperson-performance',
  'report-customer-wise':       '/reports/sales/customer-wise',
  'report-product-wise':        '/reports/sales/product-wise',
  'report-target-vs-achievement': '/reports/sales/target-vs-achievement',

  // Reports — Inventory
  'reports-inventory':          '/reports/inventory',
  'report-inventory-dashboard': '/reports/inventory',
  'report-stock-ledger':        '/reports/inventory/stock-ledger',
  'report-current-stock':       '/reports/inventory/current-stock',
  'report-repack-summary':      '/reports/inventory/repack-summary',
  'report-wastage':             '/reports/inventory/wastage',

  // Reports — Procurement
  'reports-procurement':        '/reports/procurement',
  'report-procurement-dashboard': '/reports/procurement',
  'report-invoice-register':    '/reports/procurement/invoice-register',
  'report-grn':                 '/reports/procurement/grn-report',
  'report-vendor-wise':         '/reports/procurement/vendor-wise',
  'report-supplier-payments':   '/reports/procurement/payment-register',

  // Reports — Accounting
  'reports-accounting':         '/reports/accounting',
  'report-accounting-dashboard': '/reports/accounting',
  'report-revenue-expense':     '/reports/accounting/revenue-expense',
  'report-payment-collections': '/reports/accounting/payment-collections',
  'report-tax-collection':      '/reports/accounting/tax-collection',
  'report-cash-flow':           '/reports/accounting/cash-flow',

  // Reports — Master & Audit
  'reports-master':             '/reports/master',
  'report-master-dashboard':    '/reports/master',
  'report-product-master':      '/reports/master/products',
  'report-customer-master':     '/reports/master/customers',
  'report-supplier-master':     '/reports/master/suppliers',
  'report-user-master':         '/reports/master/users',
  'report-activity-log':        '/reports/master/activity',

  // Settings
  'company-profile': '/admin/settings/company',
  'users-roles': '/admin/settings/users-roles',
  taxes: '/admin/taxes',
  'payment-modes': '/admin/settings/payment-modes',
  'number-series': '/admin/settings/number-series',
  'audit-logs': '/admin/settings/audit-logs'
};

/**
 * Validates if a route exists in the application
 * This can be used to check if routes are properly configured
 */
export function isValidRoute(route: string): boolean {
  return Object.values(sidebarRoutes).includes(route);
}

/**
 * Gets the route for a menu item ID
 */
export function getRouteForMenuItem(menuItemId: string): string | undefined {
  return sidebarRoutes[menuItemId];
}
