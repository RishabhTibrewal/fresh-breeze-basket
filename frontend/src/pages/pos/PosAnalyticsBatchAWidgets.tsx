import React, { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
  Download,
  Loader2,
  CreditCard,
  Truck,
  Tag,
  UserCheck,
  Clock,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import type { UseQueryResult } from '@tanstack/react-query';
import type {
  ReportResponse,
  HourlyHeatmapRow,
  PaymentMixRow,
  FulfillmentMixRow,
  DiscountImpactRow,
  CashierPerformanceRow,
  SalesReturnsRow,
} from '@/api/reports';
import type { NavigateFunction } from 'react-router-dom';

interface Props {
  hourlyHeatmapQuery: UseQueryResult<ReportResponse<HourlyHeatmapRow>, Error>;
  paymentMixQuery: UseQueryResult<ReportResponse<PaymentMixRow>, Error>;
  fulfillmentMixQuery: UseQueryResult<ReportResponse<FulfillmentMixRow>, Error>;
  discountImpactQuery: UseQueryResult<ReportResponse<DiscountImpactRow>, Error>;
  cashierPerfQuery: UseQueryResult<ReportResponse<CashierPerformanceRow>, Error>;
  returnsQuery: UseQueryResult<ReportResponse<SalesReturnsRow>, Error>;
  canViewAllPosSessions: boolean;
  handleDownloadPosWidget: (endpoint: string, label: string) => void;
  navigate: NavigateFunction;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

const formatPrice = (p: number) => `₹${p.toFixed(2)}`;

function formatHour(h: number) {
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${h < 12 ? 'a' : 'p'}`;
}

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

function HeatmapWidget({ query, onExport }: { query: Props['hourlyHeatmapQuery']; onExport: () => void }) {
  const rows = (query.data?.data ?? []) as HourlyHeatmapRow[];
  const summary = query.data?.summary ?? {};

  const { matrix, max } = useMemo(() => {
    const grid: Array<Array<{ revenue: number; orders: number }>> = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => ({ revenue: 0, orders: 0 }))
    );
    let maxRev = 0;
    rows.forEach((r) => {
      if (r.weekday >= 0 && r.weekday < 7 && r.hour >= 0 && r.hour < 24) {
        grid[r.weekday][r.hour] = { revenue: Number(r.revenue || 0), orders: Number(r.order_count || 0) };
        if (Number(r.revenue || 0) > maxRev) maxRev = Number(r.revenue || 0);
      }
    });
    return { matrix: grid, max: maxRev };
  }, [rows]);

  return (
    <div className="mt-6 bg-[#1a1d27] border border-white/10 p-6 rounded-3xl">
      <WidgetHeader
        title="Hourly Sales Heatmap"
        subtitle={`Peak ${String(summary.peak_weekday ?? '—')} · ${summary.peak_hour !== undefined ? formatHour(Number(summary.peak_hour)) : '—'}`}
        onExport={onExport}
      />
      <WidgetState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={rows.length === 0 || max === 0}
        emptyMessage="No hourly sales data for selected filters."
      >
        <div className="overflow-x-auto">
          <table className="min-w-[780px] w-full text-[11px] border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="w-10 sticky left-0 bg-[#1a1d27]"></th>
                {HOURS.map((h) => (
                  <th key={h} className="text-[10px] font-medium text-gray-500 text-center pb-1">
                    {formatHour(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WEEKDAYS.map((day, wIdx) => (
                <tr key={day}>
                  <td className="sticky left-0 bg-[#1a1d27] font-semibold text-gray-400 text-right pr-2 w-10">
                    {day}
                  </td>
                  {HOURS.map((h) => {
                    const cell = matrix[wIdx][h];
                    const intensity = max > 0 ? Math.min(1, cell.revenue / max) : 0;
                    return (
                      <td key={h} className="p-0">
                        <div
                          title={`${day} ${formatHour(h)} · ${cell.orders} orders · ${formatPrice(cell.revenue)}`}
                          className="h-6 w-full rounded border border-white/5"
                          style={{
                            backgroundColor: intensity > 0
                              ? `rgba(99, 102, 241, ${0.15 + intensity * 0.85})`
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
        </div>
      </WidgetState>
    </div>
  );
}

function DoughnutWidget<T extends { amount?: number; revenue?: number }>({
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

function PaymentMixWidget({ query, onExport }: { query: Props['paymentMixQuery']; onExport: () => void }) {
  const rows = (query.data?.data ?? []) as PaymentMixRow[];
  const summary = query.data?.summary ?? {};

  const table = (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-white/10">
            <th className="py-2 pr-3">Method</th>
            <th className="py-2 pr-3 text-right">Orders</th>
            <th className="py-2 pr-3 text-right">Amount</th>
            <th className="py-2 text-right">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.payment_method} className="border-b border-white/5 last:border-b-0">
              <td className="py-2 pr-3 capitalize text-white font-medium">{r.payment_method}</td>
              <td className="py-2 pr-3 text-right text-gray-200">{r.order_count}</td>
              <td className="py-2 pr-3 text-right font-semibold text-indigo-300">{formatPrice(Number(r.amount))}</td>
              <td className="py-2 text-right text-gray-300">{Number(r.share_pct).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <DoughnutWidget
      title="Payment Method Mix"
      subtitle={`${Number(summary.total_orders ?? 0)} orders · ${Number(summary.split_orders ?? 0)} split-payment`}
      icon={<CreditCard className="h-4 w-4" />}
      rows={rows}
      labelKey="payment_method"
      valueKey="amount"
      query={query}
      onExport={onExport}
      trailing={table}
      emptyMessage="No payments for selected filters."
    />
  );
}

function FulfillmentWidget({ query, onExport }: { query: Props['fulfillmentMixQuery']; onExport: () => void }) {
  const rows = (query.data?.data ?? []) as FulfillmentMixRow[];
  const summary = query.data?.summary ?? {};

  const table = (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-white/10">
            <th className="py-2 pr-3">Type</th>
            <th className="py-2 pr-3 text-right">Orders</th>
            <th className="py-2 pr-3 text-right">Revenue</th>
            <th className="py-2 text-right">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.fulfillment_type} className="border-b border-white/5 last:border-b-0">
              <td className="py-2 pr-3 capitalize text-white font-medium">{r.fulfillment_type.replace(/_/g, ' ')}</td>
              <td className="py-2 pr-3 text-right text-gray-200">{r.order_count}</td>
              <td className="py-2 pr-3 text-right font-semibold text-indigo-300">{formatPrice(Number(r.revenue))}</td>
              <td className="py-2 text-right text-gray-300">{Number(r.share_pct).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <DoughnutWidget
      title="Fulfillment Breakdown"
      subtitle={`${Number(summary.total_orders ?? 0)} orders · ${Number(summary.fulfillment_types ?? 0)} types`}
      icon={<Truck className="h-4 w-4" />}
      rows={rows}
      labelKey="fulfillment_type"
      valueKey="revenue"
      query={query}
      onExport={onExport}
      trailing={table}
      emptyMessage="No fulfillment data for selected filters."
    />
  );
}

function DiscountWidget({ query, onExport }: { query: Props['discountImpactQuery']; onExport: () => void }) {
  const rows = (query.data?.data ?? []) as DiscountImpactRow[];
  const summary = query.data?.summary ?? {};

  return (
    <div className="mt-6 bg-[#1a1d27] border border-white/10 p-6 rounded-3xl">
      <WidgetHeader
        title="Discount Impact"
        subtitle="Gross → Net by outlet"
        onExport={onExport}
        extra={<Tag className="h-4 w-4 text-gray-500" />}
      />
      <WidgetState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={rows.length === 0}
        emptyMessage="No discount data for selected filters."
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Gross', value: formatPrice(Number(summary.gross_sales ?? 0)) },
            { label: 'Total Discount', value: formatPrice(Number(summary.total_discount ?? 0)), accent: 'text-red-300' },
            { label: 'Net', value: formatPrice(Number(summary.net_sales ?? 0)), accent: 'text-emerald-300' },
            { label: 'Disc %', value: `${Number(summary.discount_rate_pct ?? 0).toFixed(1)}%` },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <p className="text-[10px] uppercase tracking-wide text-gray-400">{kpi.label}</p>
              <p className={`text-lg font-bold mt-0.5 ${kpi.accent ?? 'text-white'}`}>{kpi.value}</p>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-white/10">
                <th className="py-2 pr-3">Outlet</th>
                <th className="py-2 pr-3 text-right">Orders</th>
                <th className="py-2 pr-3 text-right">Gross</th>
                <th className="py-2 pr-3 text-right">Total Disc.</th>
                <th className="py-2 pr-3 text-right">Net</th>
                <th className="py-2 text-right">Disc %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.outlet_id} className="border-b border-white/5 last:border-b-0">
                  <td className="py-2 pr-3 text-white font-medium">{r.outlet_name}</td>
                  <td className="py-2 pr-3 text-right text-gray-200">{r.order_count}</td>
                  <td className="py-2 pr-3 text-right text-gray-200">{formatPrice(Number(r.gross_sales))}</td>
                  <td className="py-2 pr-3 text-right text-red-300">{formatPrice(Number(r.total_discount))}</td>
                  <td className="py-2 pr-3 text-right font-semibold text-emerald-300">{formatPrice(Number(r.net_sales))}</td>
                  <td className="py-2 text-right text-gray-300">{Number(r.discount_rate_pct).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </WidgetState>
    </div>
  );
}

function CashierWidget({ query, onExport }: { query: Props['cashierPerfQuery']; onExport: () => void }) {
  const rows = (query.data?.data ?? []) as CashierPerformanceRow[];
  const summary = query.data?.summary ?? {};

  return (
    <div className="mt-6 bg-[#1a1d27] border border-white/10 p-6 rounded-3xl">
      <WidgetHeader
        title="Cashier / Session Performance"
        subtitle={`${Number(summary.total_sessions ?? 0)} sessions · ${Number(summary.total_orders ?? 0)} orders · Avg ticket ${formatPrice(Number(summary.avg_ticket ?? 0))}`}
        onExport={onExport}
        extra={<UserCheck className="h-4 w-4 text-gray-500" />}
      />
      <WidgetState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={rows.length === 0}
        emptyMessage="No cashier sessions for selected filters."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-white/10">
                <th className="py-2 pr-3">Cashier</th>
                <th className="py-2 pr-3">Outlet</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Opened</th>
                <th className="py-2 pr-3 text-right">Orders</th>
                <th className="py-2 pr-3 text-right">Sales</th>
                <th className="py-2 text-right">Variance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const variance = r.cash_variance;
                const varCls = variance === null || variance === undefined
                  ? 'text-gray-500'
                  : variance === 0 ? 'text-gray-300'
                    : variance > 0 ? 'text-emerald-300' : 'text-red-300';
                return (
                  <tr key={r.session_id} className="border-b border-white/5 last:border-b-0">
                    <td className="py-2 pr-3 text-white font-medium">{r.cashier_name}</td>
                    <td className="py-2 pr-3 text-gray-200">{r.outlet_name}</td>
                    <td className="py-2 pr-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-wide ${r.status === 'open' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/10 text-gray-300'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-gray-300 text-xs">{formatDateTime(r.opened_at)}</td>
                    <td className="py-2 pr-3 text-right text-gray-200">{r.orders_count}</td>
                    <td className="py-2 pr-3 text-right font-semibold text-indigo-300">{formatPrice(Number(r.gross_sales))}</td>
                    <td className={`py-2 text-right font-medium ${varCls}`}>
                      {variance === null || variance === undefined ? '—' : `${variance > 0 ? '+' : ''}${formatPrice(Number(variance))}`}
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

function ReturnsWidget({ query, onExport, navigate }: { query: Props['returnsQuery']; onExport: () => void; navigate: NavigateFunction }) {
  const rows = (query.data?.data ?? []) as SalesReturnsRow[];
  const summary = query.data?.summary ?? {};

  return (
    <div className="mt-6 bg-[#1a1d27] border border-white/10 p-6 rounded-3xl">
      <WidgetHeader
        title="Refunds / Returns"
        subtitle={`${Number(summary.total_returns ?? 0)} returns · ${formatPrice(Number(summary.total_return_value ?? 0))}`}
        onExport={onExport}
        extra={
          <>
            <button
              onClick={() => navigate('/reports/sales/returns')}
              className="h-8 px-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs font-medium flex items-center gap-1.5"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Full Report
            </button>
            <RotateCcw className="h-4 w-4 text-gray-500" />
          </>
        }
      />
      <WidgetState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={rows.length === 0}
        emptyMessage="No returns for selected filters."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-white/10">
                <th className="py-2 pr-3">Return Date</th>
                <th className="py-2 pr-3">Customer</th>
                <th className="py-2 pr-3">Outlet</th>
                <th className="py-2 pr-3 text-right">Items</th>
                <th className="py-2 pr-3 text-right">Value</th>
                <th className="py-2 pr-3">Reason</th>
                <th className="py-2">Refund</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((r) => (
                <tr key={r.order_id} className="border-b border-white/5 last:border-b-0">
                  <td className="py-2 pr-3 text-gray-200">{r.return_date || '—'}</td>
                  <td className="py-2 pr-3 text-white font-medium">{r.customer_name}</td>
                  <td className="py-2 pr-3 text-gray-200">{r.outlet_name}</td>
                  <td className="py-2 pr-3 text-right text-gray-200">{r.items_count}</td>
                  <td className="py-2 pr-3 text-right font-semibold text-red-300">{formatPrice(Number(r.total_amount))}</td>
                  <td className="py-2 pr-3 text-gray-300">{r.reason}</td>
                  <td className="py-2 text-gray-300 capitalize">{r.payment_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 10 && (
            <p className="text-[11px] text-gray-500 mt-3 text-right">Showing 10 of {rows.length} — open the full report for all rows.</p>
          )}
        </div>
      </WidgetState>
    </div>
  );
}

export default function PosAnalyticsBatchAWidgets(props: Props) {
  const {
    hourlyHeatmapQuery,
    paymentMixQuery,
    fulfillmentMixQuery,
    discountImpactQuery,
    cashierPerfQuery,
    returnsQuery,
    canViewAllPosSessions,
    handleDownloadPosWidget,
    navigate,
  } = props;

  return (
    <>
      <HeatmapWidget
        query={hourlyHeatmapQuery}
        onExport={() => handleDownloadPosWidget('/reports/sales/hourly-heatmap', 'Hourly Heatmap')}
      />
      <PaymentMixWidget
        query={paymentMixQuery}
        onExport={() => handleDownloadPosWidget('/reports/sales/payment-mix', 'Payment Mix')}
      />
      <FulfillmentWidget
        query={fulfillmentMixQuery}
        onExport={() => handleDownloadPosWidget('/reports/sales/fulfillment-mix', 'Fulfillment Mix')}
      />
      <DiscountWidget
        query={discountImpactQuery}
        onExport={() => handleDownloadPosWidget('/reports/sales/discount-impact', 'Discount Impact')}
      />
      {canViewAllPosSessions && (
        <CashierWidget
          query={cashierPerfQuery}
          onExport={() => handleDownloadPosWidget('/reports/sales/cashier-performance', 'Cashier Performance')}
        />
      )}
      <ReturnsWidget
        query={returnsQuery}
        onExport={() => handleDownloadPosWidget('/reports/sales/returns', 'Returns')}
        navigate={navigate}
      />
    </>
  );
}
