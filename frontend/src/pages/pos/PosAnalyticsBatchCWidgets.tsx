import React, { useMemo, useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
  Download,
  Loader2,
  ListOrdered,
  Activity,
  TrendingUp,
  Clock,
  Package,
  History,
  Star,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { UseQueryResult } from '@tanstack/react-query';
import type {
  ReportResponse,
  KotVolumeByCounterRow,
  KotStatusBreakdownRow,
  KotTopItemRow,
  KotThroughputRow,
  PosPoolStockRow,
  PosPoolMovementRow,
  MenuItemPerformanceRow,
} from '@/api/reports';

interface Props {
  kotVolumeQuery: UseQueryResult<ReportResponse<KotVolumeByCounterRow>, Error>;
  kotStatusQuery: UseQueryResult<ReportResponse<KotStatusBreakdownRow>, Error>;
  kotTopItemsQuery: UseQueryResult<ReportResponse<KotTopItemRow>, Error>;
  kotThroughputQuery: UseQueryResult<ReportResponse<KotThroughputRow>, Error>;
  posPoolStockQuery: UseQueryResult<ReportResponse<PosPoolStockRow>, Error>;
  posPoolMovementsQuery: UseQueryResult<ReportResponse<PosPoolMovementRow>, Error>;
  menuItemPerfQuery: UseQueryResult<ReportResponse<MenuItemPerformanceRow>, Error>;
  handleDownloadPosWidget: (endpoint: string, label: string) => void;
}

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

const formatPrice = (p: number) => `₹${p.toFixed(2)}`;
const formatNumber = (n: number) => Number(n).toLocaleString();

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

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

function DoughnutWidget<T extends { amount?: number; revenue?: number; share_pct?: number }>({
  title,
  subtitle,
  icon,
  rows,
  labelKey,
  valueKey,
  query,
  onExport,
  trailing,
  emptyMessage,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  rows: T[];
  labelKey: keyof T;
  valueKey: keyof T;
  query: UseQueryResult<any, Error>;
  onExport: () => void;
  trailing?: React.ReactNode;
  emptyMessage: string;
}) {
  const chartData = useMemo(() => {
    const labels = rows.map((r) => String(r[labelKey] ?? '').replace(/_/g, ' '));
    const data = rows.map((r) => Number(r[valueKey] ?? 0));
    return {
      labels,
      datasets: [{
        data,
        backgroundColor: rows.map((_, i) => PIE_COLORS[i % PIE_COLORS.length]),
        borderWidth: 0,
      }],
    };
  }, [rows, labelKey, valueKey]);

  return (
    <div className="mt-6 bg-[#1a1d27] border border-white/10 p-6 rounded-3xl">
      <WidgetHeader title={title} subtitle={subtitle} onExport={onExport} extra={<span className="text-gray-500">{icon}</span>} />
      <WidgetState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={rows.length === 0}
        emptyMessage={emptyMessage}
      >
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
          <div className="md:col-span-2 flex items-center justify-center">
            <div className="w-full max-w-[220px]">
              <Doughnut
                data={chartData}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { position: 'bottom', labels: { color: '#cbd5e1', boxWidth: 10, font: { size: 10 } } },
                  },
                }}
              />
            </div>
          </div>
          <div className="md:col-span-3">{trailing}</div>
        </div>
      </WidgetState>
    </div>
  );
}

function KotVolumeWidget({ query, onExport }: { query: Props['kotVolumeQuery']; onExport: () => void }) {
  const rows = (query.data?.data ?? []) as KotVolumeByCounterRow[];
  
  return (
    <div className="mt-6 bg-[#1a1d27] border border-white/10 p-6 rounded-3xl">
      <WidgetHeader
        title="KOT Volume by Counter"
        onExport={onExport}
        extra={<ListOrdered className="h-4 w-4 text-gray-500" />}
      />
      <WidgetState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={rows.length === 0}
        emptyMessage="No KOT volume data for selected filters."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-white/10">
                <th className="py-2 pr-3">Counter</th>
                <th className="py-2 pr-3">Outlet</th>
                <th className="py-2 pr-3 text-right">Total Tickets</th>
                <th className="py-2 pr-3 text-right">Completed</th>
                <th className="py-2 pr-3 text-right">Open/Voided</th>
                <th className="py-2 text-right">Avg Items/Ticket</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.counter_id}-${i}`} className="border-b border-white/5 last:border-b-0">
                  <td className="py-2 pr-3 text-white font-medium">{r.counter_name}</td>
                  <td className="py-2 pr-3 text-gray-200">{r.outlet_name}</td>
                  <td className="py-2 pr-3 text-right text-gray-200">{r.total_tickets}</td>
                  <td className="py-2 pr-3 text-right text-emerald-300">{r.completed_tickets}</td>
                  <td className="py-2 pr-3 text-right text-red-300">{r.open_tickets} / {r.voided_tickets}</td>
                  <td className="py-2 text-right text-gray-300">{Number(r.avg_items_per_ticket).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </WidgetState>
    </div>
  );
}

function KotStatusWidget({ query, onExport }: { query: Props['kotStatusQuery']; onExport: () => void }) {
  const rows = (query.data?.data ?? []) as KotStatusBreakdownRow[];

  const table = (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-white/10">
            <th className="py-2 pr-3">Status</th>
            <th className="py-2 pr-3">Outlet</th>
            <th className="py-2 pr-3 text-right">Tickets</th>
            <th className="py-2 text-right">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.status}-${r.outlet_id}-${i}`} className="border-b border-white/5 last:border-b-0">
              <td className="py-2 pr-3 capitalize text-white font-medium">{r.status}</td>
              <td className="py-2 pr-3 text-gray-200">{r.outlet_name}</td>
              <td className="py-2 pr-3 text-right text-gray-200">{r.ticket_count}</td>
              <td className="py-2 text-right text-gray-300">{Number(r.share_pct).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <DoughnutWidget
      title="KOT Status Breakdown"
      icon={<Activity className="h-4 w-4" />}
      rows={rows}
      labelKey="status"
      valueKey="ticket_count"
      query={query}
      onExport={onExport}
      trailing={table}
      emptyMessage="No KOT statuses for selected filters."
    />
  );
}

function KotTopItemsWidget({ query, onExport }: { query: Props['kotTopItemsQuery']; onExport: () => void }) {
  const rows = (query.data?.data ?? []) as KotTopItemRow[];

  return (
    <div className="mt-6 bg-[#1a1d27] border border-white/10 p-6 rounded-3xl">
      <WidgetHeader
        title="KOT Top Items"
        onExport={onExport}
        extra={<TrendingUp className="h-4 w-4 text-gray-500" />}
      />
      <WidgetState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={rows.length === 0}
        emptyMessage="No KOT items data for selected filters."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-white/10">
                <th className="py-2 pr-3">Product Name</th>
                <th className="py-2 pr-3">Variant</th>
                <th className="py-2 pr-3 text-right">Total Qty</th>
                <th className="py-2 pr-3 text-right">Tickets</th>
                <th className="py-2 text-right">Avg/Ticket</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.product_id}-${i}`} className="border-b border-white/5 last:border-b-0">
                  <td className="py-2 pr-3 text-white font-medium">{r.product_name}</td>
                  <td className="py-2 pr-3 text-gray-200">{r.variant_name || '—'}</td>
                  <td className="py-2 pr-3 text-right text-indigo-300 font-semibold">{r.total_qty}</td>
                  <td className="py-2 pr-3 text-right text-gray-200">{r.ticket_count}</td>
                  <td className="py-2 text-right text-gray-300">{Number(r.avg_qty_per_ticket).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </WidgetState>
    </div>
  );
}

function KotThroughputWidget({ query, onExport }: { query: Props['kotThroughputQuery']; onExport: () => void }) {
  const rows = (query.data?.data ?? []) as KotThroughputRow[];

  return (
    <div className="mt-6 bg-[#1a1d27] border border-white/10 p-6 rounded-3xl">
      <WidgetHeader
        title="KOT Throughput"
        onExport={onExport}
        extra={<Clock className="h-4 w-4 text-gray-500" />}
      />
      <WidgetState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={rows.length === 0}
        emptyMessage="No KOT throughput data for selected filters."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-white/10">
                <th className="py-2 pr-3">Counter</th>
                <th className="py-2 pr-3">Outlet</th>
                <th className="py-2 pr-3 text-right">Completed Tickets</th>
                <th className="py-2 pr-3 text-right">Avg (min)</th>
                <th className="py-2 pr-3 text-right">Min (min)</th>
                <th className="py-2 text-right">Max (min)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.counter_id}-${i}`} className="border-b border-white/5 last:border-b-0">
                  <td className="py-2 pr-3 text-white font-medium">{r.counter_name}</td>
                  <td className="py-2 pr-3 text-gray-200">{r.outlet_name}</td>
                  <td className="py-2 pr-3 text-right text-gray-200">{r.completed_tickets}</td>
                  <td className="py-2 pr-3 text-right text-indigo-300 font-semibold">{Number(r.avg_fulfilment_min).toFixed(1)}</td>
                  <td className="py-2 pr-3 text-right text-emerald-300">{Number(r.min_fulfilment_min).toFixed(1)}</td>
                  <td className="py-2 text-right text-red-300">{Number(r.max_fulfilment_min).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </WidgetState>
    </div>
  );
}

function PosPoolStockWidget({ query, onExport }: { query: Props['posPoolStockQuery']; onExport: () => void }) {
  const rows = (query.data?.data ?? []) as PosPoolStockRow[];

  return (
    <div className="mt-6 bg-[#1a1d27] border border-white/10 p-6 rounded-3xl">
      <WidgetHeader
        title="POS Pool Stock Levels"
        onExport={onExport}
        extra={<Package className="h-4 w-4 text-gray-500" />}
      />
      <WidgetState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={rows.length === 0}
        emptyMessage="No POS pool stock data for selected filters."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-white/10">
                <th className="py-2 pr-3">Product Name</th>
                <th className="py-2 pr-3">Variant / SKU</th>
                <th className="py-2 pr-3">Outlet</th>
                <th className="py-2 pr-3 text-right">Qty</th>
                <th className="py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                let statusClass = 'text-gray-300';
                if (r.stock_status === 'low') statusClass = 'text-amber-400';
                if (r.stock_status === 'zero') statusClass = 'text-red-400';
                if (r.stock_status === 'negative') statusClass = 'text-red-600 font-bold';
                if (r.stock_status === 'ok') statusClass = 'text-emerald-400';

                return (
                  <tr key={`${r.variant_id}-${r.outlet_id}-${i}`} className="border-b border-white/5 last:border-b-0">
                    <td className="py-2 pr-3 text-white font-medium">{r.product_name}</td>
                    <td className="py-2 pr-3 text-gray-200">
                      {r.variant_name || '—'}
                      {r.sku && <div className="text-[10px] text-gray-500">{r.sku}</div>}
                    </td>
                    <td className="py-2 pr-3 text-gray-200">{r.outlet_name}</td>
                    <td className="py-2 pr-3 text-right text-white font-semibold">{r.qty}</td>
                    <td className={`py-2 text-right uppercase text-[10px] tracking-wider ${statusClass}`}>
                      {r.stock_status}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </WidgetState>
    </div>
  );
}

function PosPoolMovementsWidget({ query, onExport }: { query: Props['posPoolMovementsQuery']; onExport: () => void }) {
  const [page, setPage] = useState(1);
  const rows = (query.data?.data ?? []) as PosPoolMovementRow[];
  
  const pageSize = 10;
  const totalPages = Math.ceil(rows.length / pageSize);
  const paginatedRows = rows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="mt-6 bg-[#1a1d27] border border-white/10 p-6 rounded-3xl">
      <WidgetHeader
        title="POS Pool Movements"
        onExport={onExport}
        extra={<History className="h-4 w-4 text-gray-500" />}
      />
      <WidgetState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={rows.length === 0}
        emptyMessage="No POS pool movement data for selected filters."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-white/10">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Product</th>
                <th className="py-2 pr-3">Outlet</th>
                <th className="py-2 pr-3 text-right">Change</th>
                <th className="py-2">Ref / Notes</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((r, i) => (
                <tr key={`${r.movement_id}-${i}`} className="border-b border-white/5 last:border-b-0">
                  <td className="py-2 pr-3 text-gray-300 text-xs">{formatDateTime(r.movement_date)}</td>
                  <td className="py-2 pr-3">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-wide bg-white/10 text-gray-300">
                      {r.movement_type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-white font-medium">
                    {r.product_name}
                    {r.variant_name && <span className="text-gray-400 ml-1">({r.variant_name})</span>}
                  </td>
                  <td className="py-2 pr-3 text-gray-200">{r.outlet_name}</td>
                  <td className={`py-2 pr-3 text-right font-semibold ${r.qty_change > 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                    {r.qty_change > 0 ? '+' : ''}{r.qty_change}
                  </td>
                  <td className="py-2 text-gray-400 text-xs">
                    {r.reference_id && <div>Ref: {r.reference_id}</div>}
                    {r.notes && <div>{r.notes}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 border-t border-white/10 pt-4">
              <div className="text-[11px] text-gray-500">
                Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, rows.length)} of {rows.length} entries
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-50 text-gray-400 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="text-[11px] text-gray-400 font-medium">
                  Page {page} of {totalPages}
                </div>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-50 text-gray-400 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </WidgetState>
    </div>
  );
}

function MenuItemPerformanceWidget({ query, onExport }: { query: Props['menuItemPerfQuery']; onExport: () => void }) {
  const [page, setPage] = useState(1);
  const rows = (query.data?.data ?? []) as MenuItemPerformanceRow[];
  
  const pageSize = 10;
  const totalPages = Math.ceil(rows.length / pageSize);
  const paginatedRows = rows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="mt-6 bg-[#1a1d27] border border-white/10 p-6 rounded-3xl">
      <WidgetHeader
        title="Menu Item Performance"
        onExport={onExport}
        extra={<Star className="h-4 w-4 text-gray-500" />}
      />
      <WidgetState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={rows.length === 0}
        emptyMessage="No menu item performance data for selected filters."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-white/10">
                <th className="py-2 pr-3">Product Name</th>
                <th className="py-2 pr-3">Menu</th>
                <th className="py-2 pr-3 text-right">POS Price</th>
                <th className="py-2 pr-3 text-right">Orders</th>
                <th className="py-2 pr-3 text-right">Qty</th>
                <th className="py-2 pr-3 text-right">Revenue</th>
                <th className="py-2 text-right">Tag</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((r, i) => {
                let tagClass = 'bg-gray-500/20 text-gray-300';
                if (r.performance_tag === 'star') tagClass = 'bg-amber-500/20 text-amber-300';
                if (r.performance_tag === 'hidden_gem') tagClass = 'bg-emerald-500/20 text-emerald-300';
                if (r.performance_tag === 'ghost') tagClass = 'bg-red-500/20 text-red-300';
                if (r.performance_tag === 'invisible') tagClass = 'bg-gray-800 text-gray-500';

                return (
                  <tr key={`${r.product_id}-${r.menu_id}-${i}`} className="border-b border-white/5 last:border-b-0">
                    <td className="py-2 pr-3 text-white font-medium">
                      {r.product_name}
                      {r.variant_name && <span className="text-gray-400 ml-1">({r.variant_name})</span>}
                    </td>
                    <td className="py-2 pr-3 text-gray-200">{r.menu_name}</td>
                    <td className="py-2 pr-3 text-right text-gray-300">{formatPrice(Number(r.pos_price))}</td>
                    <td className="py-2 pr-3 text-right text-gray-200">{r.times_ordered}</td>
                    <td className="py-2 pr-3 text-right text-gray-200">{r.total_qty}</td>
                    <td className="py-2 pr-3 text-right text-indigo-300 font-semibold">{formatPrice(Number(r.total_revenue))}</td>
                    <td className="py-2 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-wide ${tagClass}`}>
                        {r.performance_tag.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 border-t border-white/10 pt-4">
              <div className="text-[11px] text-gray-500">
                Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, rows.length)} of {rows.length} entries
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-50 text-gray-400 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="text-[11px] text-gray-400 font-medium">
                  Page {page} of {totalPages}
                </div>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-50 text-gray-400 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </WidgetState>
    </div>
  );
}

export default function PosAnalyticsBatchCWidgets(props: Props) {
  const {
    kotVolumeQuery,
    kotStatusQuery,
    kotTopItemsQuery,
    kotThroughputQuery,
    posPoolStockQuery,
    posPoolMovementsQuery,
    menuItemPerfQuery,
    handleDownloadPosWidget,
  } = props;

  return (
    <>
      <KotVolumeWidget
        query={kotVolumeQuery}
        onExport={() => handleDownloadPosWidget('/reports/sales/kot-volume-by-counter', 'KOT Volume by Counter')}
      />
      <KotStatusWidget
        query={kotStatusQuery}
        onExport={() => handleDownloadPosWidget('/reports/sales/kot-status-breakdown', 'KOT Status Breakdown')}
      />
      <KotTopItemsWidget
        query={kotTopItemsQuery}
        onExport={() => handleDownloadPosWidget('/reports/sales/kot-top-items', 'KOT Top Items')}
      />
      <KotThroughputWidget
        query={kotThroughputQuery}
        onExport={() => handleDownloadPosWidget('/reports/sales/kot-throughput', 'KOT Throughput')}
      />
      <PosPoolStockWidget
        query={posPoolStockQuery}
        onExport={() => handleDownloadPosWidget('/reports/sales/pos-pool-stock', 'POS Pool Stock Levels')}
      />
      <PosPoolMovementsWidget
        query={posPoolMovementsQuery}
        onExport={() => handleDownloadPosWidget('/reports/sales/pos-pool-movements', 'POS Pool Movements')}
      />
      <MenuItemPerformanceWidget
        query={menuItemPerfQuery}
        onExport={() => handleDownloadPosWidget('/reports/sales/menu-item-performance', 'Menu Item Performance')}
      />
    </>
  );
}
