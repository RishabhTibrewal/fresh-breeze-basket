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
import { Clock, CalendarDays, TrendingUp, TrendingDown } from 'lucide-react';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ExportBar } from '@/components/reports/ExportBar';
import { KpiCard } from '@/components/reports/KpiCard';
import { useReport } from '@/hooks/useReport';
import { formatCurrency } from '@/lib/utils';
import type { TrendComparisonRow } from '@/api/reports';

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTooltip, ChartLegend);

function formatDelta(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const prefix = n > 0 ? '+' : '';
  return `${prefix}${n.toFixed(1)}%`;
}

function deltaColor(n: number) {
  return n > 0 ? 'text-emerald-600' : n < 0 ? 'text-red-600' : 'text-muted-foreground';
}

export default function HourlyWeekdayTrend() {
  const { data, summary, isLoading, filters, setFilter, resetFilters } =
    useReport<TrendComparisonRow>({ endpoint: '/reports/sales/trend-comparison' });

  const rows = data as TrendComparisonRow[];
  const hourRows = useMemo(() => rows.filter((r) => r.dimension === 'hour').sort((a, b) => a.bucket - b.bucket), [rows]);
  const weekdayRows = useMemo(() => rows.filter((r) => r.dimension === 'weekday').sort((a, b) => a.bucket - b.bucket), [rows]);

  const hourChart = useMemo(() => ({
    labels: hourRows.map((r) => r.label),
    datasets: [
      {
        label: 'Current',
        data: hourRows.map((r) => r.current_revenue),
        backgroundColor: '#4f46e5',
        borderRadius: 4,
      },
      {
        label: 'Previous',
        data: hourRows.map((r) => r.previous_revenue),
        backgroundColor: '#cbd5e1',
        borderRadius: 4,
      },
    ],
  }), [hourRows]);

  const weekdayChart = useMemo(() => ({
    labels: weekdayRows.map((r) => r.label),
    datasets: [
      {
        label: 'Current',
        data: weekdayRows.map((r) => r.current_revenue),
        backgroundColor: '#10b981',
        borderRadius: 4,
      },
      {
        label: 'Previous',
        data: weekdayRows.map((r) => r.previous_revenue),
        backgroundColor: '#cbd5e1',
        borderRadius: 4,
      },
    ],
  }), [weekdayRows]);

  const revenueDelta = Number(summary.revenue_delta_pct ?? 0);
  const ordersDelta = Number(summary.orders_delta_pct ?? 0);

  return (
    <div className="w-full space-y-5 px-4 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Hourly &amp; Weekday Trend</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Current period vs previous equivalent period
            {summary.period_from && summary.previous_from ? (
              <> · {String(summary.period_from)} → {String(summary.period_to)} <span className="text-muted-foreground/70">vs {String(summary.previous_from)} → {String(summary.previous_to)}</span></>
            ) : null}
          </p>
        </div>
        <ExportBar endpoint="/reports/sales/trend-comparison" filters={filters} disabled={isLoading} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="Revenue"
          value={formatCurrency(Number(summary.current_revenue ?? 0))}
          subtitle={`vs ${formatCurrency(Number(summary.previous_revenue ?? 0))}`}
          trend={revenueDelta}
          icon={revenueDelta >= 0 ? <TrendingUp /> : <TrendingDown />}
          iconColor={revenueDelta >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}
          isLoading={isLoading}
        />
        <KpiCard
          title="Orders"
          value={Number(summary.current_orders ?? 0).toLocaleString()}
          subtitle={`vs ${Number(summary.previous_orders ?? 0).toLocaleString()}`}
          trend={ordersDelta}
          icon={<Clock />}
          iconColor="bg-indigo-50 text-indigo-600"
          isLoading={isLoading}
        />
        <KpiCard
          title="Peak Hour (current)"
          value={hourRows.length ? hourRows.reduce((a, b) => (a.current_revenue > b.current_revenue ? a : b)).label : '—'}
          icon={<Clock />}
          iconColor="bg-amber-50 text-amber-600"
          isLoading={isLoading}
        />
        <KpiCard
          title="Peak Day (current)"
          value={weekdayRows.length ? weekdayRows.reduce((a, b) => (a.current_revenue > b.current_revenue ? a : b)).label : '—'}
          icon={<CalendarDays />}
          iconColor="bg-violet-50 text-violet-600"
          isLoading={isLoading}
        />
      </div>

      <div className="flex flex-wrap gap-2 p-3 bg-muted/30 border rounded-lg">
        <ReportFilters filters={filters} onFilterChange={setFilter} onReset={resetFilters} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3">By Hour (Revenue)</h2>
          {hourRows.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">No data in this range.</div>
          ) : (
            <div className="h-64">
              <Bar
                data={hourChart}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: 'bottom' } },
                  scales: { y: { beginAtZero: true } },
                }}
              />
            </div>
          )}
        </div>
        <div className="bg-card border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3">By Weekday (Revenue)</h2>
          {weekdayRows.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">No data in this range.</div>
          ) : (
            <div className="h-64">
              <Bar
                data={weekdayChart}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: 'bottom' } },
                  scales: { y: { beginAtZero: true } },
                }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="p-3 border-b bg-muted/30">
            <h3 className="text-sm font-semibold">Hour-by-hour deltas</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2">Hour</th>
                  <th className="px-3 py-2 text-right">Current</th>
                  <th className="px-3 py-2 text-right">Previous</th>
                  <th className="px-3 py-2 text-right">Δ %</th>
                </tr>
              </thead>
              <tbody>
                {hourRows.map((r) => (
                  <tr key={`h${r.bucket}`} className="border-t">
                    <td className="px-3 py-2 font-medium">{r.label}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(r.current_revenue)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{formatCurrency(r.previous_revenue)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${deltaColor(r.revenue_delta_pct)}`}>
                      {formatDelta(r.revenue_delta_pct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="p-3 border-b bg-muted/30">
            <h3 className="text-sm font-semibold">Weekday deltas</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2">Day</th>
                  <th className="px-3 py-2 text-right">Current</th>
                  <th className="px-3 py-2 text-right">Previous</th>
                  <th className="px-3 py-2 text-right">Δ %</th>
                </tr>
              </thead>
              <tbody>
                {weekdayRows.map((r) => (
                  <tr key={`w${r.bucket}`} className="border-t">
                    <td className="px-3 py-2 font-medium">{r.label}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(r.current_revenue)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{formatCurrency(r.previous_revenue)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${deltaColor(r.revenue_delta_pct)}`}>
                      {formatDelta(r.revenue_delta_pct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
