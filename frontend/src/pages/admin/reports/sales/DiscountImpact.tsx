import React from 'react';
import { Tag, Percent, TrendingDown, ShoppingCart } from 'lucide-react';
import { ReportTable, type ReportColumn } from '@/components/reports/ReportTable';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ExportBar } from '@/components/reports/ExportBar';
import { KpiCard } from '@/components/reports/KpiCard';
import { useReport } from '@/hooks/useReport';
import { formatCurrency } from '@/lib/utils';
import type { DiscountImpactRow } from '@/api/reports';

const COLUMNS: ReportColumn<DiscountImpactRow & Record<string, unknown>>[] = [
  { key: 'outlet_name', label: 'Outlet', render: (v) => <span className="font-medium">{String(v)}</span> },
  { key: 'order_count', label: 'Orders', align: 'right', render: (v) => Number(v).toLocaleString() },
  { key: 'orders_with_discount', label: 'w/ Discount', align: 'right', render: (v) => Number(v).toLocaleString() },
  { key: 'gross_sales', label: 'Gross', align: 'right', sortable: true, render: (v) => formatCurrency(Number(v)) },
  { key: 'line_discount', label: 'Line Disc.', align: 'right', render: (v) => formatCurrency(Number(v)) },
  { key: 'extra_discount', label: 'Extra Disc.', align: 'right', render: (v) => formatCurrency(Number(v)) },
  { key: 'cd_amount', label: 'Cash Disc.', align: 'right', render: (v) => formatCurrency(Number(v)) },
  { key: 'total_discount', label: 'Total Disc.', align: 'right', sortable: true, render: (v) => <span className="font-semibold text-red-600">{formatCurrency(Number(v))}</span> },
  { key: 'net_sales', label: 'Net Sales', align: 'right', render: (v) => <span className="font-semibold">{formatCurrency(Number(v))}</span> },
  { key: 'discount_rate_pct', label: 'Disc %', align: 'right', render: (v) => `${Number(v).toFixed(1)}%` },
];

export default function DiscountImpact() {
  const { data, meta, summary, isLoading, isFetching, filters, setFilter, setFilters, resetFilters } =
    useReport<DiscountImpactRow>({ endpoint: '/reports/sales/discount-impact' });

  return (
    <div className="w-full space-y-5 px-4 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Discount Impact</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gross → Net: line, extra, and cash-discount breakdown per outlet
          </p>
        </div>
        <ExportBar endpoint="/reports/sales/discount-impact" filters={filters} disabled={isLoading} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="Gross Sales"
          value={formatCurrency(Number(summary.gross_sales ?? 0))}
          icon={<ShoppingCart />}
          iconColor="bg-blue-50 text-blue-600"
          isLoading={isLoading}
        />
        <KpiCard
          title="Total Discount"
          value={formatCurrency(Number(summary.total_discount ?? 0))}
          icon={<TrendingDown />}
          iconColor="bg-red-50 text-red-600"
          isLoading={isLoading}
        />
        <KpiCard
          title="Net Sales"
          value={formatCurrency(Number(summary.net_sales ?? 0))}
          icon={<Tag />}
          iconColor="bg-emerald-50 text-emerald-600"
          isLoading={isLoading}
        />
        <KpiCard
          title="Discount Rate"
          value={`${Number(summary.discount_rate_pct ?? 0).toFixed(1)}%`}
          subtitle={`${Number(summary.orders_with_discount ?? 0).toLocaleString()} / ${Number(summary.total_orders ?? 0).toLocaleString()} orders`}
          icon={<Percent />}
          iconColor="bg-amber-50 text-amber-600"
          isLoading={isLoading}
        />
      </div>

      <div className="flex flex-wrap gap-2 p-3 bg-muted/30 border rounded-lg">
        <ReportFilters filters={filters} onFilterChange={setFilter} onReset={resetFilters} />
      </div>

      <ReportTable
        columns={COLUMNS}
        data={data as (DiscountImpactRow & Record<string, unknown>)[]}
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
