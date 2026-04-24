import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Download,
  Loader2,
  Layers,
  Boxes,
  PlusSquare,
  CalendarClock,
  TrendingUp,
  TrendingDown,
  Trophy,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import type { UseQueryResult } from '@tanstack/react-query';
import type {
  ReportResponse,
  CategoryBrandSalesRow,
  AverageBasketRow,
  ModifierRevenueRow,
  TrendComparisonRow,
  MoverRow,
  OutletLeaderboardRow,
} from '@/api/reports';

interface Props {
  categoryBrandQuery: UseQueryResult<ReportResponse<CategoryBrandSalesRow>, Error>;
  basketQuery: UseQueryResult<ReportResponse<AverageBasketRow>, Error>;
  modifierQuery: UseQueryResult<ReportResponse<ModifierRevenueRow>, Error>;
  trendQuery: UseQueryResult<ReportResponse<TrendComparisonRow>, Error>;
  moversQuery: UseQueryResult<ReportResponse<MoverRow>, Error>;
  leaderboardQuery: UseQueryResult<ReportResponse<OutletLeaderboardRow>, Error>;
  isAdmin: boolean;
  handleDownloadPosWidget: (endpoint: string, label: string) => void;
}

const formatPrice = (p: number) => `₹${p.toFixed(2)}`;
const formatDelta = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function WidgetHeader({
  title,
  subtitle,
  onExport,
  extra,
}: {
  title: string;
  subtitle?: string;
  onExport?: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-4 gap-3">
      <div>
        <h3 className="font-bold">{title}</h3>
        {subtitle && <p className="text-[11px] text-gray-500 mt-1">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {extra}
        {onExport && (
          <button
            onClick={onExport}
            className="h-8 bg-indigo-600 hover:bg-indigo-500 text-white px-3 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        )}
      </div>
    </div>
  );
}

function WidgetState({
  isLoading,
  error,
  isEmpty,
  children,
  emptyMessage,
}: {
  isLoading: boolean;
  error: unknown;
  isEmpty: boolean;
  children: React.ReactNode;
  emptyMessage: string;
}) {
  if (isLoading) {
    return (
      <div className="py-8 flex items-center justify-center text-sm text-gray-400 gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }
  if (error) {
    return <div className="py-8 text-center text-sm text-red-300">Could not load data.</div>;
  }
  if (isEmpty) {
    return <div className="py-8 text-center text-sm text-gray-500">{emptyMessage}</div>;
  }
  return <>{children}</>;
}

function deltaCls(n: number) {
  if (n > 0) return 'text-emerald-300';
  if (n < 0) return 'text-red-300';
  return 'text-gray-300';
}

function CategoryBrandWidget({ query, onExport }: { query: Props['categoryBrandQuery']; onExport: () => void }) {
  const rows = (query.data?.data ?? []) as CategoryBrandSalesRow[];
  const summary = query.data?.summary ?? {};

  const topCategories = useMemo(() => {
    const byCat = new Map<string, { name: string; revenue: number }>();
    rows.forEach((r) => {
      const key = r.category_id || r.category_name || '';
      const prev = byCat.get(key) || { name: r.category_name || 'Uncategorised', revenue: 0 };
      prev.revenue += Number(r.total_revenue || 0);
      byCat.set(key, prev);
    });
    return Array.from(byCat.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
  }, [rows]);

  return (
    <div className="mt-6 bg-[#1a1d27] border border-white/10 p-6 rounded-3xl">
      <WidgetHeader
        title="Category & Brand Sales"
        subtitle={`Top ${String(summary.top_category ?? '—')} · Brand: ${String(summary.top_brand ?? '—')} · Avg Disc ${Number(summary.avg_discount_pct ?? 0).toFixed(1)}%`}
        onExport={onExport}
        extra={<Layers className="h-4 w-4 text-gray-500" />}
      />
      <WidgetState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={rows.length === 0}
        emptyMessage="No category/brand data for selected filters."
      >
        {topCategories.length > 0 && (
          <div className="mb-4 h-40">
            <Bar
              data={{
                labels: topCategories.map((c) => c.name),
                datasets: [{
                  label: 'Revenue',
                  data: topCategories.map((c) => c.revenue),
                  backgroundColor: '#6366f1',
                  borderRadius: 4,
                }],
              }}
              options={{
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
                  y: { ticks: { color: '#cbd5e1', font: { size: 10 } }, grid: { display: false } },
                },
              }}
            />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-white/10">
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3">Brand</th>
                <th className="py-2 pr-3 text-right">Qty</th>
                <th className="py-2 pr-3 text-right">Revenue</th>
                <th className="py-2 pr-3 text-right">Disc %</th>
                <th className="py-2 text-right">Margin Ret. %</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((r, idx) => (
                <tr key={`${r.category_id || r.category_name || idx}-${r.brand_id || r.brand_name || idx}`} className="border-b border-white/5 last:border-b-0">
                  <td className="py-2 pr-3 text-white font-medium">{r.category_name || '—'}</td>
                  <td className="py-2 pr-3 text-gray-200">{r.brand_name || '—'}</td>
                  <td className="py-2 pr-3 text-right text-gray-200">{Number(r.total_qty).toLocaleString()}</td>
                  <td className="py-2 pr-3 text-right font-semibold text-indigo-300">{formatPrice(Number(r.total_revenue))}</td>
                  <td className="py-2 pr-3 text-right text-red-300">{Number(r.discount_pct).toFixed(1)}%</td>
                  <td className="py-2 text-right text-emerald-300">{Number(r.margin_retention_pct).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 10 && (
            <p className="text-[11px] text-gray-500 mt-3 text-right">Showing 10 of {rows.length} — open the full report for more.</p>
          )}
        </div>
      </WidgetState>
    </div>
  );
}

function BasketWidget({ query, onExport }: { query: Props['basketQuery']; onExport: () => void }) {
  const rows = (query.data?.data ?? []) as AverageBasketRow[];
  const summary = query.data?.summary ?? {};

  const kpis = [
    { label: 'Avg Basket', value: formatPrice(Number(summary.avg_basket_value ?? 0)) },
    { label: 'Items / Order', value: Number(summary.avg_items_per_order ?? 0).toFixed(2) },
    { label: 'Unique SKUs / Order', value: Number(summary.avg_unique_skus_per_order ?? 0).toFixed(2) },
    { label: 'Orders', value: Number(summary.total_orders ?? 0).toLocaleString() },
  ];

  return (
    <div className="mt-6 bg-[#1a1d27] border border-white/10 p-6 rounded-3xl">
      <WidgetHeader
        title="Average Basket Metrics"
        subtitle="Per-order rollups"
        onExport={onExport}
        extra={<Boxes className="h-4 w-4 text-gray-500" />}
      />
      <WidgetState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={rows.length === 0 && Number(summary.total_orders ?? 0) === 0}
        emptyMessage="No basket metrics for selected filters."
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <p className="text-[10px] uppercase tracking-wide text-gray-400">{kpi.label}</p>
              <p className="text-lg font-bold mt-0.5 text-white">{kpi.value}</p>
            </div>
          ))}
        </div>
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-white/10">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3 text-right">Orders</th>
                  <th className="py-2 pr-3 text-right">Avg Basket</th>
                  <th className="py-2 pr-3 text-right">Items / Order</th>
                  <th className="py-2 text-right">Unique SKUs</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(-7).map((r) => (
                  <tr key={r.day} className="border-b border-white/5 last:border-b-0">
                    <td className="py-2 pr-3 text-gray-200">{r.day}</td>
                    <td className="py-2 pr-3 text-right text-gray-200">{Number(r.orders).toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right font-semibold text-indigo-300">{formatPrice(Number(r.avg_basket_value))}</td>
                    <td className="py-2 pr-3 text-right text-gray-200">{Number(r.avg_items_per_order).toFixed(2)}</td>
                    <td className="py-2 text-right text-gray-200">{Number(r.avg_unique_skus).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </WidgetState>
    </div>
  );
}

function ModifierWidget({ query, onExport }: { query: Props['modifierQuery']; onExport: () => void }) {
  const rows = (query.data?.data ?? []) as ModifierRevenueRow[];
  const summary = query.data?.summary ?? {};

  return (
    <div className="mt-6 bg-[#1a1d27] border border-white/10 p-6 rounded-3xl">
      <WidgetHeader
        title="Modifier / Add-on Revenue"
        subtitle={`${formatPrice(Number(summary.total_adjust ?? 0))} · Attach ${Number(summary.attach_rate_pct ?? 0).toFixed(1)}%`}
        onExport={onExport}
        extra={<PlusSquare className="h-4 w-4 text-gray-500" />}
      />
      <WidgetState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={rows.length === 0}
        emptyMessage="No modifier data for selected filters."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-white/10">
                <th className="py-2 pr-3">Modifier</th>
                <th className="py-2 pr-3">Group</th>
                <th className="py-2 pr-3 text-right">Attach</th>
                <th className="py-2 pr-3 text-right">Orders</th>
                <th className="py-2 pr-3 text-right">Revenue</th>
                <th className="py-2 text-right">Attach %</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((r) => (
                <tr key={`${r.modifier_id}-${r.group_name}`} className="border-b border-white/5 last:border-b-0">
                  <td className="py-2 pr-3 text-white font-medium">{r.modifier_name}</td>
                  <td className="py-2 pr-3 text-gray-200">{r.group_name || '—'}</td>
                  <td className="py-2 pr-3 text-right text-gray-200">{Number(r.attach_count).toLocaleString()}</td>
                  <td className="py-2 pr-3 text-right text-gray-200">{Number(r.orders_attached).toLocaleString()}</td>
                  <td className="py-2 pr-3 text-right font-semibold text-indigo-300">{formatPrice(Number(r.total_adjust))}</td>
                  <td className="py-2 text-right text-gray-300">{Number(r.attach_rate_pct).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 10 && (
            <p className="text-[11px] text-gray-500 mt-3 text-right">Showing 10 of {rows.length} — open the full report for more.</p>
          )}
        </div>
      </WidgetState>
    </div>
  );
}

function TrendWidget({ query, onExport }: { query: Props['trendQuery']; onExport: () => void }) {
  const rows = (query.data?.data ?? []) as TrendComparisonRow[];
  const summary = query.data?.summary ?? {};

  const hourly = useMemo(() => rows.filter((r) => r.dimension === 'hour'), [rows]);
  const weekday = useMemo(() => rows.filter((r) => r.dimension === 'weekday'), [rows]);

  const peakHour = useMemo(() => {
    const top = [...hourly].sort((a, b) => b.current_revenue - a.current_revenue)[0];
    if (!top) return '—';
    const h = Number(top.bucket);
    const hr = h % 12 === 0 ? 12 : h % 12;
    return `${hr}${h < 12 ? 'a' : 'p'}`;
  }, [hourly]);

  const peakWeekday = useMemo(() => {
    const top = [...weekday].sort((a, b) => b.current_revenue - a.current_revenue)[0];
    return top ? (WEEKDAYS[Number(top.bucket)] ?? String(top.bucket)) : '—';
  }, [weekday]);

  const hourlyChart = useMemo(() => {
    const hrs = Array.from({ length: 24 }, (_, i) => i);
    const byHour = new Map(hourly.map((r) => [Number(r.bucket), r]));
    return {
      labels: hrs.map((h) => {
        const hr = h % 12 === 0 ? 12 : h % 12;
        return `${hr}${h < 12 ? 'a' : 'p'}`;
      }),
      datasets: [
        {
          label: 'Current',
          data: hrs.map((h) => Number(byHour.get(h)?.current_revenue ?? 0)),
          backgroundColor: '#6366f1',
          borderRadius: 3,
        },
        {
          label: 'Previous',
          data: hrs.map((h) => Number(byHour.get(h)?.previous_revenue ?? 0)),
          backgroundColor: 'rgba(148, 163, 184, 0.6)',
          borderRadius: 3,
        },
      ],
    };
  }, [hourly]);

  return (
    <div className="mt-6 bg-[#1a1d27] border border-white/10 p-6 rounded-3xl">
      <WidgetHeader
        title="Hourly & Weekday Trend"
        subtitle={`Peak hr ${peakHour} · Peak day ${peakWeekday} · Δ Revenue ${formatDelta(Number(summary.revenue_delta_pct ?? 0))}`}
        onExport={onExport}
        extra={<CalendarClock className="h-4 w-4 text-gray-500" />}
      />
      <WidgetState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={rows.length === 0}
        emptyMessage="No trend data for selected filters."
      >
        <div className="h-44 mb-4">
          <Bar
            data={hourlyChart}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom', labels: { color: '#cbd5e1', boxWidth: 10, font: { size: 10 } } },
              },
              scales: {
                x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
              },
            }}
          />
        </div>
        {weekday.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-white/10">
                  <th className="py-2 pr-3">Weekday</th>
                  <th className="py-2 pr-3 text-right">Current Rev</th>
                  <th className="py-2 pr-3 text-right">Prev Rev</th>
                  <th className="py-2 pr-3 text-right">Δ Rev %</th>
                  <th className="py-2 text-right">Δ Orders %</th>
                </tr>
              </thead>
              <tbody>
                {weekday
                  .sort((a, b) => Number(a.bucket) - Number(b.bucket))
                  .map((r) => {
                    const wIdx = Number(r.bucket);
                    const name = WEEKDAYS[wIdx] ?? String(r.bucket);
                    return (
                      <tr key={`wd-${r.bucket}`} className="border-b border-white/5 last:border-b-0">
                        <td className="py-2 pr-3 text-white font-medium">{name}</td>
                        <td className="py-2 pr-3 text-right text-gray-200">{formatPrice(Number(r.current_revenue))}</td>
                        <td className="py-2 pr-3 text-right text-gray-400">{formatPrice(Number(r.previous_revenue))}</td>
                        <td className={`py-2 pr-3 text-right font-medium ${deltaCls(Number(r.revenue_delta_pct))}`}>{formatDelta(Number(r.revenue_delta_pct))}</td>
                        <td className={`py-2 text-right font-medium ${deltaCls(Number(r.orders_delta_pct))}`}>{formatDelta(Number(r.orders_delta_pct))}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </WidgetState>
    </div>
  );
}

function MoversWidget({ query, onExport }: { query: Props['moversQuery']; onExport: () => void }) {
  const rows = (query.data?.data ?? []) as MoverRow[];
  const summary = query.data?.summary ?? {};

  const top = useMemo(() => [...rows].sort((a, b) => b.revenue_delta - a.revenue_delta).slice(0, 5), [rows]);
  const bottom = useMemo(() => [...rows].sort((a, b) => a.revenue_delta - b.revenue_delta).slice(0, 5), [rows]);

  return (
    <div className="mt-6 bg-[#1a1d27] border border-white/10 p-6 rounded-3xl">
      <WidgetHeader
        title="Top / Bottom Movers"
        subtitle={`${Number(summary.gainers ?? 0)} gainers · ${Number(summary.decliners ?? 0)} decliners`}
        onExport={onExport}
        extra={
          <span className="flex items-center gap-2 text-gray-500">
            <TrendingUp className="h-4 w-4" />
            <TrendingDown className="h-4 w-4" />
          </span>
        }
      />
      <WidgetState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={rows.length === 0}
        emptyMessage="No movers for selected filters."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[{ title: 'Top Gainers', list: top, icon: ArrowUp, tint: 'text-emerald-300' }, { title: 'Top Decliners', list: bottom, icon: ArrowDown, tint: 'text-red-300' }].map((block) => {
            const Icon = block.icon;
            return (
              <div key={block.title} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className={`flex items-center gap-2 text-xs font-semibold mb-3 ${block.tint}`}>
                  <Icon className="h-3.5 w-3.5" />
                  {block.title}
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {block.list.map((r) => (
                      <tr key={`${block.title}-${r.product_id}`} className="border-b border-white/5 last:border-b-0">
                        <td className="py-1.5 pr-3 text-white truncate max-w-[180px]">{r.product_name}</td>
                        <td className="py-1.5 pr-3 text-right text-gray-300 text-xs">{formatPrice(Number(r.current_revenue))}</td>
                        <td className={`py-1.5 text-right font-medium ${deltaCls(Number(r.revenue_delta))}`}>{`${r.revenue_delta > 0 ? '+' : ''}${formatPrice(Number(r.revenue_delta))}`}</td>
                      </tr>
                    ))}
                    {block.list.length === 0 && (
                      <tr><td className="py-2 text-center text-xs text-gray-500">No rows</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </WidgetState>
    </div>
  );
}

function LeaderboardWidget({ query, onExport }: { query: Props['leaderboardQuery']; onExport: () => void }) {
  const rows = (query.data?.data ?? []) as OutletLeaderboardRow[];
  const summary = query.data?.summary ?? {};

  return (
    <div className="mt-6 bg-[#1a1d27] border border-white/10 p-6 rounded-3xl">
      <WidgetHeader
        title="Outlet Leaderboard"
        subtitle={`Top: ${String(summary.top_outlet ?? '—')} · Active: ${Number(summary.outlets_active ?? 0)}`}
        onExport={onExport}
        extra={<Trophy className="h-4 w-4 text-amber-300" />}
      />
      <WidgetState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={rows.length === 0}
        emptyMessage="No outlet data for selected filters."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-white/10">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Outlet</th>
                <th className="py-2 pr-3 text-right">Revenue</th>
                <th className="py-2 pr-3 text-right">Δ Rev %</th>
                <th className="py-2 pr-3 text-right">Orders</th>
                <th className="py-2 pr-3 text-right">Avg Ticket</th>
                <th className="py-2 text-right">Items/Order</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.outlet_id} className="border-b border-white/5 last:border-b-0">
                  <td className="py-2 pr-3 text-gray-400">{r.rank}</td>
                  <td className="py-2 pr-3 text-white font-medium">{r.outlet_name}</td>
                  <td className="py-2 pr-3 text-right font-semibold text-indigo-300">{formatPrice(Number(r.current_revenue))}</td>
                  <td className={`py-2 pr-3 text-right font-medium ${deltaCls(Number(r.revenue_delta_pct))}`}>{formatDelta(Number(r.revenue_delta_pct))}</td>
                  <td className="py-2 pr-3 text-right text-gray-200">{Number(r.current_orders).toLocaleString()}</td>
                  <td className="py-2 pr-3 text-right text-gray-200">{formatPrice(Number(r.avg_ticket))}</td>
                  <td className="py-2 text-right text-gray-300">{Number(r.items_per_order).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </WidgetState>
    </div>
  );
}

export default function PosAnalyticsBatchBWidgets(props: Props) {
  const {
    categoryBrandQuery,
    basketQuery,
    modifierQuery,
    trendQuery,
    moversQuery,
    leaderboardQuery,
    isAdmin,
    handleDownloadPosWidget,
  } = props;

  return (
    <>
      <CategoryBrandWidget
        query={categoryBrandQuery}
        onExport={() => handleDownloadPosWidget('/reports/sales/category-brand', 'Category & Brand Sales')}
      />
      <BasketWidget
        query={basketQuery}
        onExport={() => handleDownloadPosWidget('/reports/sales/basket-metrics', 'Average Basket Metrics')}
      />
      <ModifierWidget
        query={modifierQuery}
        onExport={() => handleDownloadPosWidget('/reports/sales/modifier-revenue', 'Modifier Revenue')}
      />
      <TrendWidget
        query={trendQuery}
        onExport={() => handleDownloadPosWidget('/reports/sales/trend-comparison', 'Hourly & Weekday Trend')}
      />
      <MoversWidget
        query={moversQuery}
        onExport={() => handleDownloadPosWidget('/reports/sales/movers', 'Top / Bottom Movers')}
      />
      {isAdmin && (
        <LeaderboardWidget
          query={leaderboardQuery}
          onExport={() => handleDownloadPosWidget('/reports/sales/outlet-leaderboard', 'Outlet Leaderboard')}
        />
      )}
    </>
  );
}
