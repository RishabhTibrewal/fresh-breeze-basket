import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, BarChart3 } from 'lucide-react';
import { ReportTable, type ReportColumn } from '@/components/reports/ReportTable';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ExportBar } from '@/components/reports/ExportBar';
import { KpiCard } from '@/components/reports/KpiCard';
import { useReport } from '@/hooks/useReport';
import { formatCurrency } from '@/lib/utils';

interface RevenueExpenseRow {
  [key: string]: unknown;
  period: string;
  revenue: number;
  purchase_cost: number;
  gross_profit: number;
  gross_margin_pct: number;
}

const COLUMNS: ReportColumn<RevenueExpenseRow>[] = [
  { key: 'period',           label: 'Period',        sortable: true },
  { key: 'revenue',          label: 'Revenue',       align: 'right', sortable: true, render: (v) => <span className="text-emerald-700 font-semibold">{formatCurrency(Number(v))}</span> },
  { key: 'purchase_cost',    label: 'Purchase Cost', align: 'right', render: (v) => <span className="text-red-600">{formatCurrency(Number(v))}</span> },
  {
    key: 'gross_profit', label: 'Gross Profit', align: 'right', sortable: true,
    render: (v) => {
      const n = Number(v);
      return <span className={`font-semibold font-mono ${n >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatCurrency(n)}</span>;
    },
  },
  {
    key: 'gross_margin_pct', label: 'Margin %', align: 'right',
    render: (v) => {
      const pct = Number(v);
      const cls = pct >= 30 ? 'text-emerald-700' : pct >= 10 ? 'text-amber-600' : 'text-red-600';
      return <span className={`font-mono font-semibold ${cls}`}>{pct.toFixed(1)}%</span>;
    },
  },
];

export default function RevenueExpenseSummary() {
  const { data, meta, summary, isLoading, isFetching, filters, setFilter, setFilters, resetFilters } =
    useReport<RevenueExpenseRow>({ endpoint: '/reports/accounting/revenue-expense' });

  const totalRow: Partial<Record<string, React.ReactNode>> = {
    period:        <strong>Totals</strong>,
    revenue:       <strong className="text-emerald-700">{formatCurrency(Number(summary.total_revenue ?? 0))}</strong>,
    purchase_cost: <strong className="text-red-600">{formatCurrency(Number(summary.total_cost ?? 0))}</strong>,
    gross_profit:  <strong>{formatCurrency(Number(summary.gross_profit ?? 0))}</strong>,
    gross_margin_pct: <strong>{Number(summary.gross_margin_pct ?? 0).toFixed(1)}%</strong>,
  };

  return (
    <div className="w-full space-y-5 px-4 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Revenue vs Expense Summary</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Monthly P&L — sales revenue vs purchase costs</p>
        </div>
        <ExportBar endpoint="/reports/accounting/revenue-expense" filters={filters} disabled={isLoading} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="Total Revenue"   value={formatCurrency(Number(summary.total_revenue ?? 0))}        icon={<TrendingUp />}  iconColor="bg-emerald-50 text-emerald-600" isLoading={isLoading} />
        <KpiCard title="Purchase Cost"   value={formatCurrency(Number(summary.total_cost ?? 0))}           icon={<TrendingDown />} iconColor="bg-red-50 text-red-600"        isLoading={isLoading} />
        <KpiCard title="Gross Profit"    value={formatCurrency(Number(summary.gross_profit ?? 0))}         icon={<DollarSign />}  iconColor="bg-blue-50 text-blue-600"       isLoading={isLoading} />
        <KpiCard title="Gross Margin"    value={`${Number(summary.gross_margin_pct ?? 0).toFixed(1)}%`}   icon={<BarChart3 />}   iconColor="bg-violet-50 text-violet-600"   isLoading={isLoading} />
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
        emptyMessage="No revenue or expense data for the selected period."
      />
    </div>
  );
}
