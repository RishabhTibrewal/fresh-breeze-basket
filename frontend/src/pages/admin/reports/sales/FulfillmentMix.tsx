import React, { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
} from 'chart.js';
import { Truck, Store, ShoppingCart } from 'lucide-react';
import { ReportTable, type ReportColumn } from '@/components/reports/ReportTable';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ExportBar } from '@/components/reports/ExportBar';
import { KpiCard } from '@/components/reports/KpiCard';
import { useReport } from '@/hooks/useReport';
import { formatCurrency } from '@/lib/utils';
import type { FulfillmentMixRow } from '@/api/reports';

ChartJS.register(ArcElement, ChartTooltip, ChartLegend);

const PIE_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const COLUMNS: ReportColumn<FulfillmentMixRow & Record<string, unknown>>[] = [
  {
    key: 'fulfillment_type',
    label: 'Fulfillment Type',
    render: (v) => <span className="font-medium capitalize">{String(v).replace(/_/g, ' ')}</span>,
  },
  { key: 'order_count', label: 'Orders', align: 'right', render: (v) => Number(v).toLocaleString() },
  { key: 'revenue', label: 'Revenue', align: 'right', sortable: true, render: (v) => formatCurrency(Number(v)) },
  { key: 'avg_order_value', label: 'Avg Order', align: 'right', render: (v) => formatCurrency(Number(v)) },
  { key: 'share_pct', label: 'Share', align: 'right', render: (v) => `${Number(v).toFixed(1)}%` },
];

export default function FulfillmentMix() {
  const { data, meta, summary, isLoading, isFetching, filters, setFilter, setFilters, resetFilters } =
    useReport<FulfillmentMixRow>({ endpoint: '/reports/sales/fulfillment-mix' });

  const chartData = useMemo(() => ({
    labels: (data as FulfillmentMixRow[]).map((r) => r.fulfillment_type.replace(/_/g, ' ')),
    datasets: [
      {
        data: (data as FulfillmentMixRow[]).map((r) => Number(r.revenue)),
        backgroundColor: (data as FulfillmentMixRow[]).map((_, i) => PIE_COLORS[i % PIE_COLORS.length]),
        borderWidth: 0,
      },
    ],
  }), [data]);

  return (
    <div className="w-full space-y-5 px-4 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Fulfillment Type Breakdown</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pickup / Delivery / Cash counter split across revenue and volume
          </p>
        </div>
        <ExportBar endpoint="/reports/sales/fulfillment-mix" filters={filters} disabled={isLoading} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard
          title="Total Orders"
          value={Number(summary.total_orders ?? 0).toLocaleString()}
          icon={<ShoppingCart />}
          iconColor="bg-blue-50 text-blue-600"
          isLoading={isLoading}
        />
        <KpiCard
          title="Total Revenue"
          value={formatCurrency(Number(summary.total_revenue ?? 0))}
          icon={<Store />}
          iconColor="bg-emerald-50 text-emerald-600"
          isLoading={isLoading}
        />
        <KpiCard
          title="Fulfillment Types"
          value={Number(summary.fulfillment_types ?? 0).toLocaleString()}
          icon={<Truck />}
          iconColor="bg-amber-50 text-amber-600"
          isLoading={isLoading}
        />
      </div>

      <div className="flex flex-wrap gap-2 p-3 bg-muted/30 border rounded-lg">
        <ReportFilters filters={filters} onFilterChange={setFilter} onReset={resetFilters} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 bg-card border rounded-lg p-4 flex items-center justify-center min-h-[280px]">
          {isLoading || (data as FulfillmentMixRow[]).length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-10">
              {isLoading ? 'Loading…' : 'No fulfillment data for the selected filters.'}
            </div>
          ) : (
            <div className="w-full max-w-[260px]">
              <Doughnut
                data={chartData}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
                  },
                }}
              />
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <ReportTable
            columns={COLUMNS}
            data={data as (FulfillmentMixRow & Record<string, unknown>)[]}
            isLoading={isLoading}
            isFetching={isFetching}
            meta={meta}
            sortBy={filters.sort_by}
            sortDir={filters.sort_dir}
            onPageChange={(p) => setFilter('page', p)}
            onSortChange={(k, d) => setFilters({ sort_by: k, sort_dir: d })}
          />
        </div>
      </div>
    </div>
  );
}
