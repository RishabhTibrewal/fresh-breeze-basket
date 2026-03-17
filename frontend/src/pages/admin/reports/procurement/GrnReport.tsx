import React from 'react';
import { Truck, DollarSign, CheckCircle } from 'lucide-react';
import { ReportTable, type ReportColumn } from '@/components/reports/ReportTable';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ExportBar } from '@/components/reports/ExportBar';
import { KpiCard } from '@/components/reports/KpiCard';
import { useReport } from '@/hooks/useReport';
import { formatCurrency } from '@/lib/utils';

interface GrnReportRow {
  [key: string]: unknown;
  grn_id: string;
  grn_number: string;
  receipt_date: string;
  warehouse: string;
  total_received_amount: number;
  status: string;
  items_count: number;
}

const STATUS_COLORS: Record<string, string> = {
  completed:  'bg-emerald-100 text-emerald-700',
  inspected:  'bg-blue-100 text-blue-700',
  pending:    'bg-amber-100 text-amber-700',
  rejected:   'bg-red-100 text-red-600',
};

const COLUMNS: ReportColumn<GrnReportRow>[] = [
  { key: 'receipt_date',          label: 'Date',      sortable: true },
  { key: 'grn_number',            label: 'GRN #',     sortable: true, render: (v) => <span className="font-mono text-sm">{String(v)}</span> },
  { key: 'warehouse',             label: 'Branch' },
  { key: 'items_count',           label: '# Items',   align: 'right', render: (v) => Number(v).toLocaleString() },
  { key: 'total_received_amount', label: 'Value',     align: 'right', sortable: true, render: (v) => <span className="font-semibold">{formatCurrency(Number(v))}</span> },
  {
    key: 'status', label: 'Status',
    render: (v) => <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[String(v)] ?? 'bg-gray-100 text-gray-600'}`}>{String(v)}</span>,
  },
];

export default function GrnReport() {
  const { data, meta, summary, isLoading, isFetching, filters, setFilter, setFilters, resetFilters } =
    useReport<GrnReportRow>({ endpoint: '/reports/procurement/grn-report' });

  const totalRow: Partial<Record<string, React.ReactNode>> = {
    receipt_date:          <strong>Totals</strong>,
    total_received_amount: <strong>{formatCurrency(Number(summary.total_value ?? 0))}</strong>,
  };

  return (
    <div className="w-full space-y-5 px-4 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">GRN Report</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All goods receipt notes — by branch and period</p>
        </div>
        <ExportBar endpoint="/reports/procurement/grn-report" filters={filters} disabled={isLoading} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard title="Total GRNs"       value={(summary.total_grns as number ?? 0).toLocaleString()}             icon={<Truck />}       iconColor="bg-blue-50 text-blue-600"       isLoading={isLoading} />
        <KpiCard title="Total Value"      value={formatCurrency(Number(summary.total_value ?? 0))}                 icon={<DollarSign />}  iconColor="bg-emerald-50 text-emerald-600"  isLoading={isLoading} />
        <KpiCard title="Completed GRNs"   value={(summary.completed_grns as number ?? 0).toLocaleString()}         icon={<CheckCircle />} iconColor="bg-green-50 text-green-600"     isLoading={isLoading} />
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
        summaryRow={totalRow}
        emptyMessage="No GRNs found for the selected period."
      />
    </div>
  );
}
