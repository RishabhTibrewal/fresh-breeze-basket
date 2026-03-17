import React from 'react';
import { Activity } from 'lucide-react';
import { ReportTable, type ReportColumn } from '@/components/reports/ReportTable';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ExportBar } from '@/components/reports/ExportBar';
import { KpiCard } from '@/components/reports/KpiCard';
import { useReport } from '@/hooks/useReport';

interface ActivityRow {
  [key: string]: unknown;
  changed_at: string;
  order_id: string;
  from_status: string;
  to_status: string;
  changed_by: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending:    'bg-amber-100 text-amber-700',
  confirmed:  'bg-blue-100 text-blue-700',
  processing: 'bg-violet-100 text-violet-700',
  delivered:  'bg-emerald-100 text-emerald-700',
  completed:  'bg-green-100 text-green-700',
  cancelled:  'bg-red-100 text-red-600',
  returned:   'bg-gray-100 text-gray-600',
};

const statusPill = (v: unknown) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[String(v)] ?? 'bg-gray-100 text-gray-600'}`}>{String(v)}</span>
);

const COLUMNS: ReportColumn<ActivityRow>[] = [
  { key: 'changed_at',   label: 'Date',        sortable: true },
  { key: 'order_id',     label: 'Order',        render: (v) => <span className="font-mono text-xs">{String(v).substring(0, 8)}…</span> },
  { key: 'from_status',  label: 'From',         render: statusPill },
  { key: 'to_status',    label: 'To',           render: statusPill },
  { key: 'changed_by',   label: 'By',           sortable: false },
];

export default function ActivityLog() {
  const { data, meta, summary, isLoading, isFetching, filters, setFilter, setFilters, resetFilters } =
    useReport<ActivityRow>({ endpoint: '/reports/master/activity' });

  return (
    <div className="w-full space-y-5 px-4 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Activity Audit Log</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Order status changes and user activity</p>
        </div>
        <ExportBar endpoint="/reports/master/activity" filters={filters} disabled={isLoading} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-1 gap-3">
        <KpiCard title="Total Events" value={(summary.total_events as number ?? 0).toLocaleString()} icon={<Activity />} iconColor="bg-red-50 text-red-600" isLoading={isLoading} />
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
        emptyMessage="No activity recorded for the selected period."
      />
    </div>
  );
}
