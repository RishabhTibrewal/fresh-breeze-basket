import React from 'react';
import { Target, TrendingUp, TrendingDown, Users } from 'lucide-react';
import { ReportTable, type ReportColumn } from '@/components/reports/ReportTable';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ExportBar } from '@/components/reports/ExportBar';
import { KpiCard } from '@/components/reports/KpiCard';
import { useReport } from '@/hooks/useReport';
import { formatCurrency } from '@/lib/utils';

interface TargetRow {
  [key: string]: unknown;
  executive_id: string;
  executive_name: string;
  period_type: string;
  period_start: string;
  period_end: string;
  target_amount: number;
  achieved_amount: number;
  variance: number;
  achievement_pct: number;
  status: 'achieved' | 'below_target' | 'no_target';
}

const PERIOD_LABELS: Record<string, string> = {
  monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly',
};

const COLUMNS: ReportColumn<TargetRow>[] = [
  { key: 'executive_name', label: 'Salesperson', sortable: true },
  { key: 'period_type',    label: 'Period',      render: (v) => PERIOD_LABELS[String(v)] ?? String(v) },
  { key: 'period_start',   label: 'From',        render: (v) => String(v) },
  { key: 'period_end',     label: 'To',          render: (v) => String(v) },
  { key: 'target_amount',   label: 'Target',     align: 'right', sortable: true, render: (v) => formatCurrency(Number(v)) },
  { key: 'achieved_amount', label: 'Achieved',   align: 'right', sortable: true, render: (v) => formatCurrency(Number(v)) },
  {
    key: 'variance', label: 'Variance', align: 'right',
    render: (v) => {
      const n = Number(v);
      const cls = n >= 0 ? 'text-emerald-600' : 'text-red-500';
      return <span className={`font-mono font-medium ${cls}`}>{n >= 0 ? '+' : ''}{formatCurrency(n)}</span>;
    },
  },
  {
    key: 'achievement_pct', label: 'Achievement', align: 'right', sortable: true,
    render: (v, row) => {
      const pct = Number(v);
      const cls = pct >= 100 ? 'text-emerald-600 bg-emerald-50' : pct >= 75 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50';
      const Icon = pct >= 100 ? TrendingUp : TrendingDown;
      return (
        <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
          <Icon className="h-3 w-3" />
          {pct.toFixed(1)}%
        </span>
      );
    },
  },
  {
    key: 'status', label: 'Status',
    render: (v) => {
      const map = { achieved: 'bg-emerald-100 text-emerald-700', below_target: 'bg-amber-100 text-amber-700', no_target: 'bg-gray-100 text-gray-600' };
      const labels = { achieved: 'On Target', below_target: 'Below Target', no_target: 'No Target' };
      return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[String(v) as keyof typeof map] ?? ''}`}>{labels[String(v) as keyof typeof labels] ?? String(v)}</span>;
    },
  },
];

export default function TargetVsAchievement() {
  const { data, meta, summary, isLoading, isFetching, filters, setFilter, setFilters, resetFilters } =
    useReport<TargetRow>({ endpoint: '/reports/sales/target-vs-achievement' });

  return (
    <div className="w-full space-y-5 px-4 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Target vs Achievement</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Sales target performance against actual revenue</p>
        </div>
        <ExportBar endpoint="/reports/sales/target-vs-achievement" filters={filters} disabled={isLoading} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="Targets Set"       value={(summary.total_targets as number ?? 0)}            icon={<Target />}      iconColor="bg-blue-50 text-blue-600"      isLoading={isLoading} />
        <KpiCard title="Total Target"      value={formatCurrency(Number(summary.total_target_amount ?? 0))}  icon={<Target />}      iconColor="bg-violet-50 text-violet-600"  isLoading={isLoading} />
        <KpiCard title="Total Achieved"    value={formatCurrency(Number(summary.total_achieved ?? 0))}       icon={<TrendingUp />}  iconColor="bg-emerald-50 text-emerald-600" isLoading={isLoading} />
        <KpiCard title="On Target"         value={(summary.executives_on_target as number ?? 0)}             icon={<Users />}       iconColor="bg-amber-50 text-amber-600"    isLoading={isLoading} />
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
