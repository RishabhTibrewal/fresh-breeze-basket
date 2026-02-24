/**
 * Route mappings for sidebar menu items
 * This file maps menu item IDs to their corresponding routes
 * Used for validation and route checking
 */

export const sidebarRoutes: Record<string, string> = {
  // Dashboard
  dashboard: '/admin',

  // Stock/Inventory
  products: '/admin/products',
  categories: '/admin/categories',
  warehouses: '/admin/warehouses',
  'stock-adjustment': '/admin/inventory/adjust',
  'stock-transfer': '/admin/inventory/transfer',
  'stock-ledger': '/admin/inventory/movements',
  'stock-balance': '/admin/inventory/balance',
  'warehouse-stock-balance': '/admin/inventory/warehouse-balance',

  // Sales
  customers: '/admin/customers',
  leads: '/admin/leads',
  quotations: '/admin/quotations',
  orders: '/admin/orders',
  'order-invoices': '/admin/invoices',
  payments: '/admin/payments',
  'credit-management': '/admin/credit-management',
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

  // Reports
  'profit-loss': '/admin/reports/profit-loss',
  'inventory-valuation': '/admin/reports/inventory-valuation',
  'tax-gst-reports': '/admin/reports/tax-gst',
  'aging-reports': '/admin/reports/aging',
  'custom-reports': '/admin/reports/custom',

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
