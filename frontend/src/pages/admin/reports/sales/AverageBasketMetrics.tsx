import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
} from 'chart.js';
import { ShoppingBasket, Boxes, Sparkles, DollarSign } from 'lucide-react';
import { ReportTable, type ReportColumn } from '@/components/reports/ReportTable';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ExportBar } from '@/components/reports/ExportBar';
import { KpiCard } from '@/components/reports/KpiCard';
import { useReport } from '@/hooks/useReport';
import { formatCurrency } from '@/lib/utils';
import type { AverageBasketRow } from '@/api/reports';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ChartTooltip, ChartLegend);

const COLUMNS: ReportColumn<AverageBasketRow & Record<string, unknown>>[] = [
  { key: 'day', label: 'Date', render: (v) => String(v) },
  { key: 'orders', label: 'Orders', align: 'right', render: (v) => Number(v).toLocaleString() },
  { key: 'items', label: 'Items', align: 'right', render: (v) => Number(v).toLocaleString() },
  { key: 'unique_skus', label: 'Unique SKUs', align: 'right', render: (v) => Number(v).toLocaleString() },
  { key: 'revenue', label: 'Revenue', align: 'right', render: (v) => formatCurrency(Number(v)) },
  { key: 'avg_basket_value', label: 'Avg Basket', align: 'right', render: (v) => <span className="font-medium">{formatCurrency(Number(v))}</span> },
  { key: 'avg_items_per_order', label: 'Items/Order', align: 'right', render: (v) => Number(v).toFixed(2) },
  { key: 'avg_unique_skus', label: 'SKUs/Order', align: 'right', render: (v) => Number(v).toFixed(2) },
];

export default function AverageBasketMetrics() {
  const { data, meta, summary, isLoading, isFetching, filters, setFilter, setFilters, resetFilters } =
    useReport<AverageBasketRow>({ endpoint: '/reports/sales/basket-metrics' });

  const chartData = useMemo(() => {
    const rows = data as AverageBasketRow[];
    return {
      labels: rows.map((r) => r.day),
      datasets: [
        {
          label: 'Avg Basket',
          data: rows.map((r) => r.avg_basket_value),
          borderColor: '#4f46e5',
          backgroundColor: 'rgba(79, 70, 229, 0.15)',
          tension: 0.3,
          yAxisID: 'y',
        },
        {
          label: 'Items / Order',
          data: rows.map((r) => r.avg_items_per_order),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          tension: 0.3,
          yAxisID: 'y1',
        },
      ],
    };
  }, [data]);

  return (
    <div className="w-full space-y-5 px-4 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Average Basket Metrics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Daily basket value, items per order, and unique SKUs per order
          </p>
        </div>
        <ExportBar endpoint="/reports/sales/basket-metrics" filters={filters} disabled={isLoading} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="Avg Basket"
          value={formatCurrency(Number(summary.avg_basket_value ?? 0))}
          icon={<DollarSign />}
          iconColor="bg-indigo-50 text-indigo-600"
          isLoading={isLoading}
        />
        <KpiCard
          title="Items / Order"
          value={Number(summary.avg_items_per_order ?? 0).toFixed(2)}
          icon={<Boxes />}
          iconColor="bg-emerald-50 text-emerald-600"
          isLoading={isLoading}
        />
        <KpiCard
          title="Unique SKUs / Order"
          value={Number(summary.avg_unique_skus_per_order ?? 0).toFixed(2)}
          icon={<Sparkles />}
          iconColor="bg-amber-50 text-amber-600"
          isLoading={isLoading}
        />
        <KpiCard
          title="Orders"
          value={Number(summary.total_orders ?? 0).toLocaleString()}
          subtitle={`${Number(summary.total_items ?? 0).toLocaleString()} items total`}
          icon={<ShoppingBasket />}
          iconColor="bg-violet-50 text-violet-600"
          isLoading={isLoading}
        />
      </div>

      <div className="flex flex-wrap gap-2 p-3 bg-muted/30 border rounded-lg">
        <ReportFilters filters={filters} onFilterChange={setFilter} onReset={resetFilters} />
      </div>

      <div className="bg-card border rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3">Daily Basket Trend</h2>
        {(data as AverageBasketRow[]).length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {isLoading ? 'Loading…' : 'No basket activity in this range.'}
          </div>
        ) : (
          <div className="h-64">
            <Line
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                  y: { type: 'linear', position: 'left', beginAtZero: true, title: { display: true, text: 'Avg Basket Value' } },
                  y1: { type: 'linear', position: 'right', beginAtZero: true, grid: { drawOnChartArea: false }, title: { display: true, text: 'Items / Order' } },
                },
              }}
            />
          </div>
        )}
      </div>

      <ReportTable
        columns={COLUMNS}
        data={data as (AverageBasketRow & Record<string, unknown>)[]}
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
