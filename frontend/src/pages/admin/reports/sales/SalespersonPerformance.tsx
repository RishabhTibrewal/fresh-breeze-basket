import React from 'react';
import { Users, DollarSign, Target, TrendingUp } from 'lucide-react';
import { ReportTable, type ReportColumn } from '@/components/reports/ReportTable';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ExportBar } from '@/components/reports/ExportBar';
import { KpiCard } from '@/components/reports/KpiCard';
import { useReport } from '@/hooks/useReport';
import { formatCurrency } from '@/lib/utils';

interface SalespersonRow {
  [key: string]: unknown;
  executive_id: string;
  executive_name: string;
  executive_email: string;
  total_orders: number;
  total_revenue: number;
  avg_order_value: number;
  unique_customers: number;
  target_amount: number;
  achievement_pct: number;
}

const COLUMNS: ReportColumn<SalespersonRow>[] = [
  {
    key: 'executive_name', label: 'Salesperson', sortable: true,
    render: (v, row) => (
      <div>
        <p className="font-medium text-sm">{String(v)}</p>
        <p className="text-xs text-muted-foreground">{row.executive_email}</p>
      </div>
    ),
  },
  { key: 'total_orders',     label: 'Orders',      align: 'right', sortable: true, render: (v) => Number(v).toLocaleString() },
  { key: 'unique_customers', label: 'Customers',   align: 'right', render: (v) => Number(v).toLocaleString() },
  { key: 'total_revenue',    label: 'Revenue',     align: 'right', sortable: true, render: (v) => formatCurrency(Number(v)) },
  { key: 'avg_order_value',  label: 'Avg Order',   align: 'right', render: (v) => formatCurrency(Number(v)) },
  { key: 'target_amount',    label: 'Target',      align: 'right', render: (v) => formatCurrency(Number(v)) },
  {
    key: 'achievement_pct', label: 'Achievement', align: 'right', sortable: true,
    render: (v) => {
      const pct = Number(v);
      const color = pct >= 100 ? 'text-emerald-600 bg-emerald-50' : pct >= 75 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50';
      return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
          {pct.toFixed(1)}%
        </span>
      );
    },
  },
];

export default function SalespersonPerformance() {
  const { data, meta, summary, isLoading, isFetching, filters, setFilter, setFilters, resetFilters } =
    useReport<SalespersonRow>({ endpoint: '/reports/sales/salesperson-performance' });

  return (
    <div className="w-full space-y-5 px-4 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Salesperson Performance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Revenue, orders, and target achievement per salesperson</p>
        </div>
        <ExportBar endpoint="/reports/sales/salesperson-performance" filters={filters} disabled={isLoading} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="Active Salespeople"  value={(summary.total_executives as number ?? 0)} icon={<Users />}      iconColor="bg-violet-50 text-violet-600"  isLoading={isLoading} />
        <KpiCard title="Total Revenue"       value={formatCurrency(Number(summary.total_revenue ?? 0))} icon={<DollarSign />} iconColor="bg-emerald-50 text-emerald-600" isLoading={isLoading} />
        <KpiCard title="Avg Achievement"     value={`${Number(summary.avg_achievement_pct ?? 0).toFixed(1)}%`} icon={<Target />}    iconColor="bg-amber-50 text-amber-600"    isLoading={isLoading} />
        <KpiCard title="On Target"           value={data.filter(r => r.achievement_pct >= 100).length} icon={<TrendingUp />} iconColor="bg-blue-50 text-blue-600"      isLoading={isLoading} />
      </div>

      <div className="flex flex-wrap gap-2 p-3 bg-muted/30 border rounded-lg">
        <ReportFilters filters={filters} onFilterChange={setFilter} onReset={resetFilters} />
      </div>

      <ReportTable
        columns={COLUMNS}
        data={data}
        isLoading={isLoading}
        isFetching={isFetching}
        meta={meta}
        sortBy={filters.sort_by}
        sortDir={filters.sort_dir}
        onPageChange={(p) => setFilter('page', p)}
        onSortChange={(k, d) => setFilters({ sort_by: k, sort_dir: d })}
      />
    </div>
  );
}
