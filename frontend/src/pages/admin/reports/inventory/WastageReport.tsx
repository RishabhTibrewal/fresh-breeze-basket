import React from 'react';
import { TrendingDown, DollarSign, AlertTriangle } from 'lucide-react';
import { ReportTable, type ReportColumn } from '@/components/reports/ReportTable';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ExportBar } from '@/components/reports/ExportBar';
import { KpiCard } from '@/components/reports/KpiCard';
import { useReport } from '@/hooks/useReport';
import { formatCurrency } from '@/lib/utils';

interface WastageRow {
  [key: string]: unknown;
  repack_order_id: string;
  order_date: string;
  warehouse: string;
  input_product: string;
  input_qty: number;
  wastage_qty: number;
  wastage_pct: number;
  wastage_cost: number;
  status: string;
}

const COLUMNS: ReportColumn<WastageRow>[] = [
  { key: 'order_date',    label: 'Date',        sortable: true },
  { key: 'warehouse',     label: 'Branch' },
  { key: 'input_product', label: 'Product',     sortable: true },
  { key: 'input_qty',     label: 'Input Qty',   align: 'right', render: (v) => Number(v).toLocaleString() },
  {
    key: 'wastage_qty', label: 'Wastage Qty', align: 'right', sortable: true,
    render: (v) => <span className="font-mono text-red-600 font-semibold">{Number(v).toLocaleString()}</span>,
  },
  {
    key: 'wastage_pct', label: 'Wastage %',   align: 'right', sortable: true,
    render: (v) => {
      const pct = Number(v);
      const cls = pct > 10 ? 'text-red-600 font-bold' : pct > 5 ? 'text-amber-600 font-semibold' : 'text-yellow-600';
      return <span className={`font-mono ${cls}`}>{pct.toFixed(1)}%</span>;
    },
  },
  { key: 'wastage_cost',  label: 'Cost Lost',  align: 'right', sortable: true, render: (v) => formatCurrency(Number(v)) },
];

export default function WastageReport() {
  const { data, meta, summary, isLoading, isFetching, filters, setFilter, setFilters, resetFilters } =
    useReport<WastageRow>({ endpoint: '/reports/inventory/wastage' });

  const totalRows: Partial<Record<string, React.ReactNode>> = {
    order_date:   <strong>Totals</strong>,
    wastage_qty:  <strong className="text-red-600">{Number(summary.total_wastage_qty ?? 0).toLocaleString()}</strong>,
    wastage_cost: <strong>{formatCurrency(Number(summary.total_wastage_cost ?? 0))}</strong>,
  };

  return (
    <div className="w-full space-y-5 px-4 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Wastage Report</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Repack wastage breakdown — quantity and cost impact</p>
        </div>
        <ExportBar endpoint="/reports/inventory/wastage" filters={filters} disabled={isLoading} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard title="Total Wastage Qty"  value={`${(summary.total_wastage_qty as number ?? 0).toLocaleString()} units`} icon={<TrendingDown />}  iconColor="bg-red-50 text-red-600"         isLoading={isLoading} />
        <KpiCard title="Total Cost Lost"    value={formatCurrency(Number(summary.total_wastage_cost ?? 0))}                 icon={<DollarSign />}    iconColor="bg-amber-50 text-amber-600"     isLoading={isLoading} />
        <KpiCard title="Avg Wastage %"      value={`${Number(summary.avg_wastage_pct ?? 0).toFixed(1)}%`}                  icon={<AlertTriangle />} iconColor="bg-orange-50 text-orange-600"   isLoading={isLoading} />
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
        emptyMessage="No wastage recorded for the selected period."
      />
    </div>
  );
}
