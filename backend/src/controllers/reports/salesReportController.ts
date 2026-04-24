import { Request, Response, NextFunction } from 'express';
import { buildReportResponse } from '../../middleware/reportValidator';
import ExportService, { ExportColumn } from '../../services/ExportService';
import * as svc from '../../services/reports/salesReportService';

// ---------------------------------------------------------------------------
// Helper: send either JSON or export file depending on ?export= param
// ---------------------------------------------------------------------------
async function respond<T>(
  req: Request,
  res: Response,
  next: NextFunction,
  { rows, total, summary, reportKey, reportTitle, columns }: {
    rows: T[];
    total: number;
    summary: Record<string, number | string>;
    reportKey: string;
    reportTitle: string;
    columns: ExportColumn[];
  }
) {
  try {
    const q = req.reportQuery!;
    if (q.export === 'pdf' || q.export === 'excel') {
      await ExportService.sendExport(res, q.export, {
        title: reportTitle,
        filters: q,
        columns,
        rows: rows as Record<string, unknown>[],
        currency: q.currency,
      });
      return;
    }
    res.json(buildReportResponse({
      reportKey,
      reportTitle,
      filters: q,
      data: rows,
      total,
      page: q.page,
      pageSize: q.page_size,
      summary,
    }));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// 1. Sales Order Summary
// ---------------------------------------------------------------------------
const ORDER_SUMMARY_COLS: ExportColumn[] = [
  { key: 'order_id', label: 'Order ID', width: 38 },
  { key: 'order_date', label: 'Date', format: 'date', width: 14 },
  { key: 'customer_name', label: 'Customer', width: 24 },
  { key: 'warehouse', label: 'Branch', width: 18 },
  { key: 'order_source', label: 'Source', width: 14 },
  { key: 'status', label: 'Status', width: 14 },
  { key: 'payment_method', label: 'Payment', width: 14 },
  { key: 'total_amount', label: 'Gross', format: 'currency', align: 'right', width: 16 },
  { key: 'tax_amount', label: 'Tax', format: 'currency', align: 'right', width: 14 },
  { key: 'net_amount', label: 'Net', format: 'currency', align: 'right', width: 14 },
];

export const salesOrderSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getSalesOrderSummary(req.reportQuery!, req.companyId!);
    await respond(req, res, next, { rows, total, summary, reportKey: 'sales.order_summary', reportTitle: 'Sales Order Summary', columns: ORDER_SUMMARY_COLS });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 2. Salesperson Performance
// ---------------------------------------------------------------------------
const SALESPERSON_COLS: ExportColumn[] = [
  { key: 'executive_name', label: 'Salesperson', width: 24 },
  { key: 'executive_email', label: 'Email', width: 28 },
  { key: 'total_orders', label: 'Orders', format: 'number', align: 'right', width: 12 },
  { key: 'unique_customers', label: 'Customers', format: 'number', align: 'right', width: 14 },
  { key: 'total_revenue', label: 'Revenue', format: 'currency', align: 'right', width: 18 },
  { key: 'avg_order_value', label: 'Avg Order', format: 'currency', align: 'right', width: 16 },
  { key: 'target_amount', label: 'Target', format: 'currency', align: 'right', width: 16 },
  { key: 'achievement_pct', label: 'Achievement %', format: 'percent', align: 'right', width: 16 },
];

export const salespersonPerformance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getSalespersonPerformance(req.reportQuery!, req.companyId!);
    await respond(req, res, next, { rows, total, summary, reportKey: 'sales.salesperson_performance', reportTitle: 'Salesperson Performance', columns: SALESPERSON_COLS });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 3. Customer-wise Sales
// ---------------------------------------------------------------------------
const CUSTOMER_COLS: ExportColumn[] = [
  { key: 'customer_name', label: 'Customer', width: 24 },
  { key: 'email', label: 'Email', width: 28 },
  { key: 'phone', label: 'Phone', width: 16 },
  { key: 'total_orders', label: 'Orders', format: 'number', align: 'right', width: 12 },
  { key: 'total_revenue', label: 'Revenue', format: 'currency', align: 'right', width: 18 },
  { key: 'avg_order_value', label: 'Avg Order', format: 'currency', align: 'right', width: 16 },
  { key: 'last_order_date', label: 'Last Order', format: 'date', width: 14 },
];

export const customerWiseSales = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getCustomerWiseSales(req.reportQuery!, req.companyId!);
    await respond(req, res, next, { rows, total, summary, reportKey: 'sales.customer_wise', reportTitle: 'Customer-wise Sales', columns: CUSTOMER_COLS });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 4. Product-wise Sales
// ---------------------------------------------------------------------------
const PRODUCT_COLS: ExportColumn[] = [
  { key: 'product_name', label: 'Product', width: 24 },
  { key: 'variant_name', label: 'Variant', width: 18 },
  { key: 'sku', label: 'SKU', width: 16 },
  { key: 'total_qty', label: 'Qty Sold', format: 'number', align: 'right', width: 12 },
  { key: 'avg_unit_price', label: 'Avg Price', format: 'currency', align: 'right', width: 16 },
  { key: 'total_revenue', label: 'Revenue', format: 'currency', align: 'right', width: 18 },
  { key: 'total_tax', label: 'Tax', format: 'currency', align: 'right', width: 14 },
  { key: 'order_count', label: 'Orders', format: 'number', align: 'right', width: 12 },
];

export const productWiseSales = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getProductWiseSales(req.reportQuery!, req.companyId!);
    await respond(req, res, next, { rows, total, summary, reportKey: 'sales.product_wise', reportTitle: 'Product-wise Sales', columns: PRODUCT_COLS });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 5. Target vs Achievement
// ---------------------------------------------------------------------------
const TARGET_COLS: ExportColumn[] = [
  { key: 'executive_name', label: 'Salesperson', width: 24 },
  { key: 'period_type', label: 'Period Type', width: 14 },
  { key: 'period_start', label: 'Period From', format: 'date', width: 14 },
  { key: 'period_end', label: 'Period To', format: 'date', width: 14 },
  { key: 'target_amount', label: 'Target', format: 'currency', align: 'right', width: 18 },
  { key: 'achieved_amount', label: 'Achieved', format: 'currency', align: 'right', width: 18 },
  { key: 'variance', label: 'Variance', format: 'currency', align: 'right', width: 18 },
  { key: 'achievement_pct', label: 'Achievement %', format: 'percent', align: 'right', width: 16 },
  { key: 'status', label: 'Status', width: 16 },
];

export const targetVsAchievement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getTargetVsAchievement(req.reportQuery!, req.companyId!);
    await respond(req, res, next, { rows, total, summary, reportKey: 'sales.target_vs_achievement', reportTitle: 'Target vs Achievement', columns: TARGET_COLS });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 6. Pending Deliveries
// ---------------------------------------------------------------------------
const PENDING_COLS: ExportColumn[] = [
  { key: 'order_id', label: 'Order ID', width: 38 },
  { key: 'order_date', label: 'Order Date', format: 'date', width: 14 },
  { key: 'customer_name', label: 'Customer', width: 24 },
  { key: 'warehouse', label: 'Branch', width: 18 },
  { key: 'status', label: 'Status', width: 14 },
  { key: 'total_amount', label: 'Order Value', format: 'currency', align: 'right', width: 16 },
  { key: 'days_pending', label: 'Days Pending', format: 'number', align: 'right', width: 14 },
];

export const pendingDeliveries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getPendingDeliveries(req.reportQuery!, req.companyId!);
    await respond(req, res, next, { rows, total, summary, reportKey: 'sales.pending_deliveries', reportTitle: 'Pending Deliveries', columns: PENDING_COLS });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 7. Sales Returns
// ---------------------------------------------------------------------------
const RETURNS_COLS: ExportColumn[] = [
  { key: 'order_id', label: 'Return ID', width: 38 },
  { key: 'original_order_id', label: 'Original Order', width: 38 },
  { key: 'return_date', label: 'Return Date', format: 'date', width: 14 },
  { key: 'customer_name', label: 'Customer', width: 24 },
  { key: 'outlet_name', label: 'Outlet', width: 18 },
  { key: 'order_source', label: 'Source', width: 14 },
  { key: 'items_count', label: 'Items', format: 'number', align: 'right', width: 10 },
  { key: 'total_amount', label: 'Return Value', format: 'currency', align: 'right', width: 16 },
  { key: 'payment_status', label: 'Refund Status', width: 16 },
  { key: 'reason', label: 'Reason', width: 24 },
];

export const salesReturns = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getSalesReturns(req.reportQuery!, req.companyId!);
    await respond(req, res, next, { rows, total, summary, reportKey: 'sales.returns', reportTitle: 'Sales Returns', columns: RETURNS_COLS });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 9. Hourly Sales Heatmap
// ---------------------------------------------------------------------------
const HEATMAP_COLS: ExportColumn[] = [
  { key: 'weekday_label', label: 'Day', width: 10 },
  { key: 'hour', label: 'Hour', format: 'number', align: 'right', width: 8 },
  { key: 'order_count', label: 'Orders', format: 'number', align: 'right', width: 10 },
  { key: 'revenue', label: 'Revenue', format: 'currency', align: 'right', width: 16 },
];

export const hourlyHeatmap = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getHourlyHeatmap(req.reportQuery!, req.companyId!);
    await respond(req, res, next, { rows, total, summary, reportKey: 'sales.hourly_heatmap', reportTitle: 'Hourly Sales Heatmap', columns: HEATMAP_COLS });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 10. Payment Method Mix
// ---------------------------------------------------------------------------
const PAYMENT_MIX_COLS: ExportColumn[] = [
  { key: 'payment_method', label: 'Payment Method', width: 18 },
  { key: 'order_count', label: 'Orders', format: 'number', align: 'right', width: 12 },
  { key: 'amount', label: 'Amount', format: 'currency', align: 'right', width: 18 },
  { key: 'share_pct', label: 'Share %', format: 'percent', align: 'right', width: 12 },
];

export const paymentMix = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getPaymentMix(req.reportQuery!, req.companyId!);
    await respond(req, res, next, { rows, total, summary, reportKey: 'sales.payment_mix', reportTitle: 'Payment Method Mix', columns: PAYMENT_MIX_COLS });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 11. Fulfillment Type Breakdown
// ---------------------------------------------------------------------------
const FULFILLMENT_MIX_COLS: ExportColumn[] = [
  { key: 'fulfillment_type', label: 'Fulfillment Type', width: 18 },
  { key: 'order_count', label: 'Orders', format: 'number', align: 'right', width: 12 },
  { key: 'revenue', label: 'Revenue', format: 'currency', align: 'right', width: 18 },
  { key: 'avg_order_value', label: 'Avg Order', format: 'currency', align: 'right', width: 16 },
  { key: 'share_pct', label: 'Share %', format: 'percent', align: 'right', width: 12 },
];

export const fulfillmentMix = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getFulfillmentMix(req.reportQuery!, req.companyId!);
    await respond(req, res, next, { rows, total, summary, reportKey: 'sales.fulfillment_mix', reportTitle: 'Fulfillment Type Breakdown', columns: FULFILLMENT_MIX_COLS });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 12. Discount Impact
// ---------------------------------------------------------------------------
const DISCOUNT_IMPACT_COLS: ExportColumn[] = [
  { key: 'outlet_name', label: 'Outlet', width: 20 },
  { key: 'order_count', label: 'Orders', format: 'number', align: 'right', width: 10 },
  { key: 'orders_with_discount', label: 'w/ Discount', format: 'number', align: 'right', width: 12 },
  { key: 'gross_sales', label: 'Gross Sales', format: 'currency', align: 'right', width: 18 },
  { key: 'line_discount', label: 'Line Disc.', format: 'currency', align: 'right', width: 16 },
  { key: 'extra_discount', label: 'Extra Disc.', format: 'currency', align: 'right', width: 16 },
  { key: 'cd_amount', label: 'Cash Disc.', format: 'currency', align: 'right', width: 16 },
  { key: 'total_discount', label: 'Total Disc.', format: 'currency', align: 'right', width: 16 },
  { key: 'net_sales', label: 'Net Sales', format: 'currency', align: 'right', width: 18 },
  { key: 'discount_rate_pct', label: 'Disc %', format: 'percent', align: 'right', width: 12 },
];

export const discountImpact = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getDiscountImpact(req.reportQuery!, req.companyId!);
    await respond(req, res, next, { rows, total, summary, reportKey: 'sales.discount_impact', reportTitle: 'Discount Impact', columns: DISCOUNT_IMPACT_COLS });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 13. Cashier / Session Performance
// ---------------------------------------------------------------------------
const CASHIER_PERF_COLS: ExportColumn[] = [
  { key: 'cashier_name', label: 'Cashier', width: 22 },
  { key: 'outlet_name', label: 'Outlet', width: 18 },
  { key: 'status', label: 'Status', width: 10 },
  { key: 'opened_at', label: 'Opened', format: 'date', width: 16 },
  { key: 'closed_at', label: 'Closed', format: 'date', width: 16 },
  { key: 'duration_min', label: 'Duration (min)', format: 'number', align: 'right', width: 14 },
  { key: 'orders_count', label: 'Orders', format: 'number', align: 'right', width: 10 },
  { key: 'gross_sales', label: 'Sales', format: 'currency', align: 'right', width: 18 },
  { key: 'avg_ticket', label: 'Avg Ticket', format: 'currency', align: 'right', width: 16 },
  { key: 'opening_cash', label: 'Opening Cash', format: 'currency', align: 'right', width: 16 },
  { key: 'closing_cash', label: 'Closing Cash', format: 'currency', align: 'right', width: 16 },
  { key: 'expected_cash', label: 'Expected Cash', format: 'currency', align: 'right', width: 16 },
  { key: 'cash_variance', label: 'Cash Variance', format: 'currency', align: 'right', width: 16 },
];

export const cashierPerformance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getCashierPerformance(req.reportQuery!, req.companyId!);
    await respond(req, res, next, { rows, total, summary, reportKey: 'pos.cashier_performance', reportTitle: 'Cashier / Session Performance', columns: CASHIER_PERF_COLS });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 14. Category-wise & Brand-wise Sales (Batch B)
// ---------------------------------------------------------------------------
const CATEGORY_BRAND_COLS: ExportColumn[] = [
  { key: 'category_name', label: 'Category', width: 22 },
  { key: 'brand_name', label: 'Brand', width: 20 },
  { key: 'total_qty', label: 'Qty', format: 'number', align: 'right', width: 10 },
  { key: 'order_count', label: 'Orders', format: 'number', align: 'right', width: 10 },
  { key: 'total_revenue', label: 'Revenue', format: 'currency', align: 'right', width: 18 },
  { key: 'list_value', label: 'List Value', format: 'currency', align: 'right', width: 18 },
  { key: 'total_discount', label: 'Discount', format: 'currency', align: 'right', width: 16 },
  { key: 'discount_pct', label: 'Disc %', format: 'percent', align: 'right', width: 10 },
  { key: 'margin_retention_pct', label: 'Retention %', format: 'percent', align: 'right', width: 12 },
];

export const categoryBrandSales = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getCategoryBrandSales(req.reportQuery!, req.companyId!);
    await respond(req, res, next, {
      rows, total, summary,
      reportKey: 'sales.category_brand',
      reportTitle: 'Category-wise & Brand-wise Sales',
      columns: CATEGORY_BRAND_COLS,
    });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 15. Average Basket Metrics (Batch B)
// ---------------------------------------------------------------------------
const BASKET_COLS: ExportColumn[] = [
  { key: 'day', label: 'Date', format: 'date', width: 14 },
  { key: 'orders', label: 'Orders', format: 'number', align: 'right', width: 10 },
  { key: 'items', label: 'Items', format: 'number', align: 'right', width: 10 },
  { key: 'unique_skus', label: 'Unique SKUs', format: 'number', align: 'right', width: 14 },
  { key: 'revenue', label: 'Revenue', format: 'currency', align: 'right', width: 18 },
  { key: 'avg_basket_value', label: 'Avg Basket', format: 'currency', align: 'right', width: 16 },
  { key: 'avg_items_per_order', label: 'Avg Items/Order', format: 'number', align: 'right', width: 16 },
  { key: 'avg_unique_skus', label: 'Avg Unique SKUs', format: 'number', align: 'right', width: 16 },
];

export const basketMetrics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getAverageBasketMetrics(req.reportQuery!, req.companyId!);
    await respond(req, res, next, {
      rows, total, summary,
      reportKey: 'sales.basket_metrics',
      reportTitle: 'Average Basket Metrics',
      columns: BASKET_COLS,
    });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 16. Modifier / Add-on Revenue (Batch B)
// ---------------------------------------------------------------------------
const MODIFIER_COLS: ExportColumn[] = [
  { key: 'modifier_name', label: 'Modifier', width: 22 },
  { key: 'group_name', label: 'Group', width: 18 },
  { key: 'attach_count', label: 'Attached', format: 'number', align: 'right', width: 12 },
  { key: 'orders_attached', label: 'Orders', format: 'number', align: 'right', width: 10 },
  { key: 'total_adjust', label: 'Revenue', format: 'currency', align: 'right', width: 18 },
  { key: 'avg_adjust', label: 'Avg Add-on', format: 'currency', align: 'right', width: 16 },
  { key: 'attach_rate_pct', label: 'Attach Rate %', format: 'percent', align: 'right', width: 14 },
];

export const modifierRevenue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getModifierAddonRevenue(req.reportQuery!, req.companyId!);
    await respond(req, res, next, {
      rows, total, summary,
      reportKey: 'sales.modifier_revenue',
      reportTitle: 'Modifier / Add-on Revenue',
      columns: MODIFIER_COLS,
    });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 17. Hourly & Weekday Trend Comparison (Batch B)
// ---------------------------------------------------------------------------
const TREND_COLS: ExportColumn[] = [
  { key: 'dimension', label: 'Dimension', width: 12 },
  { key: 'label', label: 'Bucket', width: 10 },
  { key: 'current_orders', label: 'Orders', format: 'number', align: 'right', width: 10 },
  { key: 'previous_orders', label: 'Prev Orders', format: 'number', align: 'right', width: 12 },
  { key: 'orders_delta_pct', label: 'Orders Δ %', format: 'percent', align: 'right', width: 12 },
  { key: 'current_revenue', label: 'Revenue', format: 'currency', align: 'right', width: 18 },
  { key: 'previous_revenue', label: 'Prev Revenue', format: 'currency', align: 'right', width: 18 },
  { key: 'revenue_delta_pct', label: 'Revenue Δ %', format: 'percent', align: 'right', width: 14 },
];

export const trendComparison = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getHourlyWeekdayTrendComparison(req.reportQuery!, req.companyId!);
    await respond(req, res, next, {
      rows, total, summary,
      reportKey: 'sales.trend_comparison',
      reportTitle: 'Hourly & Weekday Trend Comparison',
      columns: TREND_COLS,
    });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 18. Top / Bottom Movers (Batch B)
// ---------------------------------------------------------------------------
const MOVERS_COLS: ExportColumn[] = [
  { key: 'product_name', label: 'Product', width: 24 },
  { key: 'sku', label: 'SKU', width: 16 },
  { key: 'current_qty', label: 'Qty', format: 'number', align: 'right', width: 10 },
  { key: 'previous_qty', label: 'Prev Qty', format: 'number', align: 'right', width: 10 },
  { key: 'qty_delta_pct', label: 'Qty Δ %', format: 'percent', align: 'right', width: 12 },
  { key: 'current_revenue', label: 'Revenue', format: 'currency', align: 'right', width: 18 },
  { key: 'previous_revenue', label: 'Prev Revenue', format: 'currency', align: 'right', width: 18 },
  { key: 'revenue_delta', label: 'Δ Revenue', format: 'currency', align: 'right', width: 16 },
  { key: 'revenue_delta_pct', label: 'Δ %', format: 'percent', align: 'right', width: 12 },
  { key: 'direction', label: 'Trend', width: 8 },
];

export const topBottomMovers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getTopBottomMovers(req.reportQuery!, req.companyId!);
    await respond(req, res, next, {
      rows, total, summary,
      reportKey: 'sales.movers',
      reportTitle: 'Top / Bottom Movers',
      columns: MOVERS_COLS,
    });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 19. Outlet Comparison Leaderboard (Batch B — admin-gated in UI)
// ---------------------------------------------------------------------------
const OUTLET_LEADERBOARD_COLS: ExportColumn[] = [
  { key: 'rank', label: 'Rank', format: 'number', align: 'right', width: 8 },
  { key: 'outlet_name', label: 'Outlet', width: 24 },
  { key: 'current_revenue', label: 'Revenue', format: 'currency', align: 'right', width: 18 },
  { key: 'previous_revenue', label: 'Prev Revenue', format: 'currency', align: 'right', width: 18 },
  { key: 'revenue_delta_pct', label: 'Revenue Δ %', format: 'percent', align: 'right', width: 14 },
  { key: 'current_orders', label: 'Orders', format: 'number', align: 'right', width: 10 },
  { key: 'orders_delta_pct', label: 'Orders Δ %', format: 'percent', align: 'right', width: 14 },
  { key: 'avg_ticket', label: 'Avg Ticket', format: 'currency', align: 'right', width: 14 },
  { key: 'items_per_order', label: 'Items/Order', format: 'number', align: 'right', width: 12 },
];

export const outletLeaderboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getOutletLeaderboard(req.reportQuery!, req.companyId!);
    await respond(req, res, next, {
      rows, total, summary,
      reportKey: 'sales.outlet_leaderboard',
      reportTitle: 'Outlet Comparison Leaderboard',
      columns: OUTLET_LEADERBOARD_COLS,
    });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 8. Dashboard KPIs
// ---------------------------------------------------------------------------
export const salesDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.reportQuery ?? {
      from_date: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
      to_date: new Date().toISOString().split('T')[0],
      branch_ids: [],
      page: 1, page_size: 50,
      sort_dir: 'desc' as const,
      export: 'none' as const,
      currency: 'AED',
    };
    const kpis = await svc.getSalesDashboardKpis(q, req.companyId!);
    res.json({ success: true, data: kpis });
  } catch (err) { next(err); }
};
