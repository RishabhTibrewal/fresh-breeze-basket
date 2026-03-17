import { Request, Response, NextFunction } from 'express';
import { buildReportResponse } from '../../middleware/reportValidator';
import ExportService, { ExportColumn } from '../../services/ExportService';
import * as svc from '../../services/reports/procurementReportService';

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
// 1. Invoice Register
// ---------------------------------------------------------------------------
const INVOICE_COLS: ExportColumn[] = [
  { key: 'invoice_date',   label: 'Date',        format: 'date',     width: 14 },
  { key: 'invoice_number', label: 'Invoice #',                        width: 18 },
  { key: 'grn_number',     label: 'GRN #',                            width: 18 },
  { key: 'supplier_name',  label: 'Supplier',                         width: 24 },
  { key: 'subtotal',       label: 'Subtotal',    format: 'currency',  align: 'right', width: 16 },
  { key: 'tax_amount',     label: 'Tax',         format: 'currency',  align: 'right', width: 14 },
  { key: 'total_amount',   label: 'Total',       format: 'currency',  align: 'right', width: 16 },
  { key: 'paid_amount',    label: 'Paid',        format: 'currency',  align: 'right', width: 16 },
  { key: 'outstanding',    label: 'Outstanding', format: 'currency',  align: 'right', width: 16 },
  { key: 'status',         label: 'Status',                           width: 14 },
];

export const invoiceRegister = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getInvoiceRegister(req.reportQuery!, req.companyId!);
    await respond(req, res, next, { rows, total, summary, reportKey: 'procurement.invoice_register', reportTitle: 'Purchase Invoice Register', columns: INVOICE_COLS });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 2. GRN Report
// ---------------------------------------------------------------------------
const GRN_COLS: ExportColumn[] = [
  { key: 'receipt_date',           label: 'Date',        format: 'date',     width: 14 },
  { key: 'grn_number',             label: 'GRN #',                            width: 18 },
  { key: 'warehouse',              label: 'Branch',                           width: 18 },
  { key: 'items_count',            label: '# Items',     format: 'number',   align: 'right', width: 10 },
  { key: 'total_received_amount',  label: 'Value',       format: 'currency', align: 'right', width: 16 },
  { key: 'status',                 label: 'Status',                           width: 14 },
];

export const grnReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getGrnReport(req.reportQuery!, req.companyId!);
    await respond(req, res, next, { rows, total, summary, reportKey: 'procurement.grn_report', reportTitle: 'GRN Report', columns: GRN_COLS });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 3. Vendor-wise Purchase
// ---------------------------------------------------------------------------
const VENDOR_COLS: ExportColumn[] = [
  { key: 'supplier_name',  label: 'Supplier',                         width: 24 },
  { key: 'email',          label: 'Email',                            width: 24 },
  { key: 'total_invoices', label: 'Invoices',  format: 'number',     align: 'right', width: 12 },
  { key: 'total_amount',   label: 'Total',     format: 'currency',   align: 'right', width: 16 },
  { key: 'total_paid',     label: 'Paid',      format: 'currency',   align: 'right', width: 16 },
  { key: 'outstanding',    label: 'Outstanding',format: 'currency',  align: 'right', width: 16 },
];

export const vendorWisePurchase = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getVendorWisePurchase(req.reportQuery!, req.companyId!);
    await respond(req, res, next, { rows, total, summary, reportKey: 'procurement.vendor_wise', reportTitle: 'Vendor-wise Purchase Report', columns: VENDOR_COLS });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 4. Supplier Payment Register
// ---------------------------------------------------------------------------
const PAYMENT_COLS: ExportColumn[] = [
  { key: 'payment_date',   label: 'Date',          format: 'date',     width: 14 },
  { key: 'payment_number', label: 'Payment #',                          width: 18 },
  { key: 'supplier_name',  label: 'Supplier',                           width: 24 },
  { key: 'invoice_number', label: 'Invoice #',                          width: 18 },
  { key: 'payment_method', label: 'Method',                             width: 14 },
  { key: 'amount',         label: 'Amount',        format: 'currency', align: 'right', width: 16 },
  { key: 'status',         label: 'Status',                             width: 14 },
];

export const supplierPaymentRegister = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getSupplierPaymentRegister(req.reportQuery!, req.companyId!);
    await respond(req, res, next, { rows, total, summary, reportKey: 'procurement.payment_register', reportTitle: 'Supplier Payment Register', columns: PAYMENT_COLS });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 5. Dashboard KPIs
// ---------------------------------------------------------------------------
export const procurementDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.reportQuery ?? {
      from_date: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
      to_date: new Date().toISOString().split('T')[0],
      branch_ids: [], page: 1, page_size: 50,
      sort_dir: 'desc' as const, export: 'none' as const, currency: 'AED',
    };
    const kpis = await svc.getProcurementDashboardKpis(q, req.companyId!);
    res.json({ success: true, data: kpis });
  } catch (err) { next(err); }
};
