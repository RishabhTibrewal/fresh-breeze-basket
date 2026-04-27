import { LucideIcon } from 'lucide-react';
import {
  ShoppingBag,
  ShoppingCart,
  Package,
  FileText,
  DollarSign,
  BarChart3,
  Store,
  Settings,
  Users,
  Warehouse,
  Receipt,
  ReceiptText,
  Target,
  TrendingUp,
  Grid,
  ClipboardCheck,
  ArrowLeftRight,
  Building2,
  CreditCard,
  LayoutDashboard,
  UserCheck,
  Tag,
  FileCheck,
  Wallet,
  Hash,
  UserCog,
  Percent,
  Plus,
  LayoutList,
  ListChecks,
  Activity,
  Truck,
  BookOpen,
  LineChart,
  Layers,
  Clock,
  RotateCcw,
  PlusSquare,
  CalendarClock,
  Trophy,
  Boxes,
  ListOrdered,
  Monitor
} from 'lucide-react';

export interface ModuleKPI {
  label: string;
  key: string;
  formatter?: (value: number | null) => string;
}

export interface ModuleCTA {
  label: string;
  route: string;
  permission?: string;
  variant?: 'primary' | 'secondary';
}

export interface SidebarItem {
  label: string;
  route: string;
  icon: LucideIcon;
  permission?: string;
  roles?: string[];
  badge?: string;
  children?: SidebarItem[];
}

export interface ModuleConfig {
  key: string;
  label: string;
  description: string;
  route: string;
  icon: LucideIcon;
  iconColor?: string;
  permissions: string[];
  showOnDashboard: boolean;
  highlighted?: boolean;
  kpis: ModuleKPI[];
  ctas: ModuleCTA[];
  sidebarItems?: SidebarItem[];
}

const SALES_REPORT_SIDEBAR_ITEMS: SidebarItem[] = [
  { label: 'Dashboard', route: '/reports/sales', icon: BarChart3, permission: 'reports.read' },
  { label: 'Order Summary', route: '/reports/sales/order-summary', icon: ShoppingCart, permission: 'reports.read' },
  { label: 'Salesperson Performance', route: '/reports/sales/salesperson-performance', icon: Users, permission: 'reports.read' },
  { label: 'Customer-wise Sales', route: '/reports/sales/customer-wise', icon: Users, permission: 'reports.read' },
  { label: 'Product-wise Sales', route: '/reports/sales/product-wise', icon: Package, permission: 'reports.read' },
  { label: 'Target vs Achievement', route: '/reports/sales/target-vs-achievement', icon: Target, permission: 'reports.read' },
  { label: 'Pending Deliveries', route: '/reports/sales/pending-deliveries', icon: Clock, permission: 'reports.read' },
  { label: 'Sales Returns', route: '/reports/sales/returns', icon: RotateCcw, permission: 'reports.read' },
  { label: 'Hourly Sales Heatmap', route: '/reports/sales/hourly-heatmap', icon: Clock, permission: 'reports.read' },
  { label: 'Payment Method Mix', route: '/reports/sales/payment-mix', icon: CreditCard, permission: 'reports.read' },
  { label: 'Fulfillment Breakdown', route: '/reports/sales/fulfillment-mix', icon: Truck, permission: 'reports.read' },
  { label: 'Discount Impact', route: '/reports/sales/discount-impact', icon: Tag, permission: 'reports.read' },
  { label: 'Cashier Performance', route: '/reports/sales/cashier-performance', icon: UserCheck, permission: 'reports.read' },
  { label: 'Category & Brand Sales', route: '/reports/sales/category-brand', icon: Layers, permission: 'reports.read' },
  { label: 'Average Basket Metrics', route: '/reports/sales/basket-metrics', icon: Boxes, permission: 'reports.read' },
  { label: 'Modifier / Add-on Revenue', route: '/reports/sales/modifier-revenue', icon: PlusSquare, permission: 'reports.read' },
  { label: 'Hourly & Weekday Trend', route: '/reports/sales/trend-comparison', icon: CalendarClock, permission: 'reports.read' },
  { label: 'Top / Bottom Movers', route: '/reports/sales/movers', icon: TrendingUp, permission: 'reports.read' },
  { label: 'Outlet Leaderboard', route: '/reports/sales/outlet-leaderboard', icon: Trophy, permission: 'reports.read', roles: ['admin', 'super_admin'] },
];

export const modulesConfig: Record<string, ModuleConfig> = {
  ecommerce: {
    key: 'ecommerce',
    label: 'E-commerce',
    description: 'Manage online store and orders',
    route: '/ecommerce',
    icon: ShoppingBag,
    iconColor: 'text-purple-600',
    permissions: ['ecommerce.read'],
    showOnDashboard: true,
    kpis: [
      { label: 'Online Orders Today', key: 'orders_today' },
      { label: 'Website Visitors', key: 'visitors' },
      { label: 'Conversion Rate', key: 'conversion_rate', formatter: (v) => `${v}%` }
    ],
    ctas: [
      { label: 'Manage Store', route: '/ecommerce', variant: 'primary' },
      { label: 'View Orders', route: '/ecommerce/orders', variant: 'secondary' }
    ],
    sidebarItems: [
      { label: 'Dashboard', route: '/ecommerce', icon: LayoutDashboard, permission: 'ecommerce.read' },
      { label: 'Products', route: '/ecommerce/products', icon: Package, permission: 'ecommerce.read' },
      { label: 'Orders', route: '/ecommerce/orders', icon: ShoppingCart, permission: 'ecommerce.read' },
      { label: 'Settings', route: '/ecommerce/settings', icon: Settings, permission: 'ecommerce.write' },
      // Sub-module Reports
      {
        label: 'Reports',
        route: '/reports/sales',
        icon: TrendingUp,
        permission: 'reports.read',
        children: [
          { label: 'Sales Dashboard',        route: '/reports/sales',                           icon: BarChart3,     permission: 'reports.read' },
          { label: 'Order Summary',          route: '/reports/sales/order-summary',             icon: ShoppingCart,  permission: 'reports.read' },
          { label: 'Customer-wise Sales',    route: '/reports/sales/customer-wise',            icon: Users,         permission: 'reports.read' },
          { label: 'Product-wise Sales',     route: '/reports/sales/product-wise',             icon: Package,       permission: 'reports.read' },
        ]
      }
    ]
  },
  
  sales: {
    key: 'sales',
    label: 'Sales',
    description: 'Orders, invoices & customers',
    route: '/sales',
    icon: ShoppingCart,
    iconColor: 'text-blue-600',
    permissions: ['sales.read'],
    showOnDashboard: true,
    kpis: [
      { label: 'Today\'s Orders', key: 'orders_today' },
      { label: 'Outstanding Invoices', key: 'outstanding_invoices' },
      { label: 'Monthly Revenue', key: 'monthly_revenue', formatter: (v) => `₹${v?.toLocaleString()}` }
    ],
    ctas: [
      { label: 'Go to Sales', route: '/sales', variant: 'primary' },
      { label: 'Create Order', route: '/sales/orders/create', permission: 'sales.write', variant: 'secondary' }
    ],
    sidebarItems: [
      { label: 'Dashboard', route: '/sales', icon: LayoutDashboard, permission: 'sales.read' },
      { label: 'Orders', route: '/sales/orders', icon: ShoppingCart, permission: 'sales.read' },
      { label: 'Create Order', route: '/sales/orders/create', icon: Plus, permission: 'sales.write' },
      { label: 'Quotations', route: '/sales/quotations', icon: FileText, permission: 'sales.read' },
      { label: 'Order Invoices', route: '/sales/invoices', icon: Receipt, permission: 'sales.read' },
      { label: 'Payments', route: '/sales/payments', icon: CreditCard, permission: 'sales.read' },
      { label: 'Credit Notes', route: '/sales/credit-notes', icon: FileCheck, permission: 'sales.read' },
      { label: 'Create Credit Note', route: '/sales/credit-notes/new', icon: Plus, permission: 'sales.write' },
      { label: 'Customers', route: '/sales/customers', icon: Users, permission: 'sales.read' },
      { label: 'Leads', route: '/sales/leads', icon: UserCheck, permission: 'sales.read' },
      { label: 'Credit Management', route: '/sales/credit-management', icon: CreditCard, permission: 'sales.read' },
      { label: 'Analytics', route: '/sales/analytics', icon: BarChart3, permission: 'sales.read' },
      // Sub-module Reports
      {
        label: 'Reports',
        route: '/reports/sales',
        icon: TrendingUp,
        permission: 'reports.read',
        children: SALES_REPORT_SIDEBAR_ITEMS
      }
    ]
  },
  
  inventory: {
    key: 'inventory',
    label: 'Inventory',
    description: 'Stock management & warehouses',
    route: '/inventory',
    icon: Package,
    iconColor: 'text-green-600',
    permissions: ['inventory.read'],
    showOnDashboard: true,
    kpis: [
      { label: 'Total Products', key: 'total_products' },
      { label: 'Low Stock Items', key: 'low_stock' },
      { label: 'Total Stock Value', key: 'stock_value', formatter: (v) => `₹${v?.toLocaleString()}` }
    ],
    ctas: [
      { label: 'Go to Inventory', route: '/inventory', variant: 'primary' }
    ],
    sidebarItems: [
      { label: 'Dashboard', route: '/inventory', icon: LayoutDashboard, permission: 'inventory.read' },
      { label: 'Products', route: '/inventory/products', icon: Package, permission: 'inventory.read' },
      { label: 'Categories', route: '/inventory/categories', icon: Grid, permission: 'inventory.read' },
      { label: 'Brands', route: '/inventory/brands', icon: Tag, permission: 'inventory.read' },
      { label: 'Collections', route: '/inventory/collections', icon: LayoutList, permission: 'inventory.read' },
      { label: 'Modifiers', route: '/inventory/modifiers', icon: ListChecks, permission: 'inventory.read' },
      { label: 'Warehouses', route: '/inventory/warehouses', icon: Warehouse, permission: 'inventory.read' },
      { label: 'Stock Adjustment', route: '/inventory/adjust', icon: ClipboardCheck, permission: 'inventory.adjust' },
      { label: 'Stock Transfer', route: '/inventory/transfer', icon: ArrowLeftRight, permission: 'inventory.transfer' },
      { label: 'Packaging Recipes', route: '/inventory/packaging-recipes', icon: Package, permission: 'inventory.read' },
      { label: 'Repack Orders', route: '/inventory/repack-orders', icon: ArrowLeftRight, permission: 'inventory.read' },
      { label: 'Stock Movements', route: '/inventory/movements', icon: FileText, permission: 'inventory.read' },
      // Sub-module Reports
      {
        label: 'Reports',
        route: '/reports/inventory',
        icon: Package,
        permission: 'reports.read',
        children: [
          { label: 'Dashboard',    route: '/reports/inventory',                  icon: BarChart3,      permission: 'reports.read' },
          { label: 'Stock Ledger', route: '/reports/inventory/stock-ledger',     icon: FileText,       permission: 'reports.read' },
          { label: 'Current Stock',route: '/reports/inventory/current-stock',    icon: Warehouse,      permission: 'reports.read' },
          { label: 'Repack Summary',route: '/reports/inventory/repack-summary',  icon: ArrowLeftRight, permission: 'reports.read' },
          { label: 'Wastage Report',route: '/reports/inventory/wastage',         icon: Layers,         permission: 'reports.read' },
        ]
      }
    ]
  },
  
  procurement: {
    key: 'procurement',
    label: 'Procurement',
    description: 'Purchase orders & suppliers',
    route: '/procurement',
    icon: FileText,
    iconColor: 'text-orange-600',
    permissions: ['procurement.read'],
    showOnDashboard: true,
    kpis: [
      { label: 'Open Purchase Orders', key: 'open_pos' },
      { label: 'Pending GRNs', key: 'pending_grns' },
      { label: 'Supplier Outstanding', key: 'supplier_outstanding', formatter: (v) => `₹${v?.toLocaleString()}` }
    ],
    ctas: [
      { label: 'Go to Procurement', route: '/procurement', variant: 'primary' }
    ],
    sidebarItems: [
      { label: 'Dashboard', route: '/procurement', icon: LayoutDashboard, permission: 'procurement.read' },
      { label: 'Purchase Orders', route: '/procurement/purchase-orders', icon: FileText, permission: 'procurement.read' },
      { label: 'Suppliers', route: '/procurement/suppliers', icon: Building2, permission: 'procurement.read' },
      { label: 'Goods Receipts', route: '/procurement/goods-receipts', icon: Receipt, permission: 'procurement.read' },
      { label: 'Purchase Invoices', route: '/procurement/purchase-invoices', icon: Receipt, permission: 'procurement.read' },
      { label: 'Supplier Payments', route: '/procurement/supplier-payments', icon: CreditCard, permission: 'procurement.read' },
      // Sub-module Reports
      {
        label: 'Reports',
        route: '/reports/procurement',
        icon: Truck,
        permission: 'reports.read',
        children: [
          { label: 'Dashboard',          route: '/reports/procurement',                      icon: BarChart3,      permission: 'reports.read' },
          { label: 'Invoice Register',   route: '/reports/procurement/invoice-register',     icon: ReceiptText,    permission: 'reports.read' },
          { label: 'GRN Report',         route: '/reports/procurement/grn-report',           icon: ClipboardCheck, permission: 'reports.read' },
          { label: 'Vendor-wise Purchase',route: '/reports/procurement/vendor-wise',         icon: Building2,      permission: 'reports.read' },
          { label: 'Supplier Payments',  route: '/reports/procurement/payment-register',     icon: CreditCard,     permission: 'reports.read' },
        ]
      }
    ]
  },
  
  accounting: {
    key: 'accounting',
    label: 'Accounting',
    description: 'Financial management & ledgers',
    route: '/accounting',
    icon: DollarSign,
    iconColor: 'text-red-600',
    permissions: ['accounting.read'],
    showOnDashboard: true,
    kpis: [
      { label: 'Receivables', key: 'receivables', formatter: (v) => `₹${v?.toLocaleString()}` },
      { label: 'Payables', key: 'payables', formatter: (v) => `₹${v?.toLocaleString()}` },
      { label: 'Cash Balance', key: 'cash_balance', formatter: (v) => `₹${v?.toLocaleString()}` }
    ],
    ctas: [
      { label: 'Go to Accounting', route: '/accounting', variant: 'primary' }
    ],
    sidebarItems: [
      { label: 'Dashboard', route: '/accounting', icon: LayoutDashboard, permission: 'accounting.read' },
      { label: 'Chart of Accounts', route: '/accounting/chart-of-accounts', icon: FileText, permission: 'accounting.read' },
      { label: 'Journal Entries', route: '/accounting/journal-entries', icon: FileText, permission: 'accounting.write' },
      { label: 'Ledgers', route: '/accounting/ledgers', icon: FileText, permission: 'accounting.read' },
      { label: 'Reconciliation', route: '/accounting/reconciliation', icon: ClipboardCheck, permission: 'accounting.reconcile' },
      // Sub-module Reports
      {
        label: 'Reports',
        route: '/reports/accounting',
        icon: DollarSign,
        permission: 'reports.read',
        children: [
          { label: 'Dashboard',             route: '/reports/accounting',                        icon: BarChart3,  permission: 'reports.read' },
          { label: 'Revenue vs Expense',    route: '/reports/accounting/revenue-expense',        icon: LineChart,  permission: 'reports.read' },
          { label: 'Payment Collections',   route: '/reports/accounting/payment-collections',    icon: CreditCard, permission: 'reports.read' },
          { label: 'Tax Collection',        route: '/reports/accounting/tax-collection',         icon: Percent,    permission: 'reports.read' },
          { label: 'Cash Flow Summary',     route: '/reports/accounting/cash-flow',              icon: TrendingUp, permission: 'reports.read' },
        ]
      }
    ]
  },
  
  reports: {
    key: 'reports',
    label: 'Reports',
    description: 'Analytics & business intelligence',
    route: '/reports',
    icon: BarChart3,
    iconColor: 'text-indigo-600',
    permissions: ['reports.read'],
    showOnDashboard: true,
    kpis: [
      { label: 'Sales Report', key: 'sales_report' },
      { label: 'Inventory Valuation', key: 'inventory_valuation', formatter: (v) => `₹${v?.toLocaleString()}` }
    ],
    ctas: [
      { label: 'View Reports', route: '/reports', variant: 'primary' }
    ],
    sidebarItems: [
      { label: 'Dashboard', route: '/reports', icon: LayoutDashboard, permission: 'reports.read' },

      {
        label: 'Sales Reports',
        route: '/reports/sales',
        icon: TrendingUp,
        permission: 'reports.read',
        children: SALES_REPORT_SIDEBAR_ITEMS
      },

      {
        label: 'Inventory Reports',
        route: '/reports/inventory',
        icon: Package,
        permission: 'reports.read',
        children: [
          { label: 'Dashboard',    route: '/reports/inventory',                  icon: BarChart3,      permission: 'reports.read' },
          { label: 'Stock Ledger', route: '/reports/inventory/stock-ledger',     icon: FileText,       permission: 'reports.read' },
          { label: 'Current Stock',route: '/reports/inventory/current-stock',    icon: Warehouse,      permission: 'reports.read' },
          { label: 'Repack Summary',route: '/reports/inventory/repack-summary',  icon: ArrowLeftRight, permission: 'reports.read' },
          { label: 'Wastage Report',route: '/reports/inventory/wastage',         icon: Layers,         permission: 'reports.read' },
        ]
      },

      {
        label: 'Procurement Reports',
        route: '/reports/procurement',
        icon: Truck,
        permission: 'reports.read',
        children: [
          { label: 'Dashboard',          route: '/reports/procurement',                      icon: BarChart3,      permission: 'reports.read' },
          { label: 'Invoice Register',   route: '/reports/procurement/invoice-register',     icon: ReceiptText,    permission: 'reports.read' },
          { label: 'GRN Report',         route: '/reports/procurement/grn-report',           icon: ClipboardCheck, permission: 'reports.read' },
          { label: 'Vendor-wise Purchase',route: '/reports/procurement/vendor-wise',         icon: Building2,      permission: 'reports.read' },
          { label: 'Supplier Payments',  route: '/reports/procurement/payment-register',     icon: CreditCard,     permission: 'reports.read' },
        ]
      },

      {
        label: 'Accounting Reports',
        route: '/reports/accounting',
        icon: DollarSign,
        permission: 'reports.read',
        children: [
          { label: 'Dashboard',             route: '/reports/accounting',                        icon: BarChart3,  permission: 'reports.read' },
          { label: 'Revenue vs Expense',    route: '/reports/accounting/revenue-expense',        icon: LineChart,  permission: 'reports.read' },
          { label: 'Payment Collections',   route: '/reports/accounting/payment-collections',    icon: CreditCard, permission: 'reports.read' },
          { label: 'Tax Collection',        route: '/reports/accounting/tax-collection',         icon: Percent,    permission: 'reports.read' },
          { label: 'Cash Flow Summary',     route: '/reports/accounting/cash-flow',              icon: TrendingUp, permission: 'reports.read' },
        ]
      },

      {
        label: 'Master & Audit',
        route: '/reports/master',
        icon: BookOpen,
        permission: 'reports.read',
        children: [
          { label: 'Dashboard',       route: '/reports/master',           icon: BarChart3, permission: 'reports.read' },
          { label: 'Product Master',  route: '/reports/master/products',  icon: Package,  permission: 'reports.read' },
          { label: 'Customer Master', route: '/reports/master/customers', icon: Users,    permission: 'reports.read' },
          { label: 'Supplier Master', route: '/reports/master/suppliers', icon: Truck,    permission: 'reports.read' },
          { label: 'User Master',     route: '/reports/master/users',     icon: UserCog,  permission: 'reports.read' },
          { label: 'Activity Log',    route: '/reports/master/activity',  icon: Activity, permission: 'reports.read' },
        ]
      },
    ]
  },
  
  pos: {
    key: 'pos',
    label: 'POS',
    description: 'Point of Sale system',
    route: '/pos',
    icon: Store,
    iconColor: 'text-pink-600',
    permissions: ['pos.access'],
    showOnDashboard: true,
    highlighted: true,
    kpis: [
      { label: 'Today\'s Sales', key: 'pos_sales_today', formatter: (v) => `₹${v?.toLocaleString()}` },
      { label: 'Total Transactions', key: 'pos_transactions_today' },
      { label: 'Avg Ticket', key: 'pos_avg_ticket', formatter: (v) => `₹${v?.toFixed(2)}` }
    ],
    ctas: [
      { label: 'Open POS', route: '/pos', variant: 'primary' }
    ],
    sidebarItems: [
      { label: 'POS terminal', route: '/pos', icon: Store, permission: 'pos.access' },
      { label: 'KOT setup', route: '/pos/kot-settings', icon: ListOrdered, permission: 'pos.access' },
      { label: 'Kitchen (KDS)', route: '/pos/kds', icon: Monitor, permission: 'pos.access' },
    ]
  },
  
  settings: {
    key: 'settings',
    label: 'Settings',
    description: 'System configuration & administration',
    route: '/settings',
    icon: Settings,
    iconColor: 'text-gray-600',
    permissions: ['settings.read'],
    showOnDashboard: true,
    kpis: [],
    ctas: [
      { label: 'Go to Settings', route: '/settings', variant: 'primary' }
    ],
    sidebarItems: [
      { label: 'Company Profile', route: '/settings/company', icon: Building2, permission: 'settings.write' },
      { label: 'Users & Roles', route: '/settings/users-roles', icon: UserCog, permission: 'settings.write' },
      { label: 'Taxes', route: '/settings/taxes', icon: Percent, permission: 'settings.write' },
      { label: 'Payment Modes', route: '/settings/payment-modes', icon: Wallet, permission: 'settings.write' },
      { label: 'Warehouses', route: '/settings/warehouses', icon: Warehouse, permission: 'settings.write' },
      { label: 'Number Series', route: '/settings/number-series', icon: Hash, permission: 'settings.write' },
      { label: 'Audit Logs', route: '/settings/audit-logs', icon: FileText, permission: 'settings.read' },
      { label: 'Sales Persons', route: '/settings/sales-persons', icon: Users, permission: 'settings.write' },
      { label: 'Sales Targets', route: '/settings/sales-targets', icon: Target, permission: 'settings.write' },
      // Sub-module Reports
      {
        label: 'Reports',
        route: '/reports/master',
        icon: BookOpen,
        permission: 'reports.read',
        children: [
          { label: 'Dashboard',       route: '/reports/master',           icon: BarChart3, permission: 'reports.read' },
          { label: 'Product Master',  route: '/reports/master/products',  icon: Package,  permission: 'reports.read' },
          { label: 'Customer Master', route: '/reports/master/customers', icon: Users,    permission: 'reports.read' },
          { label: 'Supplier Master', route: '/reports/master/suppliers', icon: Truck,    permission: 'reports.read' },
          { label: 'User Master',     route: '/reports/master/users',     icon: UserCog,  permission: 'reports.read' },
          { label: 'Activity Log',    route: '/reports/master/activity',  icon: Activity, permission: 'reports.read' },
        ]
      }
    ]
  }
};

export const getModuleByRoute = (pathname: string): ModuleConfig | null => {
  const moduleKey = pathname.split('/')[1];
  return modulesConfig[moduleKey] || null;
};

export const getAccessibleModules = (
  userPermissions: string[],
  companyModules: string[]
): ModuleConfig[] => {
  return Object.values(modulesConfig).filter(module => {
    const isEnabledForCompany = companyModules.includes(module.key);
    const hasPermission = module.permissions.some(p => userPermissions.includes(p));
    return module.showOnDashboard && isEnabledForCompany && hasPermission;
  });
};
