import { Request, Response, NextFunction } from 'express';
import { buildReportResponse } from '../../middleware/reportValidator';
import ExportService, { ExportColumn } from '../../services/ExportService';
import * as svc from '../../services/reports/inventoryReportService';

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
// 1. Stock Ledger
// ---------------------------------------------------------------------------
const STOCK_LEDGER_COLS: ExportColumn[] = [
  { key: 'movement_date',  label: 'Date',           format: 'date',   width: 14 },
  { key: 'product_name',   label: 'Product',                           width: 24 },
  { key: 'variant_name',   label: 'Variant',                           width: 16 },
  { key: 'sku',            label: 'SKU',                               width: 16 },
  { key: 'warehouse',      label: 'Branch',                            width: 18 },
  { key: 'movement_type',  label: 'Type',                              width: 14 },
  { key: 'reference_type', label: 'Reference',                         width: 14 },
  { key: 'quantity',       label: 'Qty',             format: 'number', align: 'right', width: 12 },
];

export const stockLedger = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getStockLedger(req.reportQuery!, req.companyId!);
    await respond(req, res, next, { rows, total, summary, reportKey: 'inventory.stock_ledger', reportTitle: 'Stock Ledger', columns: STOCK_LEDGER_COLS });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 2. Current Stock Position
// ---------------------------------------------------------------------------
const CURRENT_STOCK_COLS: ExportColumn[] = [
  { key: 'product_name',    label: 'Product',                           width: 24 },
  { key: 'variant_name',    label: 'Variant',                           width: 16 },
  { key: 'sku',             label: 'SKU',                               width: 16 },
  { key: 'warehouse',       label: 'Branch',                            width: 18 },
  { key: 'stock_count',     label: 'On Hand',  format: 'number', align: 'right', width: 12 },
  { key: 'reserved_stock',  label: 'Reserved', format: 'number', align: 'right', width: 12 },
  { key: 'available_stock', label: 'Available',format: 'number', align: 'right', width: 12 },
];

export const currentStock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getCurrentStock(req.reportQuery!, req.companyId!);
    await respond(req, res, next, { rows, total, summary, reportKey: 'inventory.current_stock', reportTitle: 'Current Stock Position', columns: CURRENT_STOCK_COLS });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 3. Repack Summary
// ---------------------------------------------------------------------------
const REPACK_COLS: ExportColumn[] = [
  { key: 'order_date',    label: 'Date',         format: 'date',     width: 14 },
  { key: 'warehouse',     label: 'Branch',                           width: 18 },
  { key: 'status',        label: 'Status',                           width: 14 },
  { key: 'input_product', label: 'Input Product',                    width: 24 },
  { key: 'input_qty',     label: 'Input Qty',    format: 'number',   align: 'right', width: 12 },
  { key: 'output_product',label: 'Output',                           width: 24 },
  { key: 'output_qty',    label: 'Output Qty',   format: 'number',   align: 'right', width: 12 },
  { key: 'wastage_qty',   label: 'Wastage',      format: 'number',   align: 'right', width: 12 },
  { key: 'wastage_pct',   label: 'Wastage %',    format: 'percent',  align: 'right', width: 12 },
  { key: 'total_cost',    label: 'Total Cost',   format: 'currency', align: 'right', width: 16 },
];

export const repackSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getRepackSummary(req.reportQuery!, req.companyId!);
    await respond(req, res, next, { rows, total, summary, reportKey: 'inventory.repack_summary', reportTitle: 'Repack / Job Work Summary', columns: REPACK_COLS });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 4. Wastage Report
// ---------------------------------------------------------------------------
const WASTAGE_COLS: ExportColumn[] = [
  { key: 'order_date',    label: 'Date',         format: 'date',     width: 14 },
  { key: 'warehouse',     label: 'Branch',                           width: 18 },
  { key: 'input_product', label: 'Product',                          width: 24 },
  { key: 'input_qty',     label: 'Input Qty',    format: 'number',   align: 'right', width: 12 },
  { key: 'wastage_qty',   label: 'Wastage Qty',  format: 'number',   align: 'right', width: 12 },
  { key: 'wastage_pct',   label: 'Wastage %',    format: 'percent',  align: 'right', width: 12 },
  { key: 'wastage_cost',  label: 'Wastage Cost', format: 'currency', align: 'right', width: 16 },
];

export const wastageReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, total, summary } = await svc.getWastageReport(req.reportQuery!, req.companyId!);
    await respond(req, res, next, { rows, total, summary, reportKey: 'inventory.wastage', reportTitle: 'Wastage Report', columns: WASTAGE_COLS });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// 5. Inventory Dashboard KPIs
// ---------------------------------------------------------------------------
export const inventoryDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.reportQuery ?? {
      from_date: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
      to_date: new Date().toISOString().split('T')[0],
      branch_ids: [], page: 1, page_size: 50,
      sort_dir: 'desc' as const, export: 'none' as const, currency: 'AED',
    };
    const kpis = await svc.getInventoryDashboardKpis(q, req.companyId!);
    res.json({ success: true, data: kpis });
  } catch (err) { next(err); }
};
