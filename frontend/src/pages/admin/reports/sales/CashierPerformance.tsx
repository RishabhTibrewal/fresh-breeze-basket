import React from 'react';
import { UserCheck, Clock, TrendingUp, Wallet } from 'lucide-react';
import { ReportTable, type ReportColumn } from '@/components/reports/ReportTable';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ExportBar } from '@/components/reports/ExportBar';
import { KpiCard } from '@/components/reports/KpiCard';
import { Badge } from '@/components/ui/badge';
import { useReport } from '@/hooks/useReport';
import { formatCurrency } from '@/lib/utils';
import type { CashierPerformanceRow } from '@/api/reports';

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

const COLUMNS: ReportColumn<CashierPerformanceRow & Record<string, unknown>>[] = [
  { key: 'cashier_name', label: 'Cashier', render: (v) => <span className="font-medium">{String(v)}</span> },
  { key: 'outlet_name', label: 'Outlet' },
  {
    key: 'status',
    label: 'Status',
    render: (v) => {
      const s = String(v).toLowerCase();
      const variant = s === 'open' ? 'default' : s === 'closed' ? 'secondary' : 'outline';
      return <Badge variant={variant as any} className="capitalize">{s}</Badge>;
    },
  },
  { key: 'opened_at', label: 'Opened', render: (v) => formatDateTime(v as string) },
  { key: 'closed_at', label: 'Closed', render: (v) => formatDateTime(v as string | null) },
  { key: 'duration_min', label: 'Duration', align: 'right', render: (v) => `${Number(v)} min` },
  { key: 'orders_count', label: 'Orders', align: 'right', render: (v) => Number(v).toLocaleString() },
  { key: 'gross_sales', label: 'Sales', align: 'right', sortable: true, render: (v) => <span className="font-semibold">{formatCurrency(Number(v))}</span> },
  { key: 'avg_ticket', label: 'Avg Ticket', align: 'right', render: (v) => formatCurrency(Number(v)) },
  {
    key: 'cash_variance',
    label: 'Cash Variance',
    align: 'right',
    render: (v) => {
      if (v === null || v === undefined) return <span className="text-muted-foreground">—</span>;
      const n = Number(v);
      const cls = n === 0 ? 'text-muted-foreground' : n > 0 ? 'text-emerald-600' : 'text-red-600';
      return <span className={`font-medium ${cls}`}>{n > 0 ? '+' : ''}{formatCurrency(n)}</span>;
    },
  },
];

export default function CashierPerformance() {
  const { data, meta, summary, isLoading, isFetching, filters, setFilter, setFilters, resetFilters } =
    useReport<CashierPerformanceRow>({ endpoint: '/reports/sales/cashier-performance' });

  return (
    <div className="w-full space-y-5 px-4 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Cashier / Session Performance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            POS session productivity, cash-up accuracy, and throughput
          </p>
        </div>
        <ExportBar endpoint="/reports/sales/cashier-performance" filters={filters} disabled={isLoading} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="Sessions"
          value={Number(summary.total_sessions ?? 0).toLocaleString()}
          icon={<Clock />}
          iconColor="bg-blue-50 text-blue-600"
          isLoading={isLoading}
        />
        <KpiCard
          title="Orders"
          value={Number(summary.total_orders ?? 0).toLocaleString()}
          icon={<UserCheck />}
          iconColor="bg-violet-50 text-violet-600"
          isLoading={isLoading}
        />
        <KpiCard
          title="Total Sales"
          value={formatCurrency(Number(summary.total_sales ?? 0))}
          subtitle={`Avg ticket ${formatCurrency(Number(summary.avg_ticket ?? 0))}`}
          icon={<TrendingUp />}
          iconColor="bg-emerald-50 text-emerald-600"
          isLoading={isLoading}
        />
        <KpiCard
          title="Cash Variance"
          value={formatCurrency(Number(summary.total_cash_variance ?? 0))}
          icon={<Wallet />}
          iconColor={Number(summary.total_cash_variance ?? 0) < 0 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}
          isLoading={isLoading}
        />
      </div>

      <div className="flex flex-wrap gap-2 p-3 bg-muted/30 border rounded-lg">
        <ReportFilters filters={filters} onFilterChange={setFilter} onReset={resetFilters} />
      </div>

      <ReportTable
        columns={COLUMNS}
        data={data as (CashierPerformanceRow & Record<string, unknown>)[]}
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
