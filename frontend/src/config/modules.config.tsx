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
  Percent
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
      { label: 'Settings', route: '/ecommerce/settings', icon: Settings, permission: 'ecommerce.write' }
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
      { label: 'Monthly Revenue', key: 'monthly_revenue', formatter: (v) => `$${v?.toLocaleString()}` }
    ],
    ctas: [
      { label: 'Go to Sales', route: '/sales', variant: 'primary' },
      { label: 'Create Order', route: '/sales/orders/create', permission: 'sales.write', variant: 'secondary' }
    ],
    sidebarItems: [
      { label: 'Dashboard', route: '/sales', icon: LayoutDashboard, permission: 'sales.read' },
      { label: 'Orders', route: '/sales/orders', icon: ShoppingCart, permission: 'sales.read' },
      { label: 'Quotations', route: '/sales/quotations', icon: FileText, permission: 'sales.read' },
      { label: 'Order Invoices', route: '/sales/invoices', icon: Receipt, permission: 'sales.read' },
      { label: 'Payments', route: '/sales/payments', icon: CreditCard, permission: 'sales.read' },
      { label: 'Customers', route: '/sales/customers', icon: Users, permission: 'sales.read' },
      { label: 'Leads', route: '/sales/leads', icon: UserCheck, permission: 'sales.read' },
      { label: 'Credit Management', route: '/sales/credit-management', icon: CreditCard, permission: 'sales.read' },
      { label: 'Analytics', route: '/sales/analytics', icon: BarChart3, permission: 'sales.read' }
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
      { label: 'Total Stock Value', key: 'stock_value', formatter: (v) => `$${v?.toLocaleString()}` }
    ],
    ctas: [
      { label: 'Go to Inventory', route: '/inventory', variant: 'primary' }
    ],
    sidebarItems: [
      { label: 'Dashboard', route: '/inventory', icon: LayoutDashboard, permission: 'inventory.read' },
      { label: 'Products', route: '/inventory/products', icon: Package, permission: 'inventory.read' },
      { label: 'Categories', route: '/inventory/categories', icon: Grid, permission: 'inventory.read' },
      { label: 'Brands', route: '/inventory/brands', icon: Tag, permission: 'inventory.read' },
      { label: 'Warehouses', route: '/inventory/warehouses', icon: Warehouse, permission: 'inventory.read' },
      { label: 'Stock Adjustment', route: '/inventory/adjust', icon: ClipboardCheck, permission: 'inventory.adjust' },
      { label: 'Stock Transfer', route: '/inventory/transfer', icon: ArrowLeftRight, permission: 'inventory.transfer' },
      { label: 'Stock Movements', route: '/inventory/movements', icon: FileText, permission: 'inventory.read' }
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
      { label: 'Supplier Outstanding', key: 'supplier_outstanding', formatter: (v) => `$${v?.toLocaleString()}` }
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
      { label: 'Supplier Payments', route: '/procurement/supplier-payments', icon: CreditCard, permission: 'procurement.read' }
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
      { label: 'Receivables', key: 'receivables', formatter: (v) => `$${v?.toLocaleString()}` },
      { label: 'Payables', key: 'payables', formatter: (v) => `$${v?.toLocaleString()}` },
      { label: 'Cash Balance', key: 'cash_balance', formatter: (v) => `$${v?.toLocaleString()}` }
    ],
    ctas: [
      { label: 'Go to Accounting', route: '/accounting', variant: 'primary' }
    ],
    sidebarItems: [
      { label: 'Dashboard', route: '/accounting', icon: LayoutDashboard, permission: 'accounting.read' },
      { label: 'Chart of Accounts', route: '/accounting/chart-of-accounts', icon: FileText, permission: 'accounting.read' },
      { label: 'Journal Entries', route: '/accounting/journal-entries', icon: FileText, permission: 'accounting.write' },
      { label: 'Ledgers', route: '/accounting/ledgers', icon: FileText, permission: 'accounting.read' },
      { label: 'Reconciliation', route: '/accounting/reconciliation', icon: ClipboardCheck, permission: 'accounting.reconcile' }
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
      { label: 'Inventory Valuation', key: 'inventory_valuation', formatter: (v) => `$${v?.toLocaleString()}` }
    ],
    ctas: [
      { label: 'View Reports', route: '/reports', variant: 'primary' }
    ],
    sidebarItems: [
      { label: 'Dashboard', route: '/reports', icon: LayoutDashboard, permission: 'reports.read' },
      { label: 'Sales Reports', route: '/reports/sales', icon: TrendingUp, permission: 'reports.read' },
      { label: 'Inventory Reports', route: '/reports/inventory', icon: Package, permission: 'reports.read' },
      { label: 'Financial Reports', route: '/reports/financial', icon: DollarSign, permission: 'reports.read' },
      { label: 'Custom Reports', route: '/reports/custom', icon: FileText, permission: 'reports.read' }
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
      { label: 'Today\'s Sales', key: 'pos_sales_today', formatter: (v) => `$${v?.toLocaleString()}` },
      { label: 'Transactions', key: 'pos_transactions' },
      { label: 'Avg Ticket', key: 'pos_avg_ticket', formatter: (v) => `$${v?.toFixed(2)}` }
    ],
    ctas: [
      { label: 'Open POS', route: '/pos', variant: 'primary' }
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
      { label: 'Sales Targets', route: '/settings/sales-targets', icon: Target, permission: 'settings.write' }
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
