import React from 'react';
import { RefreshCw, DollarSign, TrendingDown } from 'lucide-react';
import { ReportTable, type ReportColumn } from '@/components/reports/ReportTable';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ExportBar } from '@/components/reports/ExportBar';
import { KpiCard } from '@/components/reports/KpiCard';
import { useReport } from '@/hooks/useReport';
import { formatCurrency } from '@/lib/utils';

interface RepackSummaryRow {
  [key: string]: unknown;
  repack_order_id: string;
  order_date: string;
  warehouse: string;
  status: string;
  input_product: string;
  input_qty: number;
  output_product: string;
  output_qty: number;
  wastage_qty: number;
  wastage_pct: number;
  unit_cost: number;
  total_cost: number;
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-700',
  pending:   'bg-amber-100 text-amber-700',
  processing:'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-600',
};

const COLUMNS: ReportColumn<RepackSummaryRow>[] = [
  { key: 'order_date',    label: 'Date',        sortable: true },
  { key: 'warehouse',     label: 'Branch' },
  {
    key: 'status', label: 'Status',
    render: (v) => <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[String(v)] ?? 'bg-gray-100 text-gray-600'}`}>{String(v)}</span>,
  },
  { key: 'input_product', label: 'Input',       sortable: true },
  { key: 'input_qty',     label: 'In Qty',      align: 'right', render: (v) => Number(v).toLocaleString() },
  { key: 'output_product',label: 'Output' },
  { key: 'output_qty',    label: 'Out Qty',     align: 'right', render: (v) => Number(v).toLocaleString() },
  {
    key: 'wastage_pct', label: 'Wastage %',    align: 'right', sortable: true,
    render: (v) => {
      const pct = Number(v);
      const cls = pct > 10 ? 'text-red-600 font-semibold' : pct > 5 ? 'text-amber-600' : 'text-emerald-600';
      return <span className={`font-mono ${cls}`}>{pct.toFixed(1)}%</span>;
    },
  },
  { key: 'total_cost',    label: 'Total Cost',  align: 'right', sortable: true, render: (v) => formatCurrency(Number(v)) },
];

export default function RepackSummary() {
  const { data, meta, summary, isLoading, isFetching, filters, setFilter, setFilters, resetFilters } =
    useReport<RepackSummaryRow>({ endpoint: '/reports/inventory/repack-summary' });

  const totalRows: Partial<Record<string, React.ReactNode>> = {
    order_date: <strong>Totals</strong>,
    total_cost: <strong>{formatCurrency(Number(summary.total_cost ?? 0))}</strong>,
  };

  return (
    <div className="w-full space-y-5 px-4 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Repack / Job Work Summary</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Input → output conversion with wastage and cost tracking</p>
        </div>
        <ExportBar endpoint="/reports/inventory/repack-summary" filters={filters} disabled={isLoading} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="Repack Orders"   value={(summary.total_repack_orders as number ?? 0)}                              icon={<RefreshCw />}   iconColor="bg-violet-50 text-violet-600"  isLoading={isLoading} />
        <KpiCard title="Total Cost"      value={formatCurrency(Number(summary.total_cost ?? 0))}                           icon={<DollarSign />}  iconColor="bg-emerald-50 text-emerald-600" isLoading={isLoading} />
        <KpiCard title="Total Wastage"   value={`${(summary.total_wastage_qty as number ?? 0).toLocaleString()} units`}   icon={<TrendingDown />} iconColor="bg-amber-50 text-amber-600"    isLoading={isLoading} />
        <KpiCard title="Avg Wastage %"  value={`${Number(summary.avg_wastage_pct ?? 0).toFixed(1)}%`}                    icon={<TrendingDown />} iconColor="bg-red-50 text-red-600"        isLoading={isLoading} />
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
        summaryRow={totalRows}
      />
    </div>
  );
}
