import React from 'react';
import { Trophy, TrendingUp, TrendingDown, Store } from 'lucide-react';
import { ReportTable, type ReportColumn } from '@/components/reports/ReportTable';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ExportBar } from '@/components/reports/ExportBar';
import { KpiCard } from '@/components/reports/KpiCard';
import { useReport } from '@/hooks/useReport';
import { formatCurrency, cn } from '@/lib/utils';
import type { OutletLeaderboardRow } from '@/api/reports';

const COLUMNS: ReportColumn<OutletLeaderboardRow & Record<string, unknown>>[] = [
  {
    key: 'rank',
    label: '#',
    align: 'right',
    render: (v) => <span className="font-semibold text-muted-foreground">{Number(v)}</span>,
  },
  { key: 'outlet_name', label: 'Outlet', render: (v) => <span className="font-medium">{String(v)}</span> },
  { key: 'current_revenue', label: 'Revenue', align: 'right', sortable: true, render: (v) => <span className="font-semibold">{formatCurrency(Number(v))}</span> },
  { key: 'previous_revenue', label: 'Prev Revenue', align: 'right', render: (v) => <span className="text-muted-foreground">{formatCurrency(Number(v))}</span> },
  {
    key: 'revenue_delta_pct',
    label: 'Revenue Δ %',
    align: 'right',
    render: (v) => {
      const n = Number(v);
      return <span className={cn('font-medium', n > 0 ? 'text-emerald-600' : n < 0 ? 'text-red-600' : 'text-muted-foreground')}>{`${n > 0 ? '+' : ''}${n.toFixed(1)}%`}</span>;
    },
  },
  { key: 'current_orders', label: 'Orders', align: 'right', render: (v) => Number(v).toLocaleString() },
  {
    key: 'orders_delta_pct',
    label: 'Orders Δ %',
    align: 'right',
    render: (v) => {
      const n = Number(v);
      return <span className={cn('font-medium', n > 0 ? 'text-emerald-600' : n < 0 ? 'text-red-600' : 'text-muted-foreground')}>{`${n > 0 ? '+' : ''}${n.toFixed(1)}%`}</span>;
    },
  },
  { key: 'avg_ticket', label: 'Avg Ticket', align: 'right', render: (v) => formatCurrency(Number(v)) },
  { key: 'items_per_order', label: 'Items/Order', align: 'right', render: (v) => Number(v).toFixed(2) },
];

export default function OutletLeaderboard() {
  const { data, meta, summary, isLoading, isFetching, filters, setFilter, setFilters, resetFilters } =
    useReport<OutletLeaderboardRow>({ endpoint: '/reports/sales/outlet-leaderboard' });

  const revenueDelta = Number(summary.revenue_delta_pct ?? 0);

  return (
    <div className="w-full space-y-5 px-4 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Outlet Leaderboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Outlet-by-outlet comparison vs previous equivalent period
            {summary.period_from && summary.previous_from ? (
              <> · {String(summary.period_from)} → {String(summary.period_to)} <span className="text-muted-foreground/70">vs {String(summary.previous_from)} → {String(summary.previous_to)}</span></>
            ) : null}
          </p>
        </div>
        <ExportBar endpoint="/reports/sales/outlet-leaderboard" filters={filters} disabled={isLoading} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="Top Outlet"
          value={String(summary.top_outlet ?? '—')}
          icon={<Trophy />}
          iconColor="bg-amber-50 text-amber-600"
          isLoading={isLoading}
        />
        <KpiCard
          title="Outlets Active"
          value={Number(summary.outlets_active ?? 0).toLocaleString()}
          icon={<Store />}
          iconColor="bg-indigo-50 text-indigo-600"
          isLoading={isLoading}
        />
        <KpiCard
          title="Total Revenue"
          value={formatCurrency(Number(summary.total_revenue ?? 0))}
          subtitle={`Prev: ${formatCurrency(Number(summary.total_revenue_prev ?? 0))}`}
          icon={revenueDelta >= 0 ? <TrendingUp /> : <TrendingDown />}
          iconColor={revenueDelta >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}
          trend={revenueDelta}
          isLoading={isLoading}
        />
        <KpiCard
          title="Revenue Δ"
          value={`${revenueDelta > 0 ? '+' : ''}${revenueDelta.toFixed(1)}%`}
          icon={<TrendingUp />}
          iconColor={revenueDelta >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}
          isLoading={isLoading}
        />
      </div>

      <div className="flex flex-wrap gap-2 p-3 bg-muted/30 border rounded-lg">
        <ReportFilters filters={filters} onFilterChange={setFilter} onReset={resetFilters} />
      </div>

      <ReportTable
        columns={COLUMNS}
        data={data as (OutletLeaderboardRow & Record<string, unknown>)[]}
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
