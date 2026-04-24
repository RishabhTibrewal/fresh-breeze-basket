import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
} from 'chart.js';
import { Tag, Award, DollarSign, Percent } from 'lucide-react';
import { ReportTable, type ReportColumn } from '@/components/reports/ReportTable';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ExportBar } from '@/components/reports/ExportBar';
import { KpiCard } from '@/components/reports/KpiCard';
import { useReport } from '@/hooks/useReport';
import { formatCurrency } from '@/lib/utils';
import type { CategoryBrandSalesRow } from '@/api/reports';

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTooltip, ChartLegend);

interface RollupEntry { label: string; revenue: number; qty: number }

const COLUMNS: ReportColumn<CategoryBrandSalesRow & Record<string, unknown>>[] = [
  { key: 'category_name', label: 'Category', render: (v) => <span className="font-medium">{String(v)}</span> },
  { key: 'brand_name', label: 'Brand' },
  { key: 'total_qty', label: 'Qty', align: 'right', render: (v) => Number(v).toLocaleString() },
  { key: 'order_count', label: 'Orders', align: 'right', render: (v) => Number(v).toLocaleString() },
  { key: 'total_revenue', label: 'Revenue', align: 'right', sortable: true, render: (v) => <span className="font-semibold">{formatCurrency(Number(v))}</span> },
  { key: 'total_discount', label: 'Discount', align: 'right', render: (v) => formatCurrency(Number(v)) },
  { key: 'discount_pct', label: 'Disc %', align: 'right', render: (v) => `${Number(v).toFixed(1)}%` },
  {
    key: 'margin_retention_pct',
    label: 'Retention',
    align: 'right',
    render: (v) => {
      const n = Number(v);
      const cls = n >= 95 ? 'text-emerald-600' : n >= 80 ? 'text-amber-600' : 'text-red-600';
      return <span className={`font-medium ${cls}`}>{n.toFixed(1)}%</span>;
    },
  },
];

function parseRollup(raw: string | number | undefined): RollupEntry[] {
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const parsed = JSON.parse(raw) as RollupEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function CategoryBrandSales() {
  const { data, meta, summary, isLoading, isFetching, filters, setFilter, setFilters, resetFilters } =
    useReport<CategoryBrandSalesRow>({ endpoint: '/reports/sales/category-brand' });

  const categoryRollup = useMemo(() => parseRollup(summary.categories_json), [summary.categories_json]);
  const brandRollup = useMemo(() => parseRollup(summary.brands_json), [summary.brands_json]);

  const chartData = useMemo(() => ({
    labels: categoryRollup.slice(0, 8).map((r) => r.label),
    datasets: [
      {
        label: 'Revenue',
        data: categoryRollup.slice(0, 8).map((r) => r.revenue),
        backgroundColor: '#4f46e5',
        borderRadius: 4,
      },
    ],
  }), [categoryRollup]);

  return (
    <div className="w-full space-y-5 px-4 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Category &amp; Brand Sales</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Revenue, discount exposure, and list-price retention by category and brand
          </p>
        </div>
        <ExportBar endpoint="/reports/sales/category-brand" filters={filters} disabled={isLoading} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="Top Category"
          value={String(summary.top_category ?? '—')}
          icon={<Award />}
          iconColor="bg-indigo-50 text-indigo-600"
          isLoading={isLoading}
        />
        <KpiCard
          title="Top Brand"
          value={String(summary.top_brand ?? '—')}
          icon={<Tag />}
          iconColor="bg-rose-50 text-rose-600"
          isLoading={isLoading}
        />
        <KpiCard
          title="Revenue"
          value={formatCurrency(Number(summary.total_revenue ?? 0))}
          subtitle={`${Number(summary.total_qty ?? 0).toLocaleString()} units`}
          icon={<DollarSign />}
          iconColor="bg-emerald-50 text-emerald-600"
          isLoading={isLoading}
        />
        <KpiCard
          title="Avg Discount"
          value={`${Number(summary.avg_discount_pct ?? 0).toFixed(1)}%`}
          subtitle={formatCurrency(Number(summary.total_discount ?? 0))}
          icon={<Percent />}
          iconColor="bg-amber-50 text-amber-600"
          isLoading={isLoading}
        />
      </div>

      <div className="flex flex-wrap gap-2 p-3 bg-muted/30 border rounded-lg">
        <ReportFilters filters={filters} onFilterChange={setFilter} onReset={resetFilters} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-card border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3">Top Categories by Revenue</h2>
          {isLoading || categoryRollup.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {isLoading ? 'Loading…' : 'No category data available.'}
            </div>
          ) : (
            <div className="h-64">
              <Bar
                data={chartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: { y: { beginAtZero: true } },
                }}
              />
            </div>
          )}
        </div>
        <div className="lg:col-span-2 bg-card border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3">Top Brands</h2>
          {brandRollup.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">No brand data.</div>
          ) : (
            <ul className="space-y-2">
              {brandRollup.slice(0, 8).map((b) => (
                <li key={b.label} className="flex justify-between items-center text-sm">
                  <span className="truncate">{b.label}</span>
                  <span className="font-medium">{formatCurrency(b.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ReportTable
        columns={COLUMNS}
        data={data as (CategoryBrandSalesRow & Record<string, unknown>)[]}
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
