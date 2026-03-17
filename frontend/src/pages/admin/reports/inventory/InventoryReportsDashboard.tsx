import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Package, AlertTriangle, TrendingDown, RefreshCw,
  ClipboardList, BarChart3, ChevronRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { KpiCard } from '@/components/reports/KpiCard';
import { ReportFilters } from '@/components/reports/ReportFilters';
import apiClient from '@/lib/apiClient';
import type { ReportFilter } from '@/api/reports';

const today = new Date();
const thirtyDaysAgo = new Date(today);
thirtyDaysAgo.setDate(today.getDate() - 30);

interface InventoryDashboardKpis {
  total_skus: number;
  total_stock_units: number;
  out_of_stock: number;
  low_stock: number;
  total_repack_orders: number;
  total_wastage_this_period: number;
}

const REPORT_LINKS = [
  { label: 'Stock Ledger',       path: '/reports/inventory/stock-ledger',   icon: ClipboardList, color: 'text-blue-600 bg-blue-50' },
  { label: 'Current Stock',      path: '/reports/inventory/current-stock',  icon: Package,       color: 'text-emerald-600 bg-emerald-50' },
  { label: 'Repack Summary',     path: '/reports/inventory/repack-summary', icon: RefreshCw,     color: 'text-violet-600 bg-violet-50' },
  { label: 'Wastage Report',     path: '/reports/inventory/wastage',        icon: TrendingDown,  color: 'text-red-600 bg-red-50' },
];

export default function InventoryReportsDashboard() {
  const [filters, setFilters] = useState<ReportFilter>({
    from_date: thirtyDaysAgo.toISOString().split('T')[0],
    to_date: today.toISOString().split('T')[0],
  });

  const { data: kpis, isLoading } = useQuery<InventoryDashboardKpis>({
    queryKey: ['inventory-dashboard-kpis', filters],
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/inventory/dashboard', { params: filters });
      return data.data;
    },
  });

  return (
    <div className="w-full space-y-6 px-4 lg:px-8 py-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold">Inventory Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">Stock levels, movements, and repack analytics</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 p-4 bg-muted/30 rounded-lg border">
        <ReportFilters
          filters={filters}
          onFilterChange={(k, v) => setFilters(prev => ({ ...prev, [k]: v }))}
          onReset={() => setFilters({ from_date: thirtyDaysAgo.toISOString().split('T')[0], to_date: today.toISOString().split('T')[0] })}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard title="Total SKUs"          value={(kpis?.total_skus ?? 0).toLocaleString()}         icon={<Package />}       iconColor="bg-blue-50 text-blue-600"      isLoading={isLoading} />
        <KpiCard title="Total Stock Units"   value={(kpis?.total_stock_units ?? 0).toLocaleString()}  icon={<BarChart3 />}     iconColor="bg-emerald-50 text-emerald-600" isLoading={isLoading} />
        <KpiCard title="Out of Stock"        value={(kpis?.out_of_stock ?? 0).toLocaleString()}       icon={<AlertTriangle />} iconColor="bg-red-50 text-red-600"         isLoading={isLoading} />
        <KpiCard title="Low Stock"           value={(kpis?.low_stock ?? 0).toLocaleString()}          icon={<AlertTriangle />} iconColor="bg-amber-50 text-amber-600"     isLoading={isLoading} />
        <KpiCard title="Repack Orders"       value={(kpis?.total_repack_orders ?? 0).toLocaleString()}icon={<RefreshCw />}     iconColor="bg-violet-50 text-violet-600"   isLoading={isLoading} />
        <KpiCard title="Wastage (This Period)"value={(kpis?.total_wastage_this_period ?? 0).toFixed(1) + ' units'} icon={<TrendingDown />} iconColor="bg-orange-50 text-orange-600" isLoading={isLoading} />
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">Available Reports</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {REPORT_LINKS.map((r) => {
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
