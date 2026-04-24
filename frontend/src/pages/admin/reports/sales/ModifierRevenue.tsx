import React from 'react';
import { PlusCircle, Tags, Percent, Wallet } from 'lucide-react';
import { ReportTable, type ReportColumn } from '@/components/reports/ReportTable';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ExportBar } from '@/components/reports/ExportBar';
import { KpiCard } from '@/components/reports/KpiCard';
import { useReport } from '@/hooks/useReport';
import { formatCurrency } from '@/lib/utils';
import type { ModifierRevenueRow } from '@/api/reports';

const COLUMNS: ReportColumn<ModifierRevenueRow & Record<string, unknown>>[] = [
  { key: 'modifier_name', label: 'Modifier', render: (v) => <span className="font-medium">{String(v)}</span> },
  { key: 'group_name', label: 'Group' },
  { key: 'attach_count', label: 'Attached', align: 'right', render: (v) => Number(v).toLocaleString() },
  { key: 'orders_attached', label: 'Orders', align: 'right', render: (v) => Number(v).toLocaleString() },
  { key: 'total_adjust', label: 'Revenue', align: 'right', sortable: true, render: (v) => <span className="font-semibold">{formatCurrency(Number(v))}</span> },
  { key: 'avg_adjust', label: 'Avg Add-on', align: 'right', render: (v) => formatCurrency(Number(v)) },
  {
    key: 'attach_rate_pct',
    label: 'Attach Rate',
    align: 'right',
    render: (v) => {
      const n = Number(v);
      const cls = n >= 40 ? 'text-emerald-600' : n >= 15 ? 'text-amber-600' : 'text-muted-foreground';
      return <span className={`font-medium ${cls}`}>{n.toFixed(1)}%</span>;
    },
  },
];

export default function ModifierRevenue() {
  const { data, meta, summary, isLoading, isFetching, filters, setFilter, setFilters, resetFilters } =
    useReport<ModifierRevenueRow>({ endpoint: '/reports/sales/modifier-revenue' });

  return (
    <div className="w-full space-y-5 px-4 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Modifier / Add-on Revenue</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Upsell performance by modifier, group, and attach rate
          </p>
        </div>
        <ExportBar endpoint="/reports/sales/modifier-revenue" filters={filters} disabled={isLoading} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="Modifier Revenue"
          value={formatCurrency(Number(summary.total_adjust ?? 0))}
          icon={<Wallet />}
          iconColor="bg-indigo-50 text-indigo-600"
          isLoading={isLoading}
        />
        <KpiCard
          title="Total Attachments"
          value={Number(summary.total_attach_count ?? 0).toLocaleString()}
          icon={<PlusCircle />}
          iconColor="bg-emerald-50 text-emerald-600"
          isLoading={isLoading}
        />
        <KpiCard
          title="Orders w/ Add-ons"
          value={Number(summary.orders_with_modifiers ?? 0).toLocaleString()}
          subtitle={`of ${Number(summary.total_orders ?? 0).toLocaleString()} orders`}
          icon={<Tags />}
          iconColor="bg-amber-50 text-amber-600"
          isLoading={isLoading}
        />
        <KpiCard
          title="Overall Attach %"
          value={`${Number(summary.attach_rate_pct ?? 0).toFixed(1)}%`}
          icon={<Percent />}
          iconColor="bg-violet-50 text-violet-600"
          isLoading={isLoading}
        />
      </div>

      <div className="flex flex-wrap gap-2 p-3 bg-muted/30 border rounded-lg">
        <ReportFilters filters={filters} onFilterChange={setFilter} onReset={resetFilters} />
      </div>

      <ReportTable
        columns={COLUMNS}
        data={data as (ModifierRevenueRow & Record<string, unknown>)[]}
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
