import React from 'react';
import { TrendingUp, TrendingDown, ArrowUpDown } from 'lucide-react';
import { ReportTable, type ReportColumn } from '@/components/reports/ReportTable';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ExportBar } from '@/components/reports/ExportBar';
import { KpiCard } from '@/components/reports/KpiCard';
import { useReport } from '@/hooks/useReport';
import { formatCurrency } from '@/lib/utils';

interface CashFlowRow {
  [key: string]: unknown;
  period: string;
  inflows: number;
  outflows: number;
  net_cash_flow: number;
}

const COLUMNS: ReportColumn<CashFlowRow>[] = [
  { key: 'period',        label: 'Period',        sortable: true },
  { key: 'inflows',       label: 'Inflows',       align: 'right', sortable: true, render: (v) => <span className="text-emerald-700 font-semibold">{formatCurrency(Number(v))}</span> },
  { key: 'outflows',      label: 'Outflows',      align: 'right', render: (v) => <span className="text-red-600">{formatCurrency(Number(v))}</span> },
  {
    key: 'net_cash_flow', label: 'Net Cash Flow', align: 'right', sortable: true,
    render: (v) => {
      const n = Number(v);
      return <span className={`font-semibold font-mono ${n >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatCurrency(n)}</span>;
    },
  },
];

export default function CashFlowSummary() {
  const { data, meta, summary, isLoading, isFetching, filters, setFilter, setFilters, resetFilters } =
    useReport<CashFlowRow>({ endpoint: '/reports/accounting/cash-flow' });

  const totalRow: Partial<Record<string, React.ReactNode>> = {
    period:        <strong>Totals</strong>,
    inflows:       <strong className="text-emerald-700">{formatCurrency(Number(summary.total_inflows ?? 0))}</strong>,
    outflows:      <strong className="text-red-600">{formatCurrency(Number(summary.total_outflows ?? 0))}</strong>,
    net_cash_flow: <strong>{formatCurrency(Number(summary.net_cash_flow ?? 0))}</strong>,
  };

  return (
    <div className="w-full space-y-5 px-4 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Cash Flow Summary</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Monthly inflows (customer payments) vs outflows (supplier payments)</p>
        </div>
        <ExportBar endpoint="/reports/accounting/cash-flow" filters={filters} disabled={isLoading} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard title="Total Inflows"    value={formatCurrency(Number(summary.total_inflows ?? 0))}   icon={<TrendingUp />}  iconColor="bg-emerald-50 text-emerald-600" isLoading={isLoading} />
        <KpiCard title="Total Outflows"   value={formatCurrency(Number(summary.total_outflows ?? 0))}  icon={<TrendingDown />} iconColor="bg-red-50 text-red-600"        isLoading={isLoading} />
        <KpiCard title="Net Cash Flow"    value={formatCurrency(Number(summary.net_cash_flow ?? 0))}   icon={<ArrowUpDown />} iconColor="bg-blue-50 text-blue-600"      isLoading={isLoading} />
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
        emptyMessage="No cash flow data for the selected period."
      />
    </div>
  );
}
