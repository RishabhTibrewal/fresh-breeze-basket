import apiClient from '@/lib/apiClient';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------
export interface ReportFilter {
  from_date?: string;       // YYYY-MM-DD
  to_date?: string;         // YYYY-MM-DD
  branch_ids?: string[];    // warehouse IDs
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
  export?: 'pdf' | 'excel' | 'none';
  currency?: string;
  search?: string;
  [key: string]: unknown;   // allow module-specific params
}

export interface ReportMeta {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ReportResponse<T = Record<string, unknown>> {
  success: true;
  report_key: string;
  report_title: string;
  generated_at: string;
  filters_applied: ReportFilter;
  meta: ReportMeta;
  summary: Record<string, number | string>;
  data: T[];
}

export interface SalesProductWiseRow {
  product_id: string;
  variant_id: string;
  product_name: string;
  variant_name: string;
  sku: string;
  total_qty: number;
  total_revenue: number;
  avg_unit_price: number;
  total_tax: number;
  order_count: number;
}

export interface HourlyHeatmapRow {
  weekday: number;
  weekday_label: string;
  hour: number;
  order_count: number;
  revenue: number;
}

export interface PaymentMixRow {
  payment_method: string;
  order_count: number;
  amount: number;
  share_pct: number;
}

export interface FulfillmentMixRow {
  fulfillment_type: string;
  order_count: number;
  revenue: number;
  avg_order_value: number;
  share_pct: number;
}

export interface DiscountImpactRow {
  outlet_id: string;
  outlet_name: string;
  order_count: number;
  orders_with_discount: number;
  gross_sales: number;
  line_discount: number;
  extra_discount: number;
  cd_amount: number;
  total_discount: number;
  net_sales: number;
  discount_rate_pct: number;
}

export interface CashierPerformanceRow {
  session_id: string;
  cashier_id: string;
  cashier_name: string;
  outlet_id: string;
  outlet_name: string;
  status: string;
  opened_at: string;
  closed_at: string | null;
  duration_min: number;
  orders_count: number;
  gross_sales: number;
  avg_ticket: number;
  opening_cash: number;
  closing_cash: number | null;
  expected_cash: number | null;
  cash_variance: number | null;
}

export interface SalesReturnsRow {
  order_id: string;
  original_order_id: string;
  return_date: string;
  customer_name: string;
  outlet_name: string;
  order_source: string;
  items_count: number;
  total_amount: number;
  payment_status: string;
  reason: string;
}

// --- Batch B (medium-effort insight reports) --------------------------------
export interface CategoryBrandSalesRow {
  category_id: string;
  category_name: string;
  brand_id: string;
  brand_name: string;
  total_qty: number;
  total_revenue: number;
  list_value: number;
  total_discount: number;
  discount_pct: number;
  margin_retention_pct: number;
  order_count: number;
}

export interface AverageBasketRow {
  day: string;
  orders: number;
  items: number;
  unique_skus: number;
  revenue: number;
  avg_basket_value: number;
  avg_items_per_order: number;
  avg_unique_skus: number;
}

export interface ModifierRevenueRow {
  modifier_id: string;
  modifier_name: string;
  group_name: string;
  attach_count: number;
  orders_attached: number;
  total_adjust: number;
  avg_adjust: number;
  attach_rate_pct: number;
}

export interface TrendComparisonRow {
  dimension: 'hour' | 'weekday';
  bucket: number;
  label: string;
  current_orders: number;
  current_revenue: number;
  previous_orders: number;
  previous_revenue: number;
  orders_delta_pct: number;
  revenue_delta_pct: number;
}

export interface MoverRow {
  product_id: string;
  variant_id: string;
  product_name: string;
  sku: string;
  current_qty: number;
  previous_qty: number;
  qty_delta: number;
  qty_delta_pct: number;
  current_revenue: number;
  previous_revenue: number;
  revenue_delta: number;
  revenue_delta_pct: number;
  direction: 'up' | 'down' | 'flat';
}

export interface OutletLeaderboardRow {
  rank: number;
  outlet_id: string;
  outlet_name: string;
  current_revenue: number;
  previous_revenue: number;
  revenue_delta_pct: number;
  current_orders: number;
  previous_orders: number;
  orders_delta_pct: number;
  items_sold: number;
  avg_ticket: number;
  items_per_order: number;
}

// ---------------------------------------------------------------------------
// Generic fetch helper
// ---------------------------------------------------------------------------
export async function fetchReport<T = Record<string, unknown>>(
  endpoint: string,
  filters?: ReportFilter
): Promise<ReportResponse<T>> {
  // Flatten branch_ids array → comma-sep string for query string
  const params: Record<string, unknown> = { ...filters };
  if (Array.isArray(filters?.branch_ids)) {
    params.branch_ids = filters!.branch_ids.join(',');
  }
  const { data } = await apiClient.get<ReportResponse<T>>(endpoint, { params });
  return data;
}

// ---------------------------------------------------------------------------
// Export download helper (triggers file download in browser)
// ---------------------------------------------------------------------------
export async function downloadReport(
  endpoint: string,
  format: 'pdf' | 'excel',
  filters?: ReportFilter
): Promise<void> {
  const params: Record<string, unknown> = { ...filters, export: format };
  if (Array.isArray(filters?.branch_ids)) {
    params.branch_ids = (filters!.branch_ids as string[]).join(',');
  }

  const response = await apiClient.get(endpoint, {
    params,
    responseType: 'blob',
  });

  const contentDisposition = response.headers['content-disposition'] as string | undefined;
  const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/);
  const filename = filenameMatch?.[1] ?? `report.${format === 'pdf' ? 'pdf' : 'xlsx'}`;

  const url = window.URL.createObjectURL(new Blob([response.data as BlobPart]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Module-specific typed fetchers (add more as modules are implemented)
// ---------------------------------------------------------------------------
export const reportsApi = {
  // Sales
  salesOrderSummary: (f?: ReportFilter) => fetchReport('/reports/sales/order-summary', f),
  salesSalespersonPerformance: (f?: ReportFilter) => fetchReport('/reports/sales/salesperson-performance', f),
  salesCustomerWise: (f?: ReportFilter) => fetchReport('/reports/sales/customer-wise', f),
  salesProductWise: (f?: ReportFilter) => fetchReport<SalesProductWiseRow>('/reports/sales/product-wise', f),
  salesTargetVsAchievement: (f?: ReportFilter) => fetchReport('/reports/sales/target-vs-achievement', f),
  salesPendingDeliveries: (f?: ReportFilter) => fetchReport('/reports/sales/pending-deliveries', f),
  salesReturns: (f?: ReportFilter) => fetchReport<SalesReturnsRow>('/reports/sales/returns', f),
  salesPriceVariance: (f?: ReportFilter) => fetchReport('/reports/sales/price-variance', f),
  salesRegionTerritory: (f?: ReportFilter) => fetchReport('/reports/sales/region-territory', f),

  // High-impact POS analytics reports
  salesHourlyHeatmap: (f?: ReportFilter) => fetchReport<HourlyHeatmapRow>('/reports/sales/hourly-heatmap', f),
  salesPaymentMix: (f?: ReportFilter) => fetchReport<PaymentMixRow>('/reports/sales/payment-mix', f),
  salesFulfillmentMix: (f?: ReportFilter) => fetchReport<FulfillmentMixRow>('/reports/sales/fulfillment-mix', f),
  salesDiscountImpact: (f?: ReportFilter) => fetchReport<DiscountImpactRow>('/reports/sales/discount-impact', f),
  posCashierPerformance: (f?: ReportFilter) => fetchReport<CashierPerformanceRow>('/reports/sales/cashier-performance', f),

  // Medium-effort insight reports (Batch B)
  salesCategoryBrand: (f?: ReportFilter) => fetchReport<CategoryBrandSalesRow>('/reports/sales/category-brand', f),
  salesBasketMetrics: (f?: ReportFilter) => fetchReport<AverageBasketRow>('/reports/sales/basket-metrics', f),
  salesModifierRevenue: (f?: ReportFilter) => fetchReport<ModifierRevenueRow>('/reports/sales/modifier-revenue', f),
  salesTrendComparison: (f?: ReportFilter) => fetchReport<TrendComparisonRow>('/reports/sales/trend-comparison', f),
  salesMovers: (f?: ReportFilter) => fetchReport<MoverRow>('/reports/sales/movers', f),
  salesOutletLeaderboard: (f?: ReportFilter) => fetchReport<OutletLeaderboardRow>('/reports/sales/outlet-leaderboard', f),

  // Inventory
  stockLedger: (f?: ReportFilter) => fetchReport('/reports/inventory/stock-ledger', f),
  currentStock: (f?: ReportFilter) => fetchReport('/reports/inventory/current-stock', f),
  repackSummary: (f?: ReportFilter) => fetchReport('/reports/inventory/repack-summary', f),
  repackCostAnalysis: (f?: ReportFilter) => fetchReport('/reports/inventory/repack-cost-analysis', f),
  wastageReport: (f?: ReportFilter) => fetchReport('/reports/inventory/wastage', f),
  recipeEfficiency: (f?: ReportFilter) => fetchReport('/reports/inventory/recipe-efficiency', f),

  // Procurement
  poRegister: (f?: ReportFilter) => fetchReport('/reports/procurement/po-register', f),
  vendorWise: (f?: ReportFilter) => fetchReport('/reports/procurement/vendor-wise', f),
  grnReport: (f?: ReportFilter) => fetchReport('/reports/procurement/grn', f),
  invoiceAgeing: (f?: ReportFilter) => fetchReport('/reports/procurement/invoice-ageing', f),
  pendingReceipts: (f?: ReportFilter) => fetchReport('/reports/procurement/pending-receipts', f),
  rateComparison: (f?: ReportFilter) => fetchReport('/reports/procurement/rate-comparison', f),
};

export default reportsApi;
