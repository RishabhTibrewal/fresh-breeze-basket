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
  UserCog
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
      path: '/admin/products',
      roles: ['admin', 'warehouse_manager']
    },
    {
      id: 'categories',
      label: 'Categories',
      icon: Grid,
      path: '/admin/categories',
      roles: ['admin', 'warehouse_manager']
    },
    {
      id: 'warehouses',
      label: 'Warehouses',
      icon: Warehouse,
      path: '/admin/warehouses',
      roles: ['admin', 'warehouse_manager']
    },
    {
      id: 'stock-adjustment',
      label: 'Stock Adjustment',
      icon: ClipboardCheck,
      path: '/admin/inventory/adjust',
      roles: ['admin', 'warehouse_manager']
    },
    {
      id: 'stock-transfer',
      label: 'Stock Transfer',
      icon: ArrowLeftRight,
      path: '/admin/inventory/transfer',
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
          path: '/admin/inventory/movements',
          roles: ['admin', 'warehouse_manager']
        },
        {
          id: 'stock-balance',
          label: 'Stock Balance',
          icon: BarChart3,
          path: '/admin/inventory/balance',
          roles: ['admin', 'warehouse_manager']
        },
        {
          id: 'warehouse-stock-balance',
          label: 'Warehouse-wise Stock Balance',
          icon: Warehouse,
          path: '/admin/inventory/warehouse-balance',
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
      path: '/admin/orders',
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
      path: '/admin/payments',
      roles: ['admin', 'sales'],
      children: [
        {
          id: 'payments-list',
          label: 'All Payments',
          icon: CreditCard,
          path: '/admin/payments',
          roles: ['admin', 'sales']
        }
      ]
    },
    {
      id: 'credit-management',
      label: 'Credit Management',
      icon: TrendingUp,
      path: '/admin/credit-management',
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

// Reports Group (cross-functional)
const reportsGroup: SidebarGroup = {
  id: 'reports',
  label: 'Reports',
  collapsible: true,
  roles: ['admin', 'sales', 'accounts', 'warehouse_manager', 'procurement'],
  items: [
    {
      id: 'profit-loss',
      label: 'Profit & Loss',
      icon: TrendingUp,
      path: '/admin/reports/profit-loss',
      roles: ['admin', 'accounts']
    },
    {
      id: 'inventory-valuation',
      label: 'Inventory Valuation',
      icon: Package,
      path: '/admin/reports/inventory-valuation',
      roles: ['admin', 'warehouse_manager', 'accounts']
    },
    {
      id: 'tax-gst-reports',
      label: 'Tax / GST Reports',
      icon: Percent,
      path: '/admin/reports/tax-gst',
      roles: ['admin', 'accounts']
    },
    {
      id: 'aging-reports',
      label: 'Aging Reports',
      icon: Calendar,
      path: '/admin/reports/aging',
      roles: ['admin', 'accounts', 'sales']
    },
    {
      id: 'custom-reports',
      label: 'Custom Reports',
      icon: FileSearch,
      path: '/admin/reports/custom',
      roles: ['admin', 'accounts']
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
      path: '/admin/warehouses',
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
