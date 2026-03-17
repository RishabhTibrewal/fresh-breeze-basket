import React from 'react';
import { Users, DollarSign, TrendingUp } from 'lucide-react';
import { ReportTable, type ReportColumn } from '@/components/reports/ReportTable';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ExportBar } from '@/components/reports/ExportBar';
import { KpiCard } from '@/components/reports/KpiCard';
import { useReport } from '@/hooks/useReport';
import { formatCurrency } from '@/lib/utils';

interface CustomerRow {
  [key: string]: unknown;
  customer_id: string;
  customer_name: string;
  email: string;
  phone: string;
  total_orders: number;
  total_revenue: number;
  avg_order_value: number;
  last_order_date: string;
}

const COLUMNS: ReportColumn<CustomerRow>[] = [
  {
    key: 'customer_name', label: 'Customer', sortable: true,
    render: (v, row) => (
      <div>
        <p className="font-medium text-sm">{String(v)}</p>
        <p className="text-xs text-muted-foreground">{row.email}</p>
      </div>
    ),
  },
  { key: 'phone',          label: 'Phone',       render: (v) => String(v) || '—' },
  { key: 'total_orders',   label: 'Orders',      align: 'right', sortable: true, render: (v) => Number(v).toLocaleString() },
  { key: 'total_revenue',  label: 'Revenue',     align: 'right', sortable: true, render: (v) => formatCurrency(Number(v)) },
  { key: 'avg_order_value',label: 'Avg Order',   align: 'right', render: (v) => formatCurrency(Number(v)) },
  { key: 'last_order_date',label: 'Last Order',  sortable: true },
];

export default function CustomerWiseSales() {
  const { data, meta, summary, isLoading, isFetching, filters, setFilter, setFilters, resetFilters } =
    useReport<CustomerRow>({ endpoint: '/reports/sales/customer-wise' });

  return (
    <div className="w-full space-y-5 px-4 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Customer-wise Sales</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Revenue and order breakdown per customer</p>
        </div>
        <ExportBar endpoint="/reports/sales/customer-wise" filters={filters} disabled={isLoading} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard title="Total Customers"        value={(summary.total_customers as number ?? 0).toLocaleString()}    icon={<Users />}      iconColor="bg-blue-50 text-blue-600"      isLoading={isLoading} />
        <KpiCard title="Total Revenue"          value={formatCurrency(Number(summary.total_revenue ?? 0))}           icon={<DollarSign />} iconColor="bg-emerald-50 text-emerald-600" isLoading={isLoading} />
        <KpiCard title="Avg Revenue / Customer" value={formatCurrency(Number(summary.avg_revenue_per_customer ?? 0))} icon={<TrendingUp />} iconColor="bg-amber-50 text-amber-600"    isLoading={isLoading} />
      </div>

      <div className="flex flex-wrap gap-2 p-3 bg-muted/30 border rounded-lg">
        <ReportFilters filters={filters} onFilterChange={setFilter} onReset={resetFilters} showSearch />
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
