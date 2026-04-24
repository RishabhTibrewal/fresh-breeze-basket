import { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Package,
  Grid,
  Warehouse,
  ClipboardCheck,
  ArrowLeftRight,
  Users,
  UserCheck,
  ShoppingCart,
  Receipt,
  ReceiptText,
  CreditCard,
  TrendingUp,
  Target,
  ShoppingBag,
  FileText,
  Settings,
  Tag,
  Percent,
  Building2,
  FileSearch,
  BarChart3,
  DollarSign,
  Calendar,
  Hash,
  Shield,
  Wallet,
  UserCog,
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
  Boxes
} from 'lucide-react';

export interface SidebarMenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path?: string;
  roles?: string[]; // Required roles (admin has access to all)
  children?: SidebarMenuItem[];
  badge?: number | string;
}

export interface SidebarGroup {
  id: string;
  label: string;
  items: SidebarMenuItem[];
  roles?: string[];
  collapsible?: boolean;
}

export interface SidebarConfig {
  groups: SidebarGroup[];
  bottomAnchored?: SidebarGroup; // Settings group
}

// Dashboard item (single item, no group)
const dashboardItem: SidebarMenuItem = {
  id: 'dashboard',
  label: 'Dashboard',
  icon: LayoutDashboard,
  path: '/admin',
  roles: ['admin', 'sales', 'accounts', 'warehouse_manager', 'procurement']
};

// Stock/Inventory Group
const stockGroup: SidebarGroup = {
  id: 'stock',
  label: 'Stock/Inventory',
  collapsible: true,
  roles: ['admin', 'sales', 'warehouse_manager'],
  items: [
    {
      id: 'products',
      label: 'Products',
      icon: Package,
      path: '/inventory/products',
      roles: ['admin', 'warehouse_manager']
    },
    {
      id: 'categories',
      label: 'Categories',
      icon: Grid,
      path: '/inventory/categories',
      roles: ['admin', 'warehouse_manager']
    },
    {
      id: 'warehouses',
      label: 'Warehouses',
      icon: Warehouse,
      path: '/inventory/warehouses',
      roles: ['admin', 'warehouse_manager']
    },
    {
      id: 'stock-adjustment',
      label: 'Stock Adjustment',
      icon: ClipboardCheck,
      path: '/inventory/adjust',
      roles: ['admin', 'warehouse_manager']
    },
    {
      id: 'stock-transfer',
      label: 'Stock Transfer',
      icon: ArrowLeftRight,
      path: '/inventory/transfer',
      roles: ['admin', 'warehouse_manager']
    },
    {
      id: 'packaging-recipes',
      label: 'Packaging Recipes',
      icon: Package,
      path: '/inventory/packaging-recipes',
      roles: ['admin', 'warehouse_manager']
    },
    {
      id: 'repack-orders',
      label: 'Repack Orders',
      icon: ArrowLeftRight,
      path: '/inventory/repack-orders',
      roles: ['admin', 'warehouse_manager']
    },
    {
      id: 'stock-reports',
      label: 'Reports',
      icon: FileText,
      roles: ['admin', 'warehouse_manager'],
      children: [
        {
          id: 'stock-ledger',
          label: 'Stock Ledger',
          icon: FileText,
          path: '/inventory/movements',
          roles: ['admin', 'warehouse_manager']
        },
        {
          id: 'stock-balance',
          label: 'Stock Balance',
          icon: BarChart3,
          path: '/inventory/balance',
          roles: ['admin', 'warehouse_manager']
        },
        {
          id: 'warehouse-stock-balance',
          label: 'Warehouse-wise Stock Balance',
          icon: Warehouse,
          path: '/inventory/warehouse-balance',
          roles: ['admin', 'warehouse_manager']
        }
      ]
    }
  ]
};

// Sales Group
const salesGroup: SidebarGroup = {
  id: 'sales',
  label: 'Sales',
  collapsible: true,
  roles: ['admin', 'sales'],
  items: [
    {
      id: 'customers',
      label: 'Customers',
      icon: Users,
      path: '/admin/customers',
      roles: ['admin', 'sales']
    },
    {
      id: 'leads',
      label: 'Leads',
      icon: UserCheck,
      path: '/admin/leads',
      roles: ['admin', 'sales']
    },
    {
      id: 'quotations',
      label: 'Quotations',
      icon: FileText,
      path: '/admin/quotations',
      roles: ['admin', 'sales'],
      children: [
        {
          id: 'quotations-list',
          label: 'All Quotations',
          icon: FileText,
          path: '/admin/quotations',
          roles: ['admin', 'sales']
        }
      ]
    },
    {
      id: 'orders',
      label: 'Orders',
      icon: ShoppingCart,
      path: '/sales/orders',
      roles: ['admin', 'sales']
    },
    {
      id: 'order-invoices',
      label: 'Order Invoices',
      icon: Receipt,
      path: '/admin/invoices',
      roles: ['admin', 'sales'],
      children: [
        {
          id: 'invoices-list',
          label: 'All Invoices',
          icon: Receipt,
          path: '/admin/invoices',
          roles: ['admin', 'sales']
        }
      ]
    },
    {
      id: 'payments',
      label: 'Payments',
      icon: CreditCard,
      path: '/sales/payments',
      roles: ['admin', 'sales'],
      children: [
        {
          id: 'payments-list',
          label: 'All Payments',
          icon: CreditCard,
          path: '/sales/payments',
          roles: ['admin', 'sales']
        }
      ]
    },
    {
      id: 'credit-notes',
      label: 'Credit Notes',
      icon: CreditCard,
      path: '/sales/credit-notes',
      roles: ['admin', 'sales']
    },
    {
      id: 'credit-management',
      label: 'Credit Management',
      icon: TrendingUp,
      path: '/sales/credit-management',
      roles: ['admin', 'sales']
    },
    {
      id: 'sales-targets',
      label: 'Sales Target',
      icon: Target,
      path: '/admin/sales-targets',
      roles: ['admin', 'sales']
    },
    {
      id: 'sales-persons',
      label: 'Sales Persons',
      icon: Users,
      path: '/admin/sales-persons',
      roles: ['admin', 'sales']
    },
    {
      id: 'pos',
      label: 'POS',
      icon: ShoppingCart,
      path: '/admin/pos',
      roles: ['admin', 'sales']
    },
    {
      id: 'sales-analysis',
      label: 'Sales Analysis',
      icon: BarChart3,
      path: '/admin/sales/analysis',
      roles: ['admin']
    },
    {
      id: 'sales-reports',
      label: 'Reports',
      icon: FileText,
      roles: ['admin', 'sales'],
      children: [
        {
          id: 'sales-summary',
          label: 'Sales Summary',
          icon: BarChart3,
          path: '/admin/sales/reports/summary',
          roles: ['admin', 'sales']
        },
        {
          id: 'invoice-register',
          label: 'Invoice Register',
          icon: Receipt,
          path: '/admin/sales/reports/invoice-register',
          roles: ['admin', 'sales']
        },
        {
          id: 'outstanding-receivables',
          label: 'Outstanding Receivables',
          icon: DollarSign,
          path: '/admin/sales/reports/receivables',
          roles: ['admin', 'sales']
        },
        {
          id: 'sales-by-person',
          label: 'Sales by Sales Person',
          icon: Users,
          path: '/admin/sales/reports/by-person',
          roles: ['admin', 'sales']
        }
      ]
    }
  ]
};

// Procurement Group
const procurementGroup: SidebarGroup = {
  id: 'procurement',
  label: 'Procurement',
  collapsible: true,
  roles: ['admin', 'procurement', 'warehouse_manager', 'accounts'],
  items: [
    {
      id: 'suppliers',
      label: 'Suppliers',
      icon: Building2,
      path: '/admin/suppliers',
      roles: ['admin', 'procurement', 'warehouse_manager']
    },
    {
      id: 'purchase-orders',
      label: 'Purchase Orders',
      icon: FileText,
      path: '/admin/purchase-orders',
      roles: ['admin', 'procurement', 'warehouse_manager']
    },
    {
      id: 'goods-receipts',
      label: 'Goods Receipts',
      icon: Receipt,
      path: '/admin/goods-receipts',
      roles: ['admin', 'procurement', 'warehouse_manager']
    },
    {
      id: 'purchase-invoices',
      label: 'Purchase Invoices',
      icon: ReceiptText,
      path: '/admin/purchase-invoices',
      roles: ['admin', 'procurement', 'warehouse_manager', 'accounts']
    },
    {
      id: 'supplier-payments',
      label: 'Supplier Payments',
      icon: CreditCard,
      path: '/admin/supplier-payments',
      roles: ['admin', 'procurement', 'accounts']
    },
    {
      id: 'procurement-reports',
      label: 'Reports',
      icon: FileText,
      roles: ['admin', 'procurement', 'warehouse_manager', 'accounts'],
      children: [
        {
          id: 'purchase-summary',
          label: 'Purchase Summary',
          icon: BarChart3,
          path: '/admin/procurement/reports/summary',
          roles: ['admin', 'procurement', 'warehouse_manager', 'accounts']
        },
        {
          id: 'grn-pending',
          label: 'GRN Pending',
          icon: ClipboardCheck,
          path: '/admin/procurement/reports/grn-pending',
          roles: ['admin', 'procurement', 'warehouse_manager', 'accounts']
        },
        {
          id: 'supplier-outstanding',
          label: 'Supplier Outstanding',
          icon: DollarSign,
          path: '/admin/procurement/reports/supplier-outstanding',
          roles: ['admin', 'procurement', 'warehouse_manager', 'accounts']
        }
      ]
    }
  ]
};

// Reports Group (cross-functional — all 5 modules)
const reportsGroup: SidebarGroup = {
  id: 'reports',
  label: 'Reports',
  collapsible: true,
  roles: ['admin', 'sales', 'accounts', 'warehouse_manager', 'procurement'],
  items: [
    // ── Sales Reports ──────────────────────────────────────────────────────
    {
      id: 'reports-sales',
      label: 'Sales Reports',
      icon: TrendingUp,
      path: '/reports/sales',
      roles: ['admin', 'sales', 'accounts'],
      children: [
        {
          id: 'report-sales-dashboard',
          label: 'Dashboard',
          icon: BarChart3,
          path: '/reports/sales',
          roles: ['admin', 'sales', 'accounts']
        },
        {
          id: 'report-order-summary',
          label: 'Order Summary',
          icon: ShoppingCart,
          path: '/reports/sales/order-summary',
          roles: ['admin', 'sales', 'accounts']
        },
        {
          id: 'report-salesperson',
          label: 'Salesperson Performance',
          icon: Users,
          path: '/reports/sales/salesperson-performance',
          roles: ['admin', 'sales']
        },
        {
          id: 'report-customer-wise',
          label: 'Customer-wise Sales',
          icon: Users,
          path: '/reports/sales/customer-wise',
          roles: ['admin', 'sales', 'accounts']
        },
        {
          id: 'report-product-wise',
          label: 'Product-wise Sales',
          icon: Package,
          path: '/reports/sales/product-wise',
          roles: ['admin', 'sales', 'accounts']
        },
        {
          id: 'report-target-vs-achievement',
          label: 'Target vs Achievement',
          icon: Target,
          path: '/reports/sales/target-vs-achievement',
          roles: ['admin', 'sales']
        },
        {
          id: 'report-pending-deliveries',
          label: 'Pending Deliveries',
          icon: Clock,
          path: '/reports/sales/pending-deliveries',
          roles: ['admin', 'sales', 'accounts']
        },
        {
          id: 'report-sales-returns',
          label: 'Sales Returns',
          icon: RotateCcw,
          path: '/reports/sales/returns',
          roles: ['admin', 'sales', 'accounts']
        },
        {
          id: 'report-hourly-heatmap',
          label: 'Hourly Sales Heatmap',
          icon: Clock,
          path: '/reports/sales/hourly-heatmap',
          roles: ['admin', 'sales', 'accounts']
        },
        {
          id: 'report-payment-mix',
          label: 'Payment Method Mix',
          icon: CreditCard,
          path: '/reports/sales/payment-mix',
          roles: ['admin', 'sales', 'accounts']
        },
        {
          id: 'report-fulfillment-mix',
          label: 'Fulfillment Breakdown',
          icon: Truck,
          path: '/reports/sales/fulfillment-mix',
          roles: ['admin', 'sales', 'accounts']
        },
        {
          id: 'report-discount-impact',
          label: 'Discount Impact',
          icon: Tag,
          path: '/reports/sales/discount-impact',
          roles: ['admin', 'sales', 'accounts']
        },
        {
          id: 'report-cashier-performance',
          label: 'Cashier Performance',
          icon: UserCheck,
          path: '/reports/sales/cashier-performance',
          roles: ['admin', 'sales', 'accounts']
        },
        {
          id: 'report-category-brand',
          label: 'Category & Brand Sales',
          icon: Layers,
          path: '/reports/sales/category-brand',
          roles: ['admin', 'sales', 'accounts']
        },
        {
          id: 'report-basket-metrics',
          label: 'Average Basket Metrics',
          icon: Boxes,
          path: '/reports/sales/basket-metrics',
          roles: ['admin', 'sales', 'accounts']
        },
        {
          id: 'report-modifier-revenue',
          label: 'Modifier / Add-on Revenue',
          icon: PlusSquare,
          path: '/reports/sales/modifier-revenue',
          roles: ['admin', 'sales', 'accounts']
        },
        {
          id: 'report-trend-comparison',
          label: 'Hourly & Weekday Trend',
          icon: CalendarClock,
          path: '/reports/sales/trend-comparison',
          roles: ['admin', 'sales', 'accounts']
        },
        {
          id: 'report-movers',
          label: 'Top / Bottom Movers',
          icon: TrendingUp,
          path: '/reports/sales/movers',
          roles: ['admin', 'sales', 'accounts']
        },
        {
          id: 'report-outlet-leaderboard',
          label: 'Outlet Leaderboard',
          icon: Trophy,
          path: '/reports/sales/outlet-leaderboard',
          roles: ['admin']
        }
      ]
    },
    // ── Inventory Reports ──────────────────────────────────────────────────
    {
      id: 'reports-inventory',
      label: 'Inventory Reports',
      icon: Package,
      path: '/reports/inventory',
      roles: ['admin', 'warehouse_manager', 'accounts'],
      children: [
        {
          id: 'report-inventory-dashboard',
          label: 'Dashboard',
          icon: BarChart3,
          path: '/reports/inventory',
          roles: ['admin', 'warehouse_manager', 'accounts']
        },
        {
          id: 'report-stock-ledger',
          label: 'Stock Ledger',
          icon: FileText,
          path: '/reports/inventory/stock-ledger',
          roles: ['admin', 'warehouse_manager']
        },
        {
          id: 'report-current-stock',
          label: 'Current Stock',
          icon: Warehouse,
          path: '/reports/inventory/current-stock',
          roles: ['admin', 'warehouse_manager']
        },
        {
          id: 'report-repack-summary',
          label: 'Repack Summary',
          icon: ArrowLeftRight,
          path: '/reports/inventory/repack-summary',
          roles: ['admin', 'warehouse_manager']
        },
        {
          id: 'report-wastage',
          label: 'Wastage Report',
          icon: Layers,
          path: '/reports/inventory/wastage',
          roles: ['admin', 'warehouse_manager']
        }
      ]
    },
    // ── Procurement Reports ────────────────────────────────────────────────
    {
      id: 'reports-procurement',
      label: 'Procurement Reports',
      icon: Truck,
      path: '/reports/procurement',
      roles: ['admin', 'procurement', 'accounts'],
      children: [
        {
          id: 'report-procurement-dashboard',
          label: 'Dashboard',
          icon: BarChart3,
          path: '/reports/procurement',
          roles: ['admin', 'procurement', 'accounts']
        },
        {
          id: 'report-invoice-register',
          label: 'Invoice Register',
          icon: ReceiptText,
          path: '/reports/procurement/invoice-register',
          roles: ['admin', 'procurement', 'accounts']
        },
        {
          id: 'report-grn',
          label: 'GRN Report',
          icon: ClipboardCheck,
          path: '/reports/procurement/grn-report',
          roles: ['admin', 'procurement', 'warehouse_manager']
        },
        {
          id: 'report-vendor-wise',
          label: 'Vendor-wise Purchase',
          icon: Building2,
          path: '/reports/procurement/vendor-wise',
          roles: ['admin', 'procurement', 'accounts']
        },
        {
          id: 'report-supplier-payments',
          label: 'Supplier Payments',
          icon: CreditCard,
          path: '/reports/procurement/payment-register',
          roles: ['admin', 'procurement', 'accounts']
        }
      ]
    },
    // ── Accounting Reports ─────────────────────────────────────────────────
    {
      id: 'reports-accounting',
      label: 'Accounting Reports',
      icon: DollarSign,
      path: '/reports/accounting',
      roles: ['admin', 'accounts'],
      children: [
        {
          id: 'report-accounting-dashboard',
          label: 'Dashboard',
          icon: BarChart3,
          path: '/reports/accounting',
          roles: ['admin', 'accounts']
        },
        {
          id: 'report-revenue-expense',
          label: 'Revenue vs Expense',
          icon: LineChart,
          path: '/reports/accounting/revenue-expense',
          roles: ['admin', 'accounts']
        },
        {
          id: 'report-payment-collections',
          label: 'Payment Collections',
          icon: CreditCard,
          path: '/reports/accounting/payment-collections',
          roles: ['admin', 'accounts']
        },
        {
          id: 'report-tax-collection',
          label: 'Tax Collection',
          icon: Percent,
          path: '/reports/accounting/tax-collection',
          roles: ['admin', 'accounts']
        },
        {
          id: 'report-cash-flow',
          label: 'Cash Flow Summary',
          icon: TrendingUp,
          path: '/reports/accounting/cash-flow',
          roles: ['admin', 'accounts']
        }
      ]
    },
    // ── Master & Audit Reports ─────────────────────────────────────────────
    {
      id: 'reports-master',
      label: 'Master & Audit',
      icon: BookOpen,
      path: '/reports/master',
      roles: ['admin'],
      children: [
        {
          id: 'report-master-dashboard',
          label: 'Dashboard',
          icon: BarChart3,
          path: '/reports/master',
          roles: ['admin']
        },
        {
          id: 'report-product-master',
          label: 'Product Master',
          icon: Package,
          path: '/reports/master/products',
          roles: ['admin']
        },
        {
          id: 'report-customer-master',
          label: 'Customer Master',
          icon: Users,
          path: '/reports/master/customers',
          roles: ['admin']
        },
        {
          id: 'report-supplier-master',
          label: 'Supplier Master',
          icon: Truck,
          path: '/reports/master/suppliers',
          roles: ['admin']
        },
        {
          id: 'report-user-master',
          label: 'User Master',
          icon: UserCog,
          path: '/reports/master/users',
          roles: ['admin']
        },
        {
          id: 'report-activity-log',
          label: 'Activity Log',
          icon: Activity,
          path: '/reports/master/activity',
          roles: ['admin']
        }
      ]
    }
  ]
};

// Settings Group (bottom anchored)
const settingsGroup: SidebarGroup = {
  id: 'settings',
  label: 'Settings',
  collapsible: true,
  roles: ['admin'],
  items: [
    {
      id: 'company-profile',
      label: 'Company Profile',
      icon: Building2,
      path: '/admin/settings/company',
      roles: ['admin']
    },
    {
      id: 'users-roles',
      label: 'Users & Roles',
      icon: UserCog,
      path: '/admin/settings/users-roles',
      roles: ['admin']
    },
    {
      id: 'taxes',
      label: 'Taxes',
      icon: Percent,
      path: '/admin/taxes',
      roles: ['admin']
    },
    {
      id: 'payment-modes',
      label: 'Payment Modes',
      icon: Wallet,
      path: '/admin/settings/payment-modes',
      roles: ['admin']
    },
    {
      id: 'warehouses',
      label: 'Warehouses',
      icon: Warehouse,
      path: '/inventory/warehouses',
      roles: ['admin']
    },
    {
      id: 'number-series',
      label: 'Number Series',
      icon: Hash,
      path: '/admin/settings/number-series',
      roles: ['admin']
    },
    {
      id: 'audit-logs',
      label: 'Audit Logs',
      icon: FileText,
      path: '/admin/settings/audit-logs',
      roles: ['admin']
    }
  ]
};

// Main sidebar configuration
export const sidebarConfig: SidebarConfig = {
  groups: [
    stockGroup,
    salesGroup,
    procurementGroup,
    reportsGroup
  ],
  bottomAnchored: settingsGroup
};

// Export dashboard item separately for special handling
export { dashboardItem };
