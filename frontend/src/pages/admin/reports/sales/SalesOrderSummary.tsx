import React from 'react';
import { ShoppingCart, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ReportTable, type ReportColumn } from '@/components/reports/ReportTable';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ExportBar } from '@/components/reports/ExportBar';
import { KpiCard } from '@/components/reports/KpiCard';
import { useReport } from '@/hooks/useReport';
import { formatCurrency } from '@/lib/utils';

interface OrderRow {
  [key: string]: unknown;
  order_id: string;
  order_date: string;
  customer_name: string;
  warehouse: string;
  order_source: string;
  status: string;
  payment_status: string;
  payment_method: string;
  total_amount: number;
  tax_amount: number;
  net_amount: number;
}

const STATUS_COLORS: Record<string, string> = {
  delivered: 'bg-emerald-100 text-emerald-700',
  processing: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-indigo-100 text-indigo-700',
  packed:     'bg-violet-100 text-violet-700',
  pending:    'bg-amber-100 text-amber-700',
  cancelled:  'bg-red-100 text-red-700',
  returned:   'bg-gray-100 text-gray-600',
};

const COLUMNS: ReportColumn<OrderRow>[] = [
  { key: 'order_date', label: 'Date', sortable: true, render: (v) => String(v) },
  { key: 'order_id', label: 'Order ID', render: (v) => <span className="font-mono text-xs">{String(v).substring(0, 8)}…</span> },
  { key: 'customer_name', label: 'Customer', sortable: true },
  { key: 'warehouse', label: 'Branch' },
  { key: 'order_source', label: 'Source', render: (v) => <span className="capitalize">{String(v)}</span> },
  {
    key: 'status', label: 'Status', render: (v) => (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[String(v)] ?? 'bg-gray-100 text-gray-600'}`}>
        {String(v)}
      </span>
    ),
  },
  {
    key: 'payment_status', label: 'Payment', render: (v) => (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${v === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
        {String(v)}
      </span>
    ),
  },
  { key: 'total_amount', label: 'Amount', align: 'right', sortable: true, render: (v) => formatCurrency(Number(v)) },
  { key: 'tax_amount', label: 'Tax', align: 'right', render: (v) => formatCurrency(Number(v)) },
];

export default function SalesOrderSummary() {
  const {
    data, meta, summary, isLoading, isFetching, filters, setFilter, setFilters, resetFilters,
  } = useReport<OrderRow>({ endpoint: '/reports/sales/order-summary' });

  const totalRows: Partial<Record<string, React.ReactNode>> = {
    order_date: <strong>Totals</strong>,
    total_amount: <strong>{formatCurrency(Number(summary.total_revenue ?? 0))}</strong>,
    tax_amount: <strong>{formatCurrency(Number(summary.total_tax ?? 0))}</strong>,
  };

  return (
    <div className="w-full space-y-5 px-4 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Sales Order Summary</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Order-level breakdown for the selected period</p>
        </div>
        <ExportBar endpoint="/reports/sales/order-summary" filters={filters} disabled={isLoading} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="Total Orders"   value={(summary.total_orders as number ?? 0).toLocaleString()} icon={<ShoppingCart />} iconColor="bg-blue-50 text-blue-600"   isLoading={isLoading} />
        <KpiCard title="Total Revenue"  value={formatCurrency(Number(summary.total_revenue ?? 0))}    icon={<DollarSign />}   iconColor="bg-emerald-50 text-emerald-600" isLoading={isLoading} />
        <KpiCard title="Total Tax"      value={formatCurrency(Number(summary.total_tax ?? 0))}        icon={<DollarSign />}   iconColor="bg-amber-50 text-amber-600"  isLoading={isLoading} />
        <KpiCard title="Avg Order Value" value={formatCurrency(Number(summary.avg_order_value ?? 0))} icon={<DollarSign />}   iconColor="bg-violet-50 text-violet-600" isLoading={isLoading} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 p-3 bg-muted/30 border rounded-lg">
        <ReportFilters
          filters={filters}
          onFilterChange={setFilter}
          onReset={resetFilters}
          showSearch
        />
      </div>

      {/* Table */}
      <ReportTable
        columns={COLUMNS}
        data={data}
        isLoading={isLoading}
        isFetching={isFetching}
        meta={meta}
        sortBy={filters.sort_by}
        sortDir={filters.sort_dir}
        onPageChange={(page) => setFilter('page', page)}
        onSortChange={(key, dir) => setFilters({ sort_by: key, sort_dir: dir })}
        summaryRow={totalRows}
      />
    </div>
  );
}
