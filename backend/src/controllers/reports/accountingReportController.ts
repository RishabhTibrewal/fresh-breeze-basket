import { Request, Response, NextFunction } from 'express';
import { buildReportResponse } from '../../middleware/reportValidator';
import ExportService, { ExportColumn } from '../../services/ExportService';
import * as svc from '../../services/reports/accountingReportService';

async function respond<T>(
  req: Request, res: Response, next: NextFunction,
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
        title: reportTitle, filters: q, columns,
        rows: rows as Record<string, unknown>[], currency: q.currency,
      });
      return;
    }
    res.json(buildReportResponse({
      reportKey, reportTitle, filters: q, data: rows, total,
      page: q.page, pageSize: q.page_size, summary,
    }));
  } catch (err) { next(err); }
}

// ---------------------------------------------------------------------------
// 1. Revenue vs Expense Summary
// ---------------------------------------------------------------------------
const REV_EXP_COLS: ExportColumn[] = [
  { key: 'period',           label: 'Period',        width: 14 },
  { key: 'revenue',          label: 'Revenue',       format: 'currency', align: 'right', width: 18 },
  { key: 'purchase_cost',    label: 'Purchase Cost', format: 'currency', align: 'right', width: 18 },
  { key: 'gross_profit',     label: 'Gross Profit',  format: 'currency', align: 'right', width: 18 },
  { key: 'gross_margin_pct', label: 'Margin %',      format: 'percent',  align: 'right', width: 14 },
];

export const revenueExpenseSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getRevenueExpenseSummary(req.reportQuery!, req.companyId!);
    await respond(req, res, next, { rows, total, summary, reportKey: 'accounting.rev_exp', reportTitle: 'Revenue vs Expense Summary', columns: REV_EXP_COLS });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 2. Payment Collections
// ---------------------------------------------------------------------------
const PAYMENT_COLS: ExportColumn[] = [
  { key: 'payment_date',   label: 'Date',           format: 'date',     width: 14 },
  { key: 'order_id',       label: 'Order',                               width: 14 },
  { key: 'payment_method', label: 'Method',                              width: 16 },
  { key: 'transaction_id', label: 'Txn ID',                              width: 20 },
  { key: 'cheque_no',      label: 'Cheque No',                           width: 16 },
  { key: 'amount',         label: 'Amount',         format: 'currency', align: 'right', width: 16 },
  { key: 'status',         label: 'Status',                              width: 14 },
];

export const paymentCollections = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getPaymentCollections(req.reportQuery!, req.companyId!);
    await respond(req, res, next, { rows, total, summary, reportKey: 'accounting.payments', reportTitle: 'Payment Collections', columns: PAYMENT_COLS });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 3. Tax Collection Report
// ---------------------------------------------------------------------------
const TAX_COLS: ExportColumn[] = [
  { key: 'period',        label: 'Period',         width: 14 },
  { key: 'order_count',   label: 'Orders',         format: 'number',   align: 'right', width: 12 },
  { key: 'taxable_value', label: 'Taxable Value',  format: 'currency', align: 'right', width: 18 },
  { key: 'tax_collected', label: 'Tax Collected',  format: 'currency', align: 'right', width: 18 },
];

export const taxCollectionReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getTaxCollectionReport(req.reportQuery!, req.companyId!);
    await respond(req, res, next, { rows, total, summary, reportKey: 'accounting.tax', reportTitle: 'Tax Collection Report', columns: TAX_COLS });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 4. Cash Flow Summary
// ---------------------------------------------------------------------------
const CASH_FLOW_COLS: ExportColumn[] = [
  { key: 'period',        label: 'Period',         width: 14 },
  { key: 'inflows',       label: 'Inflows',        format: 'currency', align: 'right', width: 18 },
  { key: 'outflows',      label: 'Outflows',       format: 'currency', align: 'right', width: 18 },
  { key: 'net_cash_flow', label: 'Net Cash Flow',  format: 'currency', align: 'right', width: 18 },
];

export const cashFlowSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getCashFlowSummary(req.reportQuery!, req.companyId!);
    await respond(req, res, next, { rows, total, summary, reportKey: 'accounting.cash_flow', reportTitle: 'Cash Flow Summary', columns: CASH_FLOW_COLS });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 5. Dashboard KPIs
// ---------------------------------------------------------------------------
export const accountingDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.reportQuery ?? {
      from_date: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
      to_date: new Date().toISOString().split('T')[0],
      branch_ids: [], page: 1, page_size: 50,
      sort_dir: 'desc' as const, export: 'none' as const, currency: 'AED',
    };
    const kpis = await svc.getAccountingDashboardKpis(q, req.companyId!);
    res.json({ success: true, data: kpis });
  } catch (err) { next(err); }
};
