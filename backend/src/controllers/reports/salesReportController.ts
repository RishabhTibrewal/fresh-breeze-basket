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
  { key: 'total_amount', label: 'Return Value', format: 'currency', align: 'right', width: 16 },
  { key: 'payment_status', label: 'Refund Status', width: 16 },
];

export const salesReturns = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getSalesReturns(req.reportQuery!, req.companyId!);
    await respond(req, res, next, { rows, total, summary, reportKey: 'sales.returns', reportTitle: 'Sales Returns', columns: RETURNS_COLS });
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
