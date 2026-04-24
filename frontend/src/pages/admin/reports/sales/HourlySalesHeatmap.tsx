import React, { useMemo } from 'react';
import { Clock, Calendar, TrendingUp } from 'lucide-react';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ExportBar } from '@/components/reports/ExportBar';
import { KpiCard } from '@/components/reports/KpiCard';
import { useReport } from '@/hooks/useReport';
import { formatCurrency } from '@/lib/utils';
import type { HourlyHeatmapRow } from '@/api/reports';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHour(h: number): string {
  const hr = h % 12 === 0 ? 12 : h % 12;
  const suffix = h < 12 ? 'a' : 'p';
  return `${hr}${suffix}`;
}

export default function HourlySalesHeatmap() {
  const { data, summary, isLoading, isFetching, filters, setFilter, resetFilters } =
    useReport<HourlyHeatmapRow>({ endpoint: '/reports/sales/hourly-heatmap' });

  // Build 7×24 matrix of revenue values
  const matrix = useMemo(() => {
    const grid: Array<Array<{ revenue: number; orders: number }>> = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => ({ revenue: 0, orders: 0 }))
    );
    (data as HourlyHeatmapRow[]).forEach((r) => {
      if (r.weekday >= 0 && r.weekday < 7 && r.hour >= 0 && r.hour < 24) {
        grid[r.weekday][r.hour] = { revenue: Number(r.revenue || 0), orders: Number(r.order_count || 0) };
      }
    });
    return grid;
  }, [data]);

  const maxRevenue = useMemo(() => {
    let max = 0;
    for (const row of matrix) {
      for (const cell of row) {
        if (cell.revenue > max) max = cell.revenue;
      }
    }
    return max;
  }, [matrix]);

  const cellIntensity = (revenue: number) => {
    if (maxRevenue <= 0) return 0;
    return Math.min(1, revenue / maxRevenue);
  };

  return (
    <div className="w-full space-y-5 px-4 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Hourly Sales Heatmap</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Revenue distribution by weekday and hour
          </p>
        </div>
        <ExportBar endpoint="/reports/sales/hourly-heatmap" filters={filters} disabled={isLoading} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard
          title="Peak Day"
          value={String(summary.peak_weekday ?? '—')}
          icon={<Calendar />}
          iconColor="bg-blue-50 text-blue-600"
          isLoading={isLoading}
        />
        <KpiCard
          title="Peak Hour"
          value={summary.peak_hour !== undefined && summary.peak_hour !== null ? formatHour(Number(summary.peak_hour)) : '—'}
          subtitle={summary.peak_revenue ? formatCurrency(Number(summary.peak_revenue)) : undefined}
          icon={<Clock />}
          iconColor="bg-violet-50 text-violet-600"
          isLoading={isLoading}
        />
        <KpiCard
          title="Total Revenue"
          value={formatCurrency(Number(summary.total_revenue ?? 0))}
          subtitle={`${Number(summary.total_orders ?? 0).toLocaleString()} orders`}
          icon={<TrendingUp />}
          iconColor="bg-emerald-50 text-emerald-600"
          isLoading={isLoading}
        />
      </div>

      <div className="flex flex-wrap gap-2 p-3 bg-muted/30 border rounded-lg">
        <ReportFilters filters={filters} onFilterChange={setFilter} onReset={resetFilters} />
      </div>

      <div className="bg-card border rounded-lg p-4 overflow-x-auto">
        {isLoading || isFetching ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading heatmap…</div>
        ) : maxRevenue === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No sales data in this range.
          </div>
        ) : (
          <table className="min-w-[900px] w-full text-xs border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="sticky left-0 bg-card w-12"></th>
                {HOURS.map((h) => (
                  <th key={h} className="font-medium text-muted-foreground text-[10px] text-center pb-1">
                    {formatHour(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WEEKDAYS.map((day, wIdx) => (
                <tr key={day}>
                  <td className="sticky left-0 bg-card font-semibold text-muted-foreground pr-2 text-right w-12">
                    {day}
                  </td>
                  {HOURS.map((h) => {
                    const cell = matrix[wIdx][h];
                    const intensity = cellIntensity(cell.revenue);
                    return (
                      <td key={h} className="p-0">
                        <div
                          title={`${day} ${formatHour(h)} · ${cell.orders} orders · ${formatCurrency(cell.revenue)}`}
                          className="h-7 w-full rounded border border-border"
                          style={{
                            backgroundColor: intensity > 0
                              ? `rgba(79, 70, 229, ${0.15 + intensity * 0.85})`
                              : 'transparent',
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
