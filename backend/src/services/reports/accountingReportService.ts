/**
 * accountingReportService.ts
 * Accounting / Financial reports built from existing tables:
 *  - public.orders            — sales revenue
 *  - public.payments          — customer payment collections
 *  - public.order_items       — tax amounts
 *  - procurement.purchase_invoices  — purchase costs
 *  - procurement.supplier_payments  — supplier outflows
 */

import { supabaseAdmin, supabase } from '../../config/supabase';
import type { ReportQuery } from '../../middleware/reportValidator';

const db = () => supabaseAdmin ?? supabase;

// ---------------------------------------------------------------------------
// 1. Revenue vs Expense Summary (P&L lite)
// ---------------------------------------------------------------------------
export interface RevenueExpenseRow {
  [key: string]: unknown;
  period: string;
  revenue: number;
  purchase_cost: number;
  gross_profit: number;
  gross_margin_pct: number;
}

export async function getRevenueExpenseSummary(q: ReportQuery, companyId: string) {
  const client = db();

  // Revenue from confirmed/delivered sales orders
  const { data: orders, error: ordErr } = await client
    .from('orders')
    .select('created_at, total_amount, order_type')
    .eq('company_id', companyId)
    .in('status', ['confirmed', 'delivered', 'completed'])
    .not('order_type', 'eq', 'purchase')   // exclude purchase orders
    .gte('created_at', q.from_date)
    .lte('created_at', q.to_date + 'T23:59:59Z');
  if (ordErr) throw ordErr;

  // Purchase costs from invoices in procurement schema
  const { data: invoices, error: invErr } = await client
    .schema('procurement')
    .from('purchase_invoices')
    .select('invoice_date, total_amount')
    .eq('company_id', companyId)
    .gte('invoice_date', q.from_date)
    .lte('invoice_date', q.to_date);
  if (invErr) throw invErr;

  // Group by week/month
  const buckets = new Map<string, { revenue: number; cost: number }>();
  const bucket = (dateStr: string) => dateStr.substring(0, 7); // YYYY-MM

  for (const ord of orders ?? []) {
    const key = bucket(ord.created_at.split('T')[0]);
    const b = buckets.get(key) ?? { revenue: 0, cost: 0 };
    b.revenue += Number(ord.total_amount ?? 0);
    buckets.set(key, b);
  }
  for (const inv of invoices ?? []) {
    const key = bucket(inv.invoice_date);
    const b = buckets.get(key) ?? { revenue: 0, cost: 0 };
    b.cost += Number(inv.total_amount ?? 0);
    buckets.set(key, b);
  }

  const rows: RevenueExpenseRow[] = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, { revenue, cost }]) => ({
      period,
      revenue,
      purchase_cost: cost,
      gross_profit: revenue - cost,
      gross_margin_pct: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0,
    }));

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalCost    = rows.reduce((s, r) => s + r.purchase_cost, 0);

  return {
    rows,
    total: rows.length,
    summary: {
      total_revenue:    totalRevenue,
      total_cost:       totalCost,
      gross_profit:     totalRevenue - totalCost,
      gross_margin_pct: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0,
    } as Record<string, string | number>,
  };
}

// ---------------------------------------------------------------------------
// 2. Payment Collections Report (customer receipts)
// ---------------------------------------------------------------------------
export interface PaymentCollectionRow {
  [key: string]: unknown;
  payment_id: string;
  payment_date: string;
  order_id: string;
  payment_method: string;
  amount: number;
  status: string;
  transaction_id: string;
  cheque_no: string;
}

export async function getPaymentCollections(q: ReportQuery, companyId: string) {
  const client = db();

  let query = client
    .from('payments')
    .select(`id, payment_date, order_id, payment_method, amount, status, transaction_id, cheque_no, created_at`, { count: 'exact' })
    .eq('company_id', companyId);

  // payments table uses payment_date (date) or created_at
  if (q.from_date) {
    query = query.or(`payment_date.gte.${q.from_date},and(payment_date.is.null,created_at.gte.${q.from_date})`);
  }
  if (q.to_date) {
    query = query.or(`payment_date.lte.${q.to_date},and(payment_date.is.null,created_at.lte.${q.to_date + 'T23:59:59Z'})`);
  }

  query = query.order('created_at', { ascending: q.sort_dir === 'asc' });
  query = query.range((q.page - 1) * q.page_size, q.page * q.page_size - 1);

  const { data: payments, count, error } = await query;
  if (error) throw error;

  let rows: PaymentCollectionRow[] = (payments ?? []).map((p: any) => ({
    payment_id:     p.id,
    payment_date:   p.payment_date ?? p.created_at?.split('T')[0] ?? '',
    order_id:       p.order_id ?? '—',
    payment_method: p.payment_method ?? '—',
    amount:         Number(p.amount ?? 0),
    status:         p.status ?? '—',
    transaction_id: p.transaction_id ?? '—',
    cheque_no:      p.cheque_no ?? '—',
  }));

  if (q.search) {
    const s = q.search.toLowerCase();
    rows = rows.filter(r =>
      String(r.transaction_id).toLowerCase().includes(s) ||
      String(r.payment_method).toLowerCase().includes(s)
    );
  }

  const totalCollected  = rows.filter(r => r.status === 'completed' || r.status === 'paid').reduce((s, r) => s + r.amount, 0);
  const totalPending    = rows.filter(r => r.status === 'pending').reduce((s, r) => s + r.amount, 0);

  return {
    rows,
    total: count ?? 0,
    summary: {
      total_payments:   count ?? 0,
      total_collected:  totalCollected,
      total_pending:    totalPending,
      total_amount:     rows.reduce((s, r) => s + r.amount, 0),
    } as Record<string, string | number>,
  };
}

// ---------------------------------------------------------------------------
// 3. Tax Collection Report (GST/VAT from order items)
// ---------------------------------------------------------------------------
export interface TaxCollectionRow {
  [key: string]: unknown;
  period: string;
  order_count: number;
  taxable_value: number;
  tax_collected: number;
}

export async function getTaxCollectionReport(q: ReportQuery, companyId: string) {
  const client = db();

  const { data: items, error } = await client
    .from('order_items')
    .select(`
      tax_amount, unit_price, quantity, created_at,
      orders:order_id(status, order_type, created_at)
    `)
    .eq('company_id', companyId)
    .gte('created_at', q.from_date)
    .lte('created_at', q.to_date + 'T23:59:59Z');
  if (error) throw error;

  const buckets = new Map<string, { orders: Set<string>; taxable: number; tax: number }>();

  for (const item of items ?? []) {
    const ord: any = item.orders;
    if (!ord) continue;
    if (ord.order_type === 'purchase') continue;
    if (!['confirmed', 'delivered', 'completed'].includes(ord.status)) continue;

    const period = (ord.created_at ?? item.created_at).split('T')[0].substring(0, 7);
    const b = buckets.get(period) ?? { orders: new Set(), taxable: 0, tax: 0 };
    b.taxable += Number(item.unit_price ?? 0) * Number(item.quantity ?? 0);
    b.tax     += Number(item.tax_amount ?? 0);
    buckets.set(period, b);
  }

  const rows: TaxCollectionRow[] = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, b]) => ({
      period,
      order_count:   b.orders.size,
      taxable_value: b.taxable,
      tax_collected: b.tax,
    }));

  const page = q.page; const size = q.page_size;
  const paginated = rows.slice((page - 1) * size, page * size);

  return {
    rows: paginated,
    total: rows.length,
    summary: {
      total_taxable_value: rows.reduce((s, r) => s + r.taxable_value, 0),
      total_tax_collected: rows.reduce((s, r) => s + r.tax_collected, 0),
    } as Record<string, string | number>,
  };
}

// ---------------------------------------------------------------------------
// 4. Cash Flow Summary (inflows vs outflows by month)
// ---------------------------------------------------------------------------
export interface CashFlowRow {
  [key: string]: unknown;
  period: string;
  inflows: number;
  outflows: number;
  net_cash_flow: number;
}

export async function getCashFlowSummary(q: ReportQuery, companyId: string) {
  const client = db();

  const [paymentsRes, supplierPaymentsRes] = await Promise.all([
    client.from('payments').select('amount, payment_date, created_at, status').eq('company_id', companyId)
      .gte('created_at', q.from_date)
      .lte('created_at', q.to_date + 'T23:59:59Z'),
    client.schema('procurement').from('supplier_payments').select('amount, payment_date, status').eq('company_id', companyId)
      .gte('payment_date', q.from_date)
      .lte('payment_date', q.to_date),
  ]);

  if (paymentsRes.error) throw paymentsRes.error;
  if (supplierPaymentsRes.error) throw supplierPaymentsRes.error;

  const buckets = new Map<string, { in: number; out: number }>();
  const key = (d: string) => d.substring(0, 7);

  for (const p of paymentsRes.data ?? []) {
    if (!['completed', 'paid'].includes(p.status)) continue;
    const k = key(p.payment_date ?? p.created_at?.split('T')[0]);
    const b = buckets.get(k) ?? { in: 0, out: 0 };
    b.in += Number(p.amount ?? 0);
    buckets.set(k, b);
  }
  for (const p of supplierPaymentsRes.data ?? []) {
    if (p.status === 'cancelled') continue;
    const k = key(p.payment_date);
    const b = buckets.get(k) ?? { in: 0, out: 0 };
    b.out += Number(p.amount ?? 0);
    buckets.set(k, b);
  }

  const rows: CashFlowRow[] = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, b]) => ({
      period,
      inflows:       b.in,
      outflows:      b.out,
      net_cash_flow: b.in - b.out,
    }));

  return {
    rows,
    total: rows.length,
    summary: {
      total_inflows:  rows.reduce((s, r) => s + r.inflows, 0),
      total_outflows: rows.reduce((s, r) => s + r.outflows, 0),
      net_cash_flow:  rows.reduce((s, r) => s + r.net_cash_flow, 0),
    } as Record<string, string | number>,
  };
}

// ---------------------------------------------------------------------------
// 5. Accounting Dashboard KPIs
// ---------------------------------------------------------------------------
export interface AccountingDashboardKpis {
  total_revenue: number;
  total_purchase_cost: number;
  gross_profit: number;
  total_collected: number;
  total_tax_collected: number;
  net_cash_flow: number;
}

export async function getAccountingDashboardKpis(q: ReportQuery, companyId: string): Promise<AccountingDashboardKpis> {
  const client = db();

  const [ordRes, invRes, payRes, itemRes, supPayRes] = await Promise.all([
    client.from('orders').select('total_amount').eq('company_id', companyId).in('status', ['confirmed','delivered','completed']).not('order_type','eq','purchase').gte('created_at', q.from_date).lte('created_at', q.to_date + 'T23:59:59Z'),
    client.schema('procurement').from('purchase_invoices').select('total_amount').eq('company_id', companyId).gte('invoice_date', q.from_date).lte('invoice_date', q.to_date),
    client.from('payments').select('amount, status').eq('company_id', companyId).gte('created_at', q.from_date).lte('created_at', q.to_date + 'T23:59:59Z'),
    client.from('order_items').select('tax_amount').eq('company_id', companyId).gte('created_at', q.from_date).lte('created_at', q.to_date + 'T23:59:59Z'),
    client.schema('procurement').from('supplier_payments').select('amount, status').eq('company_id', companyId).gte('payment_date', q.from_date).lte('payment_date', q.to_date),
  ]);

  const revenue      = (ordRes.data ?? []).reduce((s: number, r: any) => s + Number(r.total_amount ?? 0), 0);
  const cost         = (invRes.data ?? []).reduce((s: number, r: any) => s + Number(r.total_amount ?? 0), 0);
  const collected    = (payRes.data ?? []).filter((p: any) => ['completed','paid'].includes(p.status)).reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
  const taxCollected = (itemRes.data ?? []).reduce((s: number, r: any) => s + Number(r.tax_amount ?? 0), 0);
  const outflows     = (supPayRes.data ?? []).filter((p: any) => p.status !== 'cancelled').reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);

  return {
    total_revenue:       revenue,
    total_purchase_cost: cost,
    gross_profit:        revenue - cost,
    total_collected:     collected,
    total_tax_collected: taxCollected,
    net_cash_flow:       collected - outflows,
  };
}
