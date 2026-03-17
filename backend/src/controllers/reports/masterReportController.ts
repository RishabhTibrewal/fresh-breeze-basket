import { Request, Response, NextFunction } from 'express';
import { buildReportResponse } from '../../middleware/reportValidator';
import ExportService, { ExportColumn } from '../../services/ExportService';
import * as svc from '../../services/reports/masterReportService';

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
// 1. Product Master
// ---------------------------------------------------------------------------
const PRODUCT_COLS: ExportColumn[] = [
  { key: 'product_code', label: 'Code',       width: 14 },
  { key: 'name',         label: 'Product',    width: 28 },
  { key: 'unit_type',    label: 'Unit',       width: 12 },
  { key: 'price',        label: 'Price',      format: 'currency', align: 'right', width: 14 },
  { key: 'sale_price',   label: 'Sale Price', format: 'currency', align: 'right', width: 14 },
  { key: 'tax_pct',      label: 'Tax %',      format: 'percent',  align: 'right', width: 10 },
  { key: 'is_active',    label: 'Status',     width: 10 },
  { key: 'created_at',   label: 'Added',      format: 'date',     width: 14 },
];

export const productMaster = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getProductMaster(req.reportQuery!, req.companyId!);
    await respond(req, res, next, { rows, total, summary, reportKey: 'master.products', reportTitle: 'Product Master List', columns: PRODUCT_COLS });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 2. Customer Master
// ---------------------------------------------------------------------------
const CUSTOMER_COLS: ExportColumn[] = [
  { key: 'name',               label: 'Customer',       width: 24 },
  { key: 'email',              label: 'Email',           width: 24 },
  { key: 'phone',              label: 'Phone',           width: 16 },
  { key: 'trn_number',         label: 'TRN',             width: 18 },
  { key: 'credit_limit',       label: 'Credit Limit',   format: 'currency', align: 'right', width: 16 },
  { key: 'current_credit',     label: 'Outstanding',    format: 'currency', align: 'right', width: 16 },
  { key: 'credit_period_days', label: 'Credit Days',    format: 'number',   align: 'right', width: 12 },
  { key: 'created_at',         label: 'Since',          format: 'date',     width: 14 },
];

export const customerMaster = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getCustomerMaster(req.reportQuery!, req.companyId!);
    await respond(req, res, next, { rows, total, summary, reportKey: 'master.customers', reportTitle: 'Customer Master List', columns: CUSTOMER_COLS });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 3. Supplier Master
// ---------------------------------------------------------------------------
const SUPPLIER_COLS: ExportColumn[] = [
  { key: 'supplier_code',   label: 'Code',            width: 14 },
  { key: 'name',            label: 'Supplier',        width: 24 },
  { key: 'email',           label: 'Email',           width: 24 },
  { key: 'phone',           label: 'Phone',           width: 16 },
  { key: 'city',            label: 'City',            width: 14 },
  { key: 'country',         label: 'Country',         width: 14 },
  { key: 'gst_no',          label: 'GST No',          width: 18 },
  { key: 'closing_balance', label: 'Balance',         format: 'currency', align: 'right', width: 16 },
  { key: 'is_active',       label: 'Status',          width: 10 },
];

export const supplierMaster = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getSupplierMaster(req.reportQuery!, req.companyId!);
    await respond(req, res, next, { rows, total, summary, reportKey: 'master.suppliers', reportTitle: 'Supplier Master List', columns: SUPPLIER_COLS });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 4. User Master
// ---------------------------------------------------------------------------
const USER_COLS: ExportColumn[] = [
  { key: 'full_name',    label: 'Name',        width: 20 },
  { key: 'email',        label: 'Email',       width: 28 },
  { key: 'phone',        label: 'Phone',       width: 16 },
  { key: 'role_display', label: 'Role',        width: 18 },
  { key: 'created_at',   label: 'Joined',      format: 'date', width: 14 },
];

export const userMaster = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getUserMaster(req.reportQuery!, req.companyId!);
    await respond(req, res, next, { rows, total, summary, reportKey: 'master.users', reportTitle: 'User Master List', columns: USER_COLS });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 5. Activity / Audit Summary
// ---------------------------------------------------------------------------
const ACTIVITY_COLS: ExportColumn[] = [
  { key: 'changed_at',  label: 'Date',         format: 'date', width: 14 },
  { key: 'order_id',    label: 'Order',         width: 20 },
  { key: 'from_status', label: 'From Status',   width: 16 },
  { key: 'to_status',   label: 'To Status',     width: 16 },
  { key: 'changed_by',  label: 'Changed By',    width: 20 },
];

export const activitySummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getActivitySummary(req.reportQuery!, req.companyId!);
    await respond(req, res, next, { rows, total, summary, reportKey: 'master.activity', reportTitle: 'Activity Audit Log', columns: ACTIVITY_COLS });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 6. Dashboard KPIs
// ---------------------------------------------------------------------------
export const masterDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const kpis = await svc.getMasterDashboardKpis(req.companyId!);
    res.json({ success: true, data: kpis });
  } catch (err) { next(err); }
};
