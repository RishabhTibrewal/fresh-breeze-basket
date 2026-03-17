/**
 * ExportService — server-side PDF (pdfkit) and Excel (exceljs) generation.
 *
 * Usage:
 *   const buf = await ExportService.toPdf({ title, filters, columns, rows });
 *   ExportService.sendExport(res, 'pdf', ...);
 */

import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { Response } from 'express';
import type { ReportQuery } from '../middleware/reportValidator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface ExportColumn {
  key: string;
  label: string;
  width?: number;          // Excel column width (chars)
  align?: 'left' | 'right' | 'center';
  format?: 'currency' | 'number' | 'date' | 'text' | 'percent';
}

export interface ExportOptions {
  title: string;
  subtitle?: string;
  filters?: Partial<ReportQuery>;
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
  summaryRow?: Record<string, unknown>;
  currency?: string;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
function fmtValue(val: unknown, col: ExportColumn, currency = 'AED'): string {
  if (val === null || val === undefined) return '';
  const n = Number(val);
  switch (col.format) {
    case 'currency': return isNaN(n) ? String(val) : `${currency} ${n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'number':   return isNaN(n) ? String(val) : n.toLocaleString('en-AE');
    case 'percent':  return isNaN(n) ? String(val) : `${n.toFixed(2)}%`;
    case 'date':     return val instanceof Date ? val.toLocaleDateString('en-AE') : String(val).split('T')[0];
    default:         return String(val);
  }
}

function formatFilters(filters?: Partial<ReportQuery>): string {
  if (!filters) return '';
  const parts: string[] = [];
  if (filters.from_date) parts.push(`From: ${filters.from_date}`);
  if (filters.to_date)   parts.push(`To: ${filters.to_date}`);
  if (filters.branch_ids?.length) parts.push(`Branch(es): ${filters.branch_ids.join(', ')}`);
  return parts.join('   |   ');
}

// ---------------------------------------------------------------------------
// PDF generation using pdfkit
// ---------------------------------------------------------------------------
export async function toPdfBuffer(opts: ExportOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const currency = opts.currency ?? 'AED';
    const pageWidth = doc.page.width - 80; // margins
    const colCount = opts.columns.length;
    const colWidth = pageWidth / colCount;

    // ── Header ──
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(opts.title, 40, 40);

    if (opts.subtitle) {
      doc.fontSize(10).font('Helvetica').text(opts.subtitle, 40, doc.y + 4);
    }

    const filterStr = formatFilters(opts.filters);
    if (filterStr) {
      doc.fontSize(9).fillColor('#555').text(filterStr, 40, doc.y + 4).fillColor('black');
    }

    doc.fontSize(8).text(`Generated: ${new Date().toLocaleString('en-AE')}`, 40, doc.y + 4);

    doc.moveDown(0.5);

    // ── Table header row ──
    const headerY = doc.y;
    doc
      .rect(40, headerY, pageWidth, 18)
      .fill('#1e293b');

    doc.fillColor('white').fontSize(8).font('Helvetica-Bold');
    opts.columns.forEach((col, i) => {
      doc.text(col.label, 40 + i * colWidth + 4, headerY + 5, {
        width: colWidth - 8,
        align: col.align ?? 'left',
      });
    });
    doc.fillColor('black').font('Helvetica');

    // ── Data rows ──
    let rowY = headerY + 20;
    opts.rows.forEach((row, rowIdx) => {
      // New page if needed
      if (rowY > doc.page.height - 80) {
        doc.addPage();
        rowY = 40;
      }

      // Alternating row bg
      if (rowIdx % 2 === 0) {
        doc.rect(40, rowY, pageWidth, 16).fill('#f8fafc').fillColor('black');
      }

      doc.fontSize(7.5);
      opts.columns.forEach((col, i) => {
        const val = row[col.key];
        doc.text(fmtValue(val, col, currency), 40 + i * colWidth + 4, rowY + 4, {
          width: colWidth - 8,
          align: col.align ?? 'left',
        });
      });

      rowY += 16;
    });

    // ── Summary row ──
    if (opts.summaryRow) {
      if (rowY > doc.page.height - 60) {
        doc.addPage();
        rowY = 40;
      }
      doc.rect(40, rowY, pageWidth, 18).fill('#0f172a');
      doc.fillColor('white').font('Helvetica-Bold').fontSize(8);
      opts.columns.forEach((col, i) => {
        const val = opts.summaryRow![col.key];
        doc.text(fmtValue(val, col, currency), 40 + i * colWidth + 4, rowY + 5, {
          width: colWidth - 8,
          align: col.align ?? 'left',
        });
      });
    }

    doc.end();
  });
}

// ---------------------------------------------------------------------------
// Excel generation using exceljs
// ---------------------------------------------------------------------------
export async function toExcelBuffer(opts: ExportOptions): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Fresh Breeze ERP';
  wb.created = new Date();

  const ws = wb.addWorksheet(opts.title.substring(0, 31));

  // ── Title row ──
  ws.getRow(1).getCell(1).value = opts.title;
  ws.getRow(1).getCell(1).font = { bold: true, size: 14 };
  ws.mergeCells(1, 1, 1, opts.columns.length);

  // ── Filter row ──
  const filterStr = formatFilters(opts.filters);
  ws.getRow(2).getCell(1).value = filterStr || '';
  ws.getRow(2).getCell(1).font = { italic: true, size: 9, color: { argb: 'FF555555' } };
  ws.mergeCells(2, 1, 2, opts.columns.length);

  ws.getRow(3).getCell(1).value = `Generated: ${new Date().toLocaleString('en-AE')}`;
  ws.getRow(3).getCell(1).font = { size: 8, color: { argb: 'FF555555' } };
  ws.mergeCells(3, 1, 3, opts.columns.length);

  const HEADER_ROW = 5;

  // ── Column definitions ──
  ws.columns = opts.columns.map((col) => ({
    key: col.key,
    width: col.width ?? 18,
    header: '',
  }));

  // ── Header row ──
  const hdr = ws.getRow(HEADER_ROW);
  opts.columns.forEach((col, i) => {
    const cell = hdr.getCell(i + 1);
    cell.value = col.label;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { horizontal: col.align ?? 'left', vertical: 'middle' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF64748B' } },
    };
  });
  hdr.height = 22;

  // ── Data rows ──
  const currency = opts.currency ?? 'AED';
  opts.rows.forEach((row, rowIdx) => {
    const wsRow = ws.addRow(opts.columns.map((col) => row[col.key] ?? ''));
    wsRow.height = 18;

    opts.columns.forEach((col, i) => {
      const cell = wsRow.getCell(i + 1);
      cell.alignment = { horizontal: col.align ?? 'left', vertical: 'middle' };

      // Alternate row background
      if (rowIdx % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }

      // Apply number formats
      if (col.format === 'currency') {
        cell.numFmt = `"${currency} "#,##0.00`;
      } else if (col.format === 'number') {
        cell.numFmt = '#,##0';
      } else if (col.format === 'percent') {
        cell.numFmt = '0.00%';
      } else if (col.format === 'date') {
        cell.numFmt = 'dd-mmm-yyyy';
      }
    });
  });

  // ── Summary row ──
  if (opts.summaryRow) {
    const sumRow = ws.addRow(opts.columns.map((col) => opts.summaryRow![col.key] ?? ''));
    opts.columns.forEach((col, i) => {
      const cell = sumRow.getCell(i + 1);
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      cell.alignment = { horizontal: col.align ?? 'left', vertical: 'middle' };
      if (col.format === 'currency') cell.numFmt = `"${currency} "#,##0.00`;
    });
    sumRow.height = 20;
  }

  // Auto-filter on header row
  ws.autoFilter = {
    from: { row: HEADER_ROW, column: 1 },
    to: { row: HEADER_ROW, column: opts.columns.length },
  };
  ws.views = [{ state: 'frozen', ySplit: HEADER_ROW }];

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

// ---------------------------------------------------------------------------
// HTTP response helpers
// ---------------------------------------------------------------------------
export async function sendExport(
  res: Response,
  format: 'pdf' | 'excel',
  opts: ExportOptions
): Promise<void> {
  const safeTitle = opts.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const dateSuffix = new Date().toISOString().split('T')[0];

  if (format === 'pdf') {
    const buf = await toPdfBuffer(opts);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}_${dateSuffix}.pdf"`);
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  } else {
    const buf = await toExcelBuffer(opts);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}_${dateSuffix}.xlsx"`);
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  }
}

const ExportService = { toPdfBuffer, toExcelBuffer, sendExport };
export default ExportService;
