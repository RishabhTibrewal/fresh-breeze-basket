import React, { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, ArrowUp, ArrowDown } from 'lucide-react';
import { ReportTable, type ReportColumn } from '@/components/reports/ReportTable';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ExportBar } from '@/components/reports/ExportBar';
import { KpiCard } from '@/components/reports/KpiCard';
import { Badge } from '@/components/ui/badge';
import { useReport } from '@/hooks/useReport';
import { formatCurrency, cn } from '@/lib/utils';
import type { MoverRow } from '@/api/reports';

type Focus = 'top' | 'bottom';

const COLUMNS: ReportColumn<MoverRow & Record<string, unknown>>[] = [
  { key: 'product_name', label: 'Product', render: (v) => <span className="font-medium">{String(v)}</span> },
  { key: 'sku', label: 'SKU' },
  { key: 'current_qty', label: 'Qty', align: 'right', render: (v) => Number(v).toLocaleString() },
  { key: 'previous_qty', label: 'Prev Qty', align: 'right', render: (v) => Number(v).toLocaleString() },
  {
    key: 'qty_delta_pct',
    label: 'Qty Δ %',
    align: 'right',
    render: (v) => {
      const n = Number(v);
      return <span className={cn('font-medium', n > 0 ? 'text-emerald-600' : n < 0 ? 'text-red-600' : 'text-muted-foreground')}>{`${n > 0 ? '+' : ''}${n.toFixed(1)}%`}</span>;
    },
  },
  { key: 'current_revenue', label: 'Revenue', align: 'right', render: (v) => formatCurrency(Number(v)) },
  { key: 'previous_revenue', label: 'Prev Revenue', align: 'right', render: (v) => formatCurrency(Number(v)) },
  {
    key: 'revenue_delta',
    label: 'Δ Revenue',
    align: 'right',
    sortable: true,
    render: (v) => {
      const n = Number(v);
      return <span className={cn('font-semibold', n > 0 ? 'text-emerald-600' : n < 0 ? 'text-red-600' : 'text-muted-foreground')}>{`${n > 0 ? '+' : ''}${formatCurrency(n)}`}</span>;
    },
  },
  {
    key: 'direction',
    label: 'Trend',
    render: (v) => {
      const d = String(v);
      const Icon = d === 'up' ? ArrowUp : d === 'down' ? ArrowDown : null;
      const cls = d === 'up' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : d === 'down' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-muted text-muted-foreground';
      return (
        <Badge variant="outline" className={cls}>
          {Icon ? <Icon className="h-3 w-3 mr-1" /> : null}
          <span className="capitalize">{d}</span>
        </Badge>
      );
    },
  },
];

export default function TopBottomMovers() {
  const { data, meta, summary, isLoading, isFetching, filters, setFilter, setFilters, resetFilters } =
    useReport<MoverRow>({ endpoint: '/reports/sales/movers' });

  const [focus, setFocus] = useState<Focus>('top');

  const rows = useMemo(() => {
    const base = [...(data as MoverRow[])];
    return focus === 'top'
      ? base.sort((a, b) => b.revenue_delta - a.revenue_delta)
      : base.sort((a, b) => a.revenue_delta - b.revenue_delta);
  }, [data, focus]);

  return (
    <div className="w-full space-y-5 px-4 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Top / Bottom Movers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Fastest-growing and fastest-declining SKUs vs previous equivalent period
            {summary.period_from && summary.previous_from ? (
              <> · {String(summary.period_from)} → {String(summary.period_to)} <span className="text-muted-foreground/70">vs {String(summary.previous_from)} → {String(summary.previous_to)}</span></>
            ) : null}
          </p>
        </div>
        <ExportBar endpoint="/reports/sales/movers" filters={filters} disabled={isLoading} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="SKUs tracked"
          value={Number(summary.skus_tracked ?? 0).toLocaleString()}
          icon={<TrendingUp />}
          iconColor="bg-indigo-50 text-indigo-600"
          isLoading={isLoading}
        />
        <KpiCard
          title="Gainers"
          value={Number(summary.gainers ?? 0).toLocaleString()}
          icon={<ArrowUp />}
          iconColor="bg-emerald-50 text-emerald-600"
          isLoading={isLoading}
        />
        <KpiCard
          title="Decliners"
          value={Number(summary.decliners ?? 0).toLocaleString()}
          icon={<ArrowDown />}
          iconColor="bg-red-50 text-red-600"
          isLoading={isLoading}
        />
        <KpiCard
          title="Top Gainer"
          value={String(summary.top_gainer ?? '—')}
          subtitle={`Decliner: ${String(summary.top_decliner ?? '—')}`}
          icon={<TrendingDown />}
          iconColor="bg-violet-50 text-violet-600"
          isLoading={isLoading}
        />
      </div>

      <div className="flex flex-wrap gap-2 p-3 bg-muted/30 border rounded-lg">
        <ReportFilters filters={filters} onFilterChange={setFilter} onReset={resetFilters} />
      </div>

      <div className="flex items-center gap-2">
        <button
          className={cn(
            'px-3 py-1.5 text-sm rounded-md border',
            focus === 'top' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-muted',
          )}
          onClick={() => setFocus('top')}
        >
          Top Movers
        </button>
        <button
          className={cn(
            'px-3 py-1.5 text-sm rounded-md border',
            focus === 'bottom' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-muted',
          )}
          onClick={() => setFocus('bottom')}
        >
          Bottom Movers
        </button>
      </div>

      <ReportTable
        columns={COLUMNS}
        data={rows as (MoverRow & Record<string, unknown>)[]}
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
