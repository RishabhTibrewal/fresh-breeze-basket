import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  DollarSign, ShoppingCart, TrendingUp, TrendingDown, RotateCcw,
  BarChart3, Users, Package, Target, Clock, ChevronRight,
  CreditCard, Truck, Tag, UserCheck,
  Layers, Boxes, PlusSquare, CalendarClock, Trophy,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard } from '@/components/reports/KpiCard';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { Button } from '@/components/ui/button';
import apiClient from '@/lib/apiClient';
import { formatCurrency } from '@/lib/utils';
import type { ReportFilter } from '@/api/reports';

const today = new Date();
const thirtyDaysAgo = new Date(today);
thirtyDaysAgo.setDate(today.getDate() - 30);

interface SalesDashboardKpis {
  revenue_this_period: number;
  revenue_prev_period: number;
  revenue_growth_pct: number;
  orders_this_period: number;
  orders_prev_period: number;
  orders_growth_pct: number;
  avg_order_value: number;
  returns_value: number;
}

const REPORT_LINKS = [
  { label: 'Sales Order Summary',       path: '/reports/sales/order-summary',          icon: ShoppingCart, color: 'text-blue-600 bg-blue-50' },
  { label: 'Salesperson Performance',   path: '/reports/sales/salesperson-performance', icon: Users,        color: 'text-violet-600 bg-violet-50' },
  { label: 'Customer-wise Sales',       path: '/reports/sales/customer-wise',           icon: BarChart3,    color: 'text-emerald-600 bg-emerald-50' },
  { label: 'Product-wise Sales',        path: '/reports/sales/product-wise',            icon: Package,      color: 'text-amber-600 bg-amber-50' },
  { label: 'Target vs Achievement',     path: '/reports/sales/target-vs-achievement',  icon: Target,       color: 'text-rose-600 bg-rose-50' },
  { label: 'Pending Deliveries',        path: '/reports/sales/pending-deliveries',     icon: Clock,        color: 'text-orange-600 bg-orange-50' },
  { label: 'Sales Returns',             path: '/reports/sales/returns',                icon: RotateCcw,    color: 'text-red-600 bg-red-50' },
  { label: 'Hourly Sales Heatmap',      path: '/reports/sales/hourly-heatmap',         icon: Clock,        color: 'text-indigo-600 bg-indigo-50' },
  { label: 'Payment Method Mix',        path: '/reports/sales/payment-mix',            icon: CreditCard,   color: 'text-sky-600 bg-sky-50' },
  { label: 'Fulfillment Breakdown',     path: '/reports/sales/fulfillment-mix',        icon: Truck,        color: 'text-teal-600 bg-teal-50' },
  { label: 'Discount Impact',           path: '/reports/sales/discount-impact',        icon: Tag,          color: 'text-pink-600 bg-pink-50' },
  { label: 'Cashier Performance',       path: '/reports/sales/cashier-performance',    icon: UserCheck,    color: 'text-fuchsia-600 bg-fuchsia-50' },
  { label: 'Category & Brand Sales',    path: '/reports/sales/category-brand',         icon: Layers,       color: 'text-cyan-600 bg-cyan-50' },
  { label: 'Average Basket Metrics',    path: '/reports/sales/basket-metrics',         icon: Boxes,        color: 'text-lime-600 bg-lime-50' },
  { label: 'Modifier / Add-on Revenue', path: '/reports/sales/modifier-revenue',       icon: PlusSquare,   color: 'text-purple-600 bg-purple-50' },
  { label: 'Hourly & Weekday Trend',    path: '/reports/sales/trend-comparison',       icon: CalendarClock,color: 'text-blue-600 bg-blue-50' },
  { label: 'Top / Bottom Movers',       path: '/reports/sales/movers',                 icon: TrendingUp,   color: 'text-emerald-600 bg-emerald-50' },
];

const ADMIN_ONLY_REPORTS = [
  { label: 'Outlet Leaderboard',        path: '/reports/sales/outlet-leaderboard',     icon: Trophy,       color: 'text-amber-600 bg-amber-50' },
];

export default function SalesReportsDashboard() {
  const { profile } = useAuth();
  const isAdmin = (profile?.roles || []).includes('admin')
    || (profile?.roles || []).includes('super_admin')
    || profile?.role === 'admin'
    || profile?.role === 'super_admin';
  const reportLinks = isAdmin ? [...REPORT_LINKS, ...ADMIN_ONLY_REPORTS] : REPORT_LINKS;
  const [filters, setFilters] = useState<ReportFilter>({
    from_date: thirtyDaysAgo.toISOString().split('T')[0],
    to_date: today.toISOString().split('T')[0],
  });

  const { data: kpis, isLoading } = useQuery<SalesDashboardKpis>({
    queryKey: ['sales-dashboard-kpis', filters],
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/sales/dashboard', { params: filters });
      return data.data;
    },
  });

  return (
    <div className="w-full space-y-6 px-4 lg:px-8 py-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold">Sales Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Comprehensive sales analytics and performance reports
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 p-4 bg-muted/30 rounded-lg border">
        <ReportFilters
          filters={filters}
          onFilterChange={(k, v) => setFilters(prev => ({ ...prev, [k]: v }))}
          onReset={() => setFilters({ from_date: thirtyDaysAgo.toISOString().split('T')[0], to_date: today.toISOString().split('T')[0] })}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Revenue"
          value={isLoading ? '…' : formatCurrency(kpis?.revenue_this_period ?? 0)}
          trend={kpis?.revenue_growth_pct}
          subtitle="vs prev period"
          icon={<DollarSign />}
          iconColor="bg-blue-50 text-blue-600"
          isLoading={isLoading}
        />
        <KpiCard
          title="Orders"
          value={isLoading ? '…' : (kpis?.orders_this_period ?? 0).toLocaleString()}
          trend={kpis?.orders_growth_pct}
          subtitle="vs prev period"
          icon={<ShoppingCart />}
          iconColor="bg-violet-50 text-violet-600"
          isLoading={isLoading}
        />
        <KpiCard
          title="Avg Order Value"
          value={isLoading ? '…' : formatCurrency(kpis?.avg_order_value ?? 0)}
          icon={<TrendingUp />}
          iconColor="bg-emerald-50 text-emerald-600"
          isLoading={isLoading}
        />
        <KpiCard
          title="Returns Value"
          value={isLoading ? '…' : formatCurrency(kpis?.returns_value ?? 0)}
          icon={<RotateCcw />}
          iconColor="bg-red-50 text-red-600"
          isLoading={isLoading}
        />
      </div>

      {/* Report Navigation */}
      <div>
        <h2 className="text-base font-semibold mb-3">Available Reports</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {reportLinks.map((r) => {
            const Icon = r.icon;
            return (
              <Link key={r.path} to={r.path}>
                <Card className="group hover:shadow-md transition-all duration-200 cursor-pointer border-transparent hover:border-primary/20">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={`p-2.5 rounded-lg flex-shrink-0 ${r.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{r.label}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 group-hover:text-primary transition-colors" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
