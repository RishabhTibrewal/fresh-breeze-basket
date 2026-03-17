/**
 * procurementReportService.ts
 * Supabase query implementations for Procurement Report endpoints.
 *
 * IMPORTANT: All procurement tables live in the `procurement` schema.
 * Use .schema('procurement') for: purchase_orders, purchase_order_items,
 * goods_receipts, goods_receipt_items, purchase_invoices, purchase_invoice_items,
 * supplier_payments.
 * Suppliers table is in the PUBLIC schema.
 */

import { supabaseAdmin, supabase } from '../../config/supabase';
import type { ReportQuery } from '../../middleware/reportValidator';

const db = () => supabaseAdmin ?? supabase;

// ---------------------------------------------------------------------------
// 1. Purchase Invoice Register (primary procurement summary report)
// ---------------------------------------------------------------------------
export interface InvoiceRegisterRow {
  [key: string]: unknown;
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  grn_number: string;
  supplier_name: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  outstanding: number;
  status: string;
}

export async function getInvoiceRegister(q: ReportQuery, companyId: string) {
  const client = db();

  let query = client
    .schema('procurement')
    .from('purchase_invoices')
    .select(`
      id, invoice_number, invoice_date, due_date,
      subtotal, tax_amount, total_amount, paid_amount, status,
      goods_receipt_id, purchase_order_id
    `, { count: 'exact' })
    .eq('company_id', companyId)
    .gte('invoice_date', q.from_date)
    .lte('invoice_date', q.to_date);

  query = query.order('invoice_date', { ascending: q.sort_dir === 'asc' });
  query = query.range((q.page - 1) * q.page_size, q.page * q.page_size - 1);

  const { data: invoices, count, error } = await query;
  if (error) throw error;

  // Fetch related goods receipts and purchase orders (for grn_number and supplier)
  const grnIds = (invoices ?? []).map((i: any) => i.goods_receipt_id).filter(Boolean);
  const poIds  = (invoices ?? []).map((i: any) => i.purchase_order_id).filter(Boolean);

  const grnMap  = new Map<string, any>();
  const poMap   = new Map<string, any>();
  const supMap  = new Map<string, any>();

  if (grnIds.length) {
    const { data: grns } = await client.schema('procurement').from('goods_receipts').select('id, grn_number').in('id', grnIds).eq('company_id', companyId);
    grns?.forEach((g: any) => grnMap.set(g.id, g));
  }
  if (poIds.length) {
    const { data: pos } = await client.schema('procurement').from('purchase_orders').select('id, supplier_id').in('id', poIds).eq('company_id', companyId);
    pos?.forEach((p: any) => poMap.set(p.id, p));
    const supIds = [...new Set(pos?.map((p: any) => p.supplier_id).filter(Boolean) ?? [])];
    if (supIds.length) {
      const { data: sups } = await client.from('suppliers').select('id, name').in('id', supIds).eq('company_id', companyId);
      sups?.forEach((s: any) => supMap.set(s.id, s));
    }
  }

  let rows: InvoiceRegisterRow[] = (invoices ?? []).map((inv: any) => {
    const grn = inv.goods_receipt_id ? grnMap.get(inv.goods_receipt_id) : null;
    const po  = inv.purchase_order_id ? poMap.get(inv.purchase_order_id) : null;
    const sup = po?.supplier_id ? supMap.get(po.supplier_id) : null;
    return {
      invoice_id:     inv.id,
      invoice_number: inv.invoice_number,
      invoice_date:   inv.invoice_date,
      due_date:       inv.due_date ?? '—',
      grn_number:     grn?.grn_number ?? '—',
      supplier_name:  sup?.name ?? '—',
      subtotal:       Number(inv.subtotal ?? 0),
      tax_amount:     Number(inv.tax_amount ?? 0),
      total_amount:   Number(inv.total_amount ?? 0),
      paid_amount:    Number(inv.paid_amount ?? 0),
      outstanding:    Number(inv.total_amount ?? 0) - Number(inv.paid_amount ?? 0),
      status:         inv.status,
    };
  });

  if (q.search) {
    const s = q.search.toLowerCase();
    rows = rows.filter(r =>
      String(r.invoice_number).toLowerCase().includes(s) ||
      String(r.supplier_name).toLowerCase().includes(s)
    );
  }

  return {
    rows,
    total: count ?? 0,
    summary: {
      total_invoices:    count ?? 0,
      total_amount:      rows.reduce((s, r) => s + r.total_amount, 0),
      total_paid:        rows.reduce((s, r) => s + r.paid_amount, 0),
      total_outstanding: rows.reduce((s, r) => s + r.outstanding, 0),
    } as Record<string, string | number>,
  };
}

// ---------------------------------------------------------------------------
// 2. GRN Report (Goods Receipt Note summary)
// ---------------------------------------------------------------------------
export interface GrnReportRow {
  [key: string]: unknown;
  grn_id: string;
  grn_number: string;
  receipt_date: string;
  warehouse: string;
  total_received_amount: number;
  status: string;
  items_count: number;
}

export async function getGrnReport(q: ReportQuery, companyId: string) {
  const client = db();

  let grnQuery = client
    .schema('procurement')
    .from('goods_receipts')
    .select(`
      id, grn_number, receipt_date, warehouse_id,
      total_received_amount, status, created_at
    `, { count: 'exact' })
    .eq('company_id', companyId)
    .gte('receipt_date', q.from_date)
    .lte('receipt_date', q.to_date);

  if (q.branch_ids?.length) {
    grnQuery = grnQuery.in('warehouse_id', q.branch_ids as string[]);
  }

  grnQuery = grnQuery.order('receipt_date', { ascending: q.sort_dir === 'asc' });
  grnQuery = grnQuery.range((q.page - 1) * q.page_size, q.page * q.page_size - 1);

  const { data: grns, count, error } = await grnQuery;
  if (error) throw error;

  // Fetch item counts per GRN
  const grnIds = (grns ?? []).map((g: any) => g.id);
  const itemCountMap = new Map<string, number>();
  if (grnIds.length) {
    const { data: items } = await client.schema('procurement').from('goods_receipt_items').select('goods_receipt_id').in('goods_receipt_id', grnIds).eq('company_id', companyId);
    items?.forEach((i: any) => itemCountMap.set(i.goods_receipt_id, (itemCountMap.get(i.goods_receipt_id) ?? 0) + 1));
  }

  // Fetch warehouses
  const wIds = [...new Set((grns ?? []).map((g: any) => g.warehouse_id).filter(Boolean))];
  const wMap = new Map<string, string>();
  if (wIds.length) {
    const { data: ws } = await client.from('warehouses').select('id, name').in('id', wIds).eq('company_id', companyId);
    ws?.forEach((w: any) => wMap.set(w.id, w.name));
  }

  const rows: GrnReportRow[] = (grns ?? []).map((g: any) => ({
    grn_id:                g.id,
    grn_number:            g.grn_number,
    receipt_date:          g.receipt_date ?? g.created_at?.split('T')[0] ?? '',
    warehouse:             g.warehouse_id ? (wMap.get(g.warehouse_id) ?? '—') : '—',
    total_received_amount: Number(g.total_received_amount ?? 0),
    status:                g.status,
    items_count:           itemCountMap.get(g.id) ?? 0,
  }));

  return {
    rows,
    total: count ?? 0,
    summary: {
      total_grns:    count ?? 0,
      total_value:   rows.reduce((s, r) => s + r.total_received_amount, 0),
      completed_grns: rows.filter(r => r.status === 'completed').length,
    } as Record<string, string | number>,
  };
}

// ---------------------------------------------------------------------------
// 3. Vendor-wise Purchase Report
// ---------------------------------------------------------------------------
export interface VendorPurchaseRow {
  [key: string]: unknown;
  supplier_id: string;
  supplier_name: string;
  email: string;
  total_invoices: number;
  total_amount: number;
  total_paid: number;
  outstanding: number;
}

export async function getVendorWisePurchase(q: ReportQuery, companyId: string) {
  const client = db();

  // Get all invoices in period
  const { data: invoices, error } = await client
    .schema('procurement')
    .from('purchase_invoices')
    .select('id, total_amount, paid_amount, purchase_order_id')
    .eq('company_id', companyId)
    .gte('invoice_date', q.from_date)
    .lte('invoice_date', q.to_date);

  if (error) throw error;

  const poIds = [...new Set((invoices ?? []).map((i: any) => i.purchase_order_id).filter(Boolean))];
  const poMap = new Map<string, any>();
  if (poIds.length) {
    const { data: pos } = await client.schema('procurement').from('purchase_orders').select('id, supplier_id').in('id', poIds).eq('company_id', companyId);
    pos?.forEach((p: any) => poMap.set(p.id, p));
  }

  // Group by supplier
  const supplierMap = new Map<string, VendorPurchaseRow>();
  for (const inv of invoices ?? []) {
    const po = inv.purchase_order_id ? poMap.get(inv.purchase_order_id) : null;
    const supId = po?.supplier_id ?? 'unknown';
    if (!supplierMap.has(supId)) {
      supplierMap.set(supId, { supplier_id: supId, supplier_name: '—', email: '—', total_invoices: 0, total_amount: 0, total_paid: 0, outstanding: 0 });
    }
    const row = supplierMap.get(supId)!;
    row.total_invoices++;
    row.total_amount += Number(inv.total_amount ?? 0);
    row.total_paid   += Number(inv.paid_amount ?? 0);
    row.outstanding  = row.total_amount - row.total_paid;
  }

  // Enrich supplier names
  const supIds = [...supplierMap.keys()].filter(id => id !== 'unknown');
  if (supIds.length) {
    const { data: sups } = await client.from('suppliers').select('id, name, email').in('id', supIds).eq('company_id', companyId);
    sups?.forEach((s: any) => {
      const row = supplierMap.get(s.id);
      if (row) { row.supplier_name = s.name; row.email = s.email ?? '—'; }
    });
  }

  let rows = [...supplierMap.values()];
  if (q.search) {
    const s = q.search.toLowerCase();
    rows = rows.filter(r => String(r.supplier_name).toLowerCase().includes(s));
  }

  const page = q.page; const size = q.page_size;
  const paginated = rows.slice((page - 1) * size, page * size);

  return {
    rows: paginated,
    total: rows.length,
    summary: {
      total_suppliers: rows.length,
      total_purchases: rows.reduce((s, r) => s + r.total_amount, 0),
      total_outstanding: rows.reduce((s, r) => s + r.outstanding, 0),
    } as Record<string, string | number>,
  };
}

// ---------------------------------------------------------------------------
// 4. Supplier Payment Register
// ---------------------------------------------------------------------------
export interface SupplierPaymentRow {
  [key: string]: unknown;
  payment_id: string;
  payment_number: string;
  payment_date: string;
  supplier_name: string;
  invoice_number: string;
  payment_method: string;
  amount: number;
  status: string;
}

export async function getSupplierPaymentRegister(q: ReportQuery, companyId: string) {
  const client = db();

  let query = client
    .schema('procurement')
    .from('supplier_payments')
    .select(`id, payment_number, payment_date, payment_method, amount, status, supplier_id, purchase_invoice_id`, { count: 'exact' })
    .eq('company_id', companyId)
    .gte('payment_date', q.from_date)
    .lte('payment_date', q.to_date);

  query = query.order('payment_date', { ascending: q.sort_dir === 'asc' });
  query = query.range((q.page - 1) * q.page_size, q.page * q.page_size - 1);

  const { data: payments, count, error } = await query;
  if (error) throw error;

  const supIds = [...new Set((payments ?? []).map((p: any) => p.supplier_id).filter(Boolean))];
  const invIds = [...new Set((payments ?? []).map((p: any) => p.purchase_invoice_id).filter(Boolean))];

  const supMap = new Map<string, any>();
  const invMap = new Map<string, any>();

  if (supIds.length) {
    const { data: sups } = await client.from('suppliers').select('id, name').in('id', supIds).eq('company_id', companyId);
    sups?.forEach((s: any) => supMap.set(s.id, s));
  }
  if (invIds.length) {
    const { data: invs } = await client.schema('procurement').from('purchase_invoices').select('id, invoice_number').in('id', invIds).eq('company_id', companyId);
    invs?.forEach((i: any) => invMap.set(i.id, i));
  }

  const rows: SupplierPaymentRow[] = (payments ?? []).map((p: any) => ({
    payment_id:      p.id,
    payment_number:  p.payment_number,
    payment_date:    p.payment_date,
    supplier_name:   p.supplier_id ? (supMap.get(p.supplier_id)?.name ?? '—') : '—',
    invoice_number:  p.purchase_invoice_id ? (invMap.get(p.purchase_invoice_id)?.invoice_number ?? '—') : '—',
    payment_method:  p.payment_method,
    amount:          Number(p.amount ?? 0),
    status:          p.status,
  }));

  return {
    rows,
    total: count ?? 0,
    summary: {
      total_payments:  count ?? 0,
      total_amount:    rows.reduce((s, r) => s + r.amount, 0),
      completed_payments: rows.filter(r => r.status === 'completed').length,
    } as Record<string, string | number>,
  };
}

// ---------------------------------------------------------------------------
// 5. Procurement Dashboard KPIs
// ---------------------------------------------------------------------------
export interface ProcurementDashboardKpis {
  total_invoices: number;
  total_purchase_value: number;
  total_paid: number;
  total_outstanding: number;
  total_grns: number;
  total_payments: number;
}

export async function getProcurementDashboardKpis(q: ReportQuery, companyId: string): Promise<ProcurementDashboardKpis> {
  const client = db();

  const [invRes, grnRes, payRes] = await Promise.all([
    client.schema('procurement').from('purchase_invoices').select('total_amount, paid_amount').eq('company_id', companyId).gte('invoice_date', q.from_date).lte('invoice_date', q.to_date),
    client.schema('procurement').from('goods_receipts').select('id').eq('company_id', companyId).gte('receipt_date', q.from_date).lte('receipt_date', q.to_date),
    client.schema('procurement').from('supplier_payments').select('amount').eq('company_id', companyId).gte('payment_date', q.from_date).lte('payment_date', q.to_date),
  ]);

  const invoices = invRes.data ?? [];
  const totalInvoiceValue = invoices.reduce((s: number, i: any) => s + Number(i.total_amount ?? 0), 0);
  const totalPaid         = invoices.reduce((s: number, i: any) => s + Number(i.paid_amount ?? 0), 0);

  return {
    total_invoices:        invoices.length,
    total_purchase_value:  totalInvoiceValue,
    total_paid:            totalPaid,
    total_outstanding:     totalInvoiceValue - totalPaid,
    total_grns:            grnRes.data?.length ?? 0,
    total_payments:        payRes.data?.length ?? 0,
  };
}
