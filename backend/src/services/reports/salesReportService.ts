/**
 * salesReportService.ts
 * Real Supabase query implementations for all Sales Report endpoints.
 */

import { supabaseAdmin, supabase } from '../../config/supabase';
import type { ReportQuery } from '../../middleware/reportValidator';

const db = () => supabaseAdmin ?? supabase;

const toServiceError = (scope: string, err: any) =>
  new Error(`${scope} failed: ${err?.message || 'Unknown error'}${err?.code ? ` (${err.code})` : ''}`);

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
function isoToDate(iso: string) {
  return iso; // Already YYYY-MM-DD — passed directly to Supabase gte/lte
}

// ---------------------------------------------------------------------------
// 1. Sales Order Summary
// ---------------------------------------------------------------------------
export interface SalesOrderSummaryRow {
  order_id: string;
  order_date: string;
  customer_name: string;
  warehouse: string;
  order_source: string;
  status: string;
  payment_status: string;
  payment_method: string;
  total_amount: number;
  tax_amount: number;
  net_amount: number;
}

export interface SalesOrderSummarySummary {
  [key: string]: string | number;
  total_orders: number;
  total_revenue: number;
  total_tax: number;
  avg_order_value: number;
}

export async function getSalesOrderSummary(q: ReportQuery, companyId: string) {
  let query = db()
    .from('orders')
    .select(`
      id,
      created_at,
      status,
      payment_status,
      payment_method,
      total_amount,
      order_source,
      outlet_id,
      user_id,
      customer_id,
      warehouses:outlet_id(name),
      customers:customer_id(id, name, email),
      order_items(tax_amount)
    `, { count: 'exact' })
    .eq('company_id', companyId)
    .eq('order_type', 'sales')
    .neq('status', 'cancelled')
    .gte('created_at', q.from_date)
    .lte('created_at', q.to_date + 'T23:59:59Z');

  if (q.order_source) {
    query = query.eq('order_source', q.order_source);
  }
  if (q.pos_session_id) {
    query = query.eq('pos_session_id', q.pos_session_id);
  }

  if (q.branch_ids?.length) {
    query = query.in('outlet_id', q.branch_ids);
  }
  if (q.search) {
    // search by order id prefix
    query = query.ilike('id::text', `%${q.search}%`);
  }

  const sortColumn = q.sort_by === 'total_amount' ? 'total_amount' : 'created_at';
  query = query.order(sortColumn, { ascending: q.sort_dir === 'asc' });

  const from = (q.page - 1) * q.page_size;
  query = query.range(from, from + q.page_size - 1);

  const { data, count, error } = await query;
  if (error) {
    console.error('Main query error:', error);
    throw new Error(`Main query failed: ${error.message} (${error.code})`);
  }

  const rows: SalesOrderSummaryRow[] = (data ?? []).map((o: any) => {
    const taxSum = (o.order_items ?? []).reduce((s: number, i: any) => s + Number(i.tax_amount || 0), 0);
    const customer = o.customers;
    const customerName = customer
      ? customer.name || customer.email
      : 'N/A';
    return {
      order_id: o.id,
      order_date: o.created_at?.split('T')[0] ?? '',
      customer_name: customerName,
      warehouse: o.warehouses?.name ?? '—',
      order_source: o.order_source ?? '—',
      status: o.status,
      payment_status: o.payment_status ?? '—',
      payment_method: o.payment_method ?? '—',
      total_amount: Number(o.total_amount),
      tax_amount: taxSum,
      net_amount: Number(o.total_amount) - taxSum,
    };
  });

  // Summary (re-query without pagination for aggregates)
  let aggQuery = db()
    .from('orders')
    .select('id, total_amount, order_items(tax_amount)')
    .eq('company_id', companyId)
    .eq('order_type', 'sales')
    .neq('status', 'cancelled')
    .gte('created_at', q.from_date)
    .lte('created_at', q.to_date + 'T23:59:59Z');

  if (q.order_source) {
    aggQuery = aggQuery.eq('order_source', q.order_source);
  }
  if (q.pos_session_id) {
    aggQuery = aggQuery.eq('pos_session_id', q.pos_session_id);
  }

  const { data: aggData, error: aggError } = await aggQuery;
  if (aggError) {
    console.error('Aggregate query error:', aggError);
    throw new Error(`Aggregate query failed: ${aggError.message} (${aggError.code})`);
  }

  const totalRevenue = (aggData ?? []).reduce((s: number, o: any) => s + Number(o.total_amount), 0);
  const totalTax = (aggData ?? []).reduce((s: number, o: any) =>
    s + (o.order_items ?? []).reduce((t: number, i: any) => t + Number(i.tax_amount || 0), 0), 0
  );
  const total = aggData?.length ?? 0;

  const summary: SalesOrderSummarySummary = {
    total_orders: total,
    total_revenue: totalRevenue,
    total_tax: totalTax,
    avg_order_value: total > 0 ? totalRevenue / total : 0,
  };

  return { rows, total: count ?? 0, summary };
}

// ---------------------------------------------------------------------------
// 2. Salesperson Performance
// ---------------------------------------------------------------------------
export interface SalespersonPerformanceRow {
  executive_id: string;
  executive_name: string;
  executive_email: string;
  total_orders: number;
  total_revenue: number;
  avg_order_value: number;
  unique_customers: number;
  target_amount: number;
  achievement_pct: number;
}

export async function getSalespersonPerformance(q: ReportQuery, companyId: string) {
  // Get all sales orders with exec info
  const { data: orders, error } = await db()
    .from('orders')
    .select('sales_executive_id, total_amount, user_id')
    .eq('company_id', companyId)
    .eq('order_type', 'sales')
    .neq('status', 'cancelled')
    .not('sales_executive_id', 'is', null)
    .gte('created_at', q.from_date)
    .lte('created_at', q.to_date + 'T23:59:59Z');

  if (error) throw toServiceError('Salesperson performance query', error);

  // Get exec profiles
  const execIds = [...new Set((orders ?? []).map((o: any) => o.sales_executive_id as string))];

  const { data: profiles } = execIds.length
    ? await db()
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', execIds)
    : { data: [] };

  const profileMap = new Map(
    (profiles ?? []).map((p: any) => [p.id, p])
  );

  // Targets in date range
  const { data: targets } = await db()
    .from('sales_targets')
    .select('sales_executive_id, target_amount')
    .eq('company_id', companyId)
    .lte('period_start', q.to_date)
    .gte('period_end', q.from_date);

  const targetMap = new Map<string, number>();
  (targets ?? []).forEach((t: any) => {
    const existing = targetMap.get(t.sales_executive_id) ?? 0;
    targetMap.set(t.sales_executive_id, existing + Number(t.target_amount));
  });

  // Aggregate
  const buckets = new Map<string, { revenue: number; orders: number; customers: Set<string> }>();
  (orders ?? []).forEach((o: any) => {
    const id = o.sales_executive_id;
    if (!buckets.has(id)) buckets.set(id, { revenue: 0, orders: 0, customers: new Set() });
    const b = buckets.get(id)!;
    b.revenue += Number(o.total_amount);
    b.orders += 1;
    if (o.user_id) b.customers.add(o.user_id);
  });

  const rows: SalespersonPerformanceRow[] = Array.from(buckets.entries()).map(([id, b]) => {
    const profile = profileMap.get(id) as any;
    const target = targetMap.get(id) ?? 0;
    return {
      executive_id: id,
      executive_name: profile
        ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
        : id.substring(0, 8),
      executive_email: profile?.email ?? '',
      total_orders: b.orders,
      total_revenue: b.revenue,
      avg_order_value: b.orders > 0 ? b.revenue / b.orders : 0,
      unique_customers: b.customers.size,
      target_amount: target,
      achievement_pct: target > 0 ? (b.revenue / target) * 100 : 0,
    };
  });

  rows.sort((a, b) => b.total_revenue - a.total_revenue);

  const summary = {
    total_executives: rows.length,
    total_revenue: rows.reduce((s, r) => s + r.total_revenue, 0),
    avg_achievement_pct: rows.length > 0
      ? rows.reduce((s, r) => s + r.achievement_pct, 0) / rows.length
      : 0,
  };

  const paginated = rows.slice((q.page - 1) * q.page_size, q.page * q.page_size);
  return { rows: paginated, total: rows.length, summary };
}

// ---------------------------------------------------------------------------
// 3. Customer-wise Sales
// ---------------------------------------------------------------------------
export interface CustomerWiseSalesRow {
  customer_id: string;
  customer_name: string;
  email: string;
  phone: string;
  total_orders: number;
  total_revenue: number;
  avg_order_value: number;
  last_order_date: string;
}

export async function getCustomerWiseSales(q: ReportQuery, companyId: string) {
  const { data: orders, error } = await db()
    .from('orders')
    .select('customer_id, total_amount, created_at, customers:customer_id(id, name, email, phone)')
    .eq('company_id', companyId)
    .eq('order_type', 'sales')
    .neq('status', 'cancelled')
    .gte('created_at', q.from_date)
    .lte('created_at', q.to_date + 'T23:59:59Z');

  if (error) throw toServiceError('Customer-wise sales query', error);

  const buckets = new Map<string, { customer: any; revenue: number; orders: number; lastDate: string }>();
  (orders ?? []).forEach((o: any) => {
    const customerId = o.customer_id ?? 'unknown';
    if (!buckets.has(customerId)) {
      buckets.set(customerId, { customer: o.customers, revenue: 0, orders: 0, lastDate: '' });
    }
    const b = buckets.get(customerId)!;
    b.revenue += Number(o.total_amount);
    b.orders += 1;
    const d = o.created_at?.split('T')[0] ?? '';
    if (!b.lastDate || d > b.lastDate) b.lastDate = d;
    if (!b.customer && o.customers) b.customer = o.customers;
  });

  let rows: CustomerWiseSalesRow[] = Array.from(buckets.entries()).map(([customerId, b]) => ({
    customer_id: customerId,
    customer_name: b.customer
      ? b.customer.name || b.customer.email
      : customerId.substring(0, 8),
    email: b.customer?.email ?? '',
    phone: b.customer?.phone ?? '',
    total_orders: b.orders,
    total_revenue: b.revenue,
    avg_order_value: b.orders > 0 ? b.revenue / b.orders : 0,
    last_order_date: b.lastDate,
  }));

  if (q.search) {
    const s = q.search.toLowerCase();
    rows = rows.filter(r => r.customer_name.toLowerCase().includes(s) || r.email.toLowerCase().includes(s));
  }

  rows.sort((a, b) => b.total_revenue - a.total_revenue);

  const summary = {
    total_customers: rows.length,
    total_revenue: rows.reduce((s, r) => s + r.total_revenue, 0),
    avg_revenue_per_customer: rows.length > 0
      ? rows.reduce((s, r) => s + r.total_revenue, 0) / rows.length
      : 0,
  };

  const paginated = rows.slice((q.page - 1) * q.page_size, q.page * q.page_size);
  return { rows: paginated, total: rows.length, summary };
}

// ---------------------------------------------------------------------------
// 4. Product-wise Sales
// ---------------------------------------------------------------------------
export interface ProductWiseSalesRow {
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

export async function getProductWiseSales(q: ReportQuery, companyId: string) {
  let query = db()
    .from('order_items')
    .select(`
      order_id, product_id, variant_id, quantity, unit_price, tax_amount,
      order:order_id!inner(company_id, order_type, status, created_at, outlet_id, order_source, pos_session_id),
      products:product_id(id, name),
      product_variants:variant_id(id, name, sku)
    `)
    .eq('order.company_id', companyId)
    .eq('order.order_type', 'sales')
    .neq('order.status', 'cancelled')
    .gte('order.created_at', q.from_date)
    .lte('order.created_at', q.to_date + 'T23:59:59Z');

  if (q.order_source) {
    query = query.eq('order.order_source', q.order_source);
  }
  if (q.pos_session_id) {
    query = query.eq('order.pos_session_id', q.pos_session_id);
  }
  if (q.branch_ids?.length) {
    query = query.in('order.outlet_id', q.branch_ids);
  }

  const { data: items, error } = await query;

  if (error) throw toServiceError('Product-wise sales query', error);

  const buckets = new Map<string, {
    product: any; variant: any; qty: number; revenue: number; tax: number; orders: Set<string>;
  }>();

  (items ?? []).forEach((item: any) => {
    const key = `${item.product_id}__${item.variant_id ?? 'null'}`;
    if (!buckets.has(key)) {
      buckets.set(key, { product: item.products, variant: item.product_variants, qty: 0, revenue: 0, tax: 0, orders: new Set() });
    }
    const b = buckets.get(key)!;
    b.qty += Number(item.quantity);
    b.revenue += Number(item.unit_price) * Number(item.quantity);
    b.tax += Number(item.tax_amount ?? 0);
    b.orders.add(item.order_id);
  });

  let rows: ProductWiseSalesRow[] = Array.from(buckets.entries()).map(([_key, b]) => ({
    product_id: b.product?.id ?? '',
    variant_id: b.variant?.id ?? '',
    product_name: b.product?.name ?? '—',
    variant_name: b.variant?.name ?? '—',
    sku: b.variant?.sku ?? '—',
    total_qty: b.qty,
    total_revenue: b.revenue,
    avg_unit_price: b.qty > 0 ? b.revenue / b.qty : 0,
    total_tax: b.tax,
    order_count: b.orders.size,
  }));

  if (q.search) {
    const s = q.search.toLowerCase();
    rows = rows.filter(r => r.product_name.toLowerCase().includes(s) || r.sku.toLowerCase().includes(s));
  }

  rows.sort((a, b) => b.total_revenue - a.total_revenue);

  const summary = {
    total_products: rows.length,
    total_qty_sold: rows.reduce((s, r) => s + r.total_qty, 0),
    total_revenue: rows.reduce((s, r) => s + r.total_revenue, 0),
  };

  const paginated = rows.slice((q.page - 1) * q.page_size, q.page * q.page_size);
  return { rows: paginated, total: rows.length, summary };
}

// ---------------------------------------------------------------------------
// 5. Target vs Achievement
// ---------------------------------------------------------------------------
export interface TargetVsAchievementRow {
  executive_id: string;
  executive_name: string;
  period_type: string;
  period_start: string;
  period_end: string;
  target_amount: number;
  achieved_amount: number;
  variance: number;
  achievement_pct: number;
  status: 'achieved' | 'below_target' | 'no_target';
}

export async function getTargetVsAchievement(q: ReportQuery, companyId: string) {
  const { data: targets, error: te } = await db()
    .from('sales_targets')
    .select('id, sales_executive_id, target_amount, period_type, period_start, period_end')
    .eq('company_id', companyId)
    .lte('period_start', q.to_date)
    .gte('period_end', q.from_date);

  if (te) throw toServiceError('Target query', te);

  const { data: orders, error: oe } = await db()
    .from('orders')
    .select('sales_executive_id, total_amount, created_at')
    .eq('company_id', companyId)
    .eq('order_type', 'sales')
    .neq('status', 'cancelled')
    .not('sales_executive_id', 'is', null)
    .gte('created_at', q.from_date)
    .lte('created_at', q.to_date + 'T23:59:59Z');

  if (oe) throw toServiceError('Target achievement order query', oe);

  // Revenue map per executive
  const revenueMap = new Map<string, number>();
  (orders ?? []).forEach((o: any) => {
    const id = o.sales_executive_id;
    revenueMap.set(id, (revenueMap.get(id) ?? 0) + Number(o.total_amount));
  });

  // Exec profiles
  const execIds = [...new Set((targets ?? []).map((t: any) => t.sales_executive_id as string))];
  const { data: profiles } = execIds.length
    ? await db().from('profiles').select('id, first_name, last_name').in('id', execIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  const rows: TargetVsAchievementRow[] = (targets ?? []).map((t: any) => {
    const profile = profileMap.get(t.sales_executive_id) as any;
    const achieved = revenueMap.get(t.sales_executive_id) ?? 0;
    const target = Number(t.target_amount);
    const pct = target > 0 ? (achieved / target) * 100 : 0;
    return {
      executive_id: t.sales_executive_id,
      executive_name: profile
        ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
        : t.sales_executive_id.substring(0, 8),
      period_type: t.period_type,
      period_start: t.period_start,
      period_end: t.period_end,
      target_amount: target,
      achieved_amount: achieved,
      variance: achieved - target,
      achievement_pct: pct,
      status: pct >= 100 ? 'achieved' : target > 0 ? 'below_target' : 'no_target',
    };
  });

  const summary = {
    total_targets: rows.length,
    total_target_amount: rows.reduce((s, r) => s + r.target_amount, 0),
    total_achieved: rows.reduce((s, r) => s + r.achieved_amount, 0),
    avg_achievement_pct: rows.length > 0
      ? rows.reduce((s, r) => s + r.achievement_pct, 0) / rows.length
      : 0,
    executives_on_target: rows.filter(r => r.status === 'achieved').length,
  };

  const paginated = rows.slice((q.page - 1) * q.page_size, q.page * q.page_size);
  return { rows: paginated, total: rows.length, summary };
}

// ---------------------------------------------------------------------------
// 6. Pending Deliveries
// ---------------------------------------------------------------------------
export interface PendingDeliveryRow {
  order_id: string;
  order_date: string;
  customer_name: string;
  warehouse: string;
  status: string;
  total_amount: number;
  days_pending: number;
}

export async function getPendingDeliveries(q: ReportQuery, companyId: string) {
  const { data, count, error } = await db()
    .from('orders')
    .select(`
      id, created_at, status, total_amount, outlet_id,
      warehouses:outlet_id(name),
      customers:user_id(first_name, last_name, email)
    `, { count: 'exact' })
    .eq('company_id', companyId)
    .eq('order_type', 'sales')
    .in('status', ['pending', 'confirmed', 'processing', 'packed'])
    .gte('created_at', q.from_date)
    .lte('created_at', q.to_date + 'T23:59:59Z')
    .order('created_at', { ascending: true })
    .range((q.page - 1) * q.page_size, q.page * q.page_size - 1);

  if (error) throw toServiceError('Pending deliveries query', error);

  const today = new Date();
  const rows: PendingDeliveryRow[] = (data ?? []).map((o: any) => {
    const created = new Date(o.created_at);
    const daysPending = Math.floor((today.getTime() - created.getTime()) / 86400000);
    const c = o.customers;
    return {
      order_id: o.id,
      order_date: o.created_at?.split('T')[0] ?? '',
      customer_name: c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || c.email : 'N/A',
      warehouse: o.warehouses?.name ?? '—',
      status: o.status,
      total_amount: Number(o.total_amount),
      days_pending: daysPending,
    };
  });

  return {
    rows,
    total: count ?? 0,
    summary: {
      pending_count: count ?? 0,
      total_value: rows.reduce((s, r) => s + r.total_amount, 0),
    },
  };
}

// ---------------------------------------------------------------------------
// 7. Sales Returns
// ---------------------------------------------------------------------------
export interface SalesReturnRow {
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

export async function getSalesReturns(q: ReportQuery, companyId: string) {
  let query = db()
    .from('orders')
    .select(`
      id, created_at, total_amount, payment_status, original_order_id,
      order_source, outlet_id,
      warehouses:outlet_id(name),
      customers:customer_id(id, name, email),
      order_items(id)
    `, { count: 'exact' })
    .eq('company_id', companyId)
    .eq('order_type', 'return')
    .gte('created_at', q.from_date)
    .lte('created_at', q.to_date + 'T23:59:59Z');

  if (q.order_source) {
    query = query.eq('order_source', q.order_source);
  }
  if (q.pos_session_id) {
    query = query.eq('pos_session_id', q.pos_session_id);
  }
  if (q.branch_ids?.length) {
    query = query.in('outlet_id', q.branch_ids);
  }

  query = query
    .order('created_at', { ascending: false })
    .range((q.page - 1) * q.page_size, q.page * q.page_size - 1);

  const { data, count, error } = await query;

  if (error) throw toServiceError('Sales returns query', error);

  // Fetch reasons from credit_notes (if any) for these return orders
  const returnIds = (data ?? []).map((o: any) => o.id);
  const { data: cnRows } = returnIds.length
    ? await db().from('credit_notes').select('order_id, reason').in('order_id', returnIds)
    : { data: [] };
  const reasonMap = new Map<string, string>();
  (cnRows ?? []).forEach((cn: any) => {
    if (cn.order_id && cn.reason) reasonMap.set(cn.order_id, cn.reason);
  });

  const rows: SalesReturnRow[] = (data ?? []).map((o: any) => {
    const c = o.customers;
    return {
      order_id: o.id,
      original_order_id: o.original_order_id ?? '—',
      return_date: o.created_at?.split('T')[0] ?? '',
      customer_name: c ? (c.name || c.email || 'N/A') : 'N/A',
      outlet_name: o.warehouses?.name ?? '—',
      order_source: o.order_source ?? '—',
      items_count: Array.isArray(o.order_items) ? o.order_items.length : 0,
      total_amount: Number(o.total_amount),
      payment_status: o.payment_status ?? '—',
      reason: reasonMap.get(o.id) ?? '—',
    };
  });

  // Summary: breakdown by reason
  const reasonBreakdown = rows.reduce<Record<string, { count: number; value: number }>>((acc, r) => {
    const key = r.reason || '—';
    if (!acc[key]) acc[key] = { count: 0, value: 0 };
    acc[key].count += 1;
    acc[key].value += r.total_amount;
    return acc;
  }, {});

  return {
    rows,
    total: count ?? 0,
    summary: {
      total_returns: count ?? 0,
      total_return_value: rows.reduce((s, r) => s + r.total_amount, 0),
      avg_return_value: rows.length ? rows.reduce((s, r) => s + r.total_amount, 0) / rows.length : 0,
      reasons_json: JSON.stringify(reasonBreakdown),
    },
  };
}

// ---------------------------------------------------------------------------
// 8. Sales Dashboard KPIs  (used by the reports dashboard page)
// ---------------------------------------------------------------------------
export interface SalesDashboardKpis {
  revenue_this_period: number;
  revenue_prev_period: number;
  revenue_growth_pct: number;
  orders_this_period: number;
  orders_prev_period: number;
  orders_growth_pct: number;
  avg_order_value: number;
  returns_value: number;
  top_product: string;
  top_customer: string;
}

export async function getSalesDashboardKpis(q: ReportQuery, companyId: string): Promise<SalesDashboardKpis> {
  const fromDate = new Date(q.from_date);
  const toDate = new Date(q.to_date);
  const diffMs = toDate.getTime() - fromDate.getTime();
  const prevFrom = new Date(fromDate.getTime() - diffMs).toISOString().split('T')[0];
  const prevTo = q.from_date;

  const [currRes, prevRes, returnRes] = await Promise.all([
    db().from('orders').select('total_amount').eq('company_id', companyId).eq('order_type', 'sales').neq('status', 'cancelled').gte('created_at', q.from_date).lte('created_at', q.to_date + 'T23:59:59Z'),
    db().from('orders').select('total_amount').eq('company_id', companyId).eq('order_type', 'sales').neq('status', 'cancelled').gte('created_at', prevFrom).lte('created_at', prevTo + 'T23:59:59Z'),
    db().from('orders').select('total_amount').eq('company_id', companyId).eq('order_type', 'return').gte('created_at', q.from_date).lte('created_at', q.to_date + 'T23:59:59Z'),
  ]);

  const curr = currRes.data ?? [];
  const prev = prevRes.data ?? [];

  const revCurr = curr.reduce((s: number, o: any) => s + Number(o.total_amount), 0);
  const revPrev = prev.reduce((s: number, o: any) => s + Number(o.total_amount), 0);
  const returnVal = (returnRes.data ?? []).reduce((s: number, o: any) => s + Number(o.total_amount), 0);

  const growth = (base: number, curr: number) => base > 0 ? ((curr - base) / base) * 100 : 0;

  return {
    revenue_this_period: revCurr,
    revenue_prev_period: revPrev,
    revenue_growth_pct: growth(revPrev, revCurr),
    orders_this_period: curr.length,
    orders_prev_period: prev.length,
    orders_growth_pct: growth(prev.length, curr.length),
    avg_order_value: curr.length > 0 ? revCurr / curr.length : 0,
    returns_value: returnVal,
    top_product: '—',
    top_customer: '—',
  };
}

// ---------------------------------------------------------------------------
// Shared helper: apply POS-compatible filters to an orders query builder
// ---------------------------------------------------------------------------
function applyOrderScope(query: any, q: ReportQuery, companyId: string, opts?: { prefix?: string }) {
  const p = opts?.prefix ? `${opts.prefix}.` : '';
  let qb = query
    .eq(`${p}company_id`, companyId)
    .eq(`${p}order_type`, 'sales')
    .neq(`${p}status`, 'cancelled')
    .gte(`${p}created_at`, q.from_date)
    .lte(`${p}created_at`, q.to_date + 'T23:59:59Z');

  if (q.order_source) qb = qb.eq(`${p}order_source`, q.order_source);
  if (q.pos_session_id) qb = qb.eq(`${p}pos_session_id`, q.pos_session_id);
  if (q.branch_ids?.length) qb = qb.in(`${p}outlet_id`, q.branch_ids);

  return qb;
}

// ---------------------------------------------------------------------------
// 9. Hourly Sales Heatmap
// ---------------------------------------------------------------------------
export interface HourlyHeatmapRow {
  weekday: number;      // 0 = Sun … 6 = Sat
  weekday_label: string;
  hour: number;         // 0-23
  order_count: number;
  revenue: number;
}

export async function getHourlyHeatmap(q: ReportQuery, companyId: string) {
  const base = db()
    .from('orders')
    .select('created_at, total_amount');

  const { data, error } = await applyOrderScope(base, q, companyId);

  if (error) throw toServiceError('Hourly heatmap query', error);

  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const buckets = new Map<string, { weekday: number; hour: number; count: number; revenue: number }>();

  (data ?? []).forEach((o: any) => {
    if (!o.created_at) return;
    const d = new Date(o.created_at);
    if (Number.isNaN(d.getTime())) return;
    const weekday = d.getDay();
    const hour = d.getHours();
    const key = `${weekday}-${hour}`;
    if (!buckets.has(key)) {
      buckets.set(key, { weekday, hour, count: 0, revenue: 0 });
    }
    const b = buckets.get(key)!;
    b.count += 1;
    b.revenue += Number(o.total_amount || 0);
  });

  const rows: HourlyHeatmapRow[] = Array.from(buckets.values())
    .map((b) => ({
      weekday: b.weekday,
      weekday_label: WEEKDAYS[b.weekday],
      hour: b.hour,
      order_count: b.count,
      revenue: b.revenue,
    }))
    .sort((a, b) => (a.weekday - b.weekday) || (a.hour - b.hour));

  // Peak computations
  let peakRow: HourlyHeatmapRow | null = null;
  rows.forEach((r) => {
    if (!peakRow || r.revenue > peakRow.revenue) peakRow = r;
  });

  // Weekday totals for "peak day"
  const weekdayTotals = new Map<number, { count: number; revenue: number }>();
  rows.forEach((r) => {
    if (!weekdayTotals.has(r.weekday)) weekdayTotals.set(r.weekday, { count: 0, revenue: 0 });
    const w = weekdayTotals.get(r.weekday)!;
    w.count += r.order_count;
    w.revenue += r.revenue;
  });
  let peakWeekday = -1;
  let peakWeekdayRevenue = 0;
  weekdayTotals.forEach((v, k) => {
    if (v.revenue > peakWeekdayRevenue) { peakWeekdayRevenue = v.revenue; peakWeekday = k; }
  });

  const totalOrders = rows.reduce((s, r) => s + r.order_count, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);

  return {
    rows,
    total: rows.length,
    summary: {
      total_orders: totalOrders,
      total_revenue: totalRevenue,
      peak_hour: peakRow ? (peakRow as HourlyHeatmapRow).hour : 0,
      peak_weekday: peakWeekday >= 0 ? WEEKDAYS[peakWeekday] : '—',
      peak_revenue: peakRow ? (peakRow as HourlyHeatmapRow).revenue : 0,
    },
  };
}

// ---------------------------------------------------------------------------
// 10. Payment Method Mix  (split-aware via payments table)
// ---------------------------------------------------------------------------
export interface PaymentMixRow {
  payment_method: string;
  order_count: number;
  amount: number;
  share_pct: number;
}

export async function getPaymentMix(q: ReportQuery, companyId: string) {
  // Pull orders in scope with their payment_method + id + total_amount
  const base = db()
    .from('orders')
    .select('id, payment_method, total_amount');

  const { data: orders, error } = await applyOrderScope(base, q, companyId);
  if (error) throw toServiceError('Payment mix orders query', error);

  const orderList = orders ?? [];
  const totals = new Map<string, { amount: number; orders: Set<string> }>();

  const bump = (method: string, amount: number, orderId: string) => {
    const key = (method || 'other').toLowerCase();
    if (!totals.has(key)) totals.set(key, { amount: 0, orders: new Set() });
    const b = totals.get(key)!;
    b.amount += amount;
    b.orders.add(orderId);
  };

  const splitOrderIds: string[] = [];
  orderList.forEach((o: any) => {
    if ((o.payment_method || '').toLowerCase() === 'split') {
      splitOrderIds.push(o.id);
    } else {
      bump(o.payment_method, Number(o.total_amount || 0), o.id);
    }
  });

  // For split orders, fetch actual tendered rows from payments
  if (splitOrderIds.length) {
    const { data: payments, error: pe } = await db()
      .from('payments')
      .select('order_id, payment_method, amount, status')
      .in('order_id', splitOrderIds);
    if (pe) throw toServiceError('Payment mix payments query', pe);

    (payments ?? []).forEach((p: any) => {
      if (p.status && String(p.status).toLowerCase() === 'failed') return;
      bump(p.payment_method, Number(p.amount || 0), p.order_id);
    });
  }

  const grand = Array.from(totals.values()).reduce((s, b) => s + b.amount, 0);

  const rows: PaymentMixRow[] = Array.from(totals.entries())
    .map(([method, b]) => ({
      payment_method: method,
      order_count: b.orders.size,
      amount: b.amount,
      share_pct: grand > 0 ? (b.amount / grand) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    rows,
    total: rows.length,
    summary: {
      total_amount: grand,
      total_orders: orderList.length,
      split_orders: splitOrderIds.length,
      method_count: rows.length,
    },
  };
}

// ---------------------------------------------------------------------------
// 11. Fulfillment Type Breakdown
// ---------------------------------------------------------------------------
export interface FulfillmentMixRow {
  fulfillment_type: string;
  order_count: number;
  revenue: number;
  avg_order_value: number;
  share_pct: number;
}

export async function getFulfillmentMix(q: ReportQuery, companyId: string) {
  const base = db()
    .from('orders')
    .select('fulfillment_type, total_amount');

  const { data, error } = await applyOrderScope(base, q, companyId);
  if (error) throw toServiceError('Fulfillment mix query', error);

  const buckets = new Map<string, { count: number; revenue: number }>();
  (data ?? []).forEach((o: any) => {
    const key = (o.fulfillment_type || 'unspecified').toLowerCase();
    if (!buckets.has(key)) buckets.set(key, { count: 0, revenue: 0 });
    const b = buckets.get(key)!;
    b.count += 1;
    b.revenue += Number(o.total_amount || 0);
  });

  const totalOrders = Array.from(buckets.values()).reduce((s, b) => s + b.count, 0);
  const totalRevenue = Array.from(buckets.values()).reduce((s, b) => s + b.revenue, 0);

  const rows: FulfillmentMixRow[] = Array.from(buckets.entries())
    .map(([type, b]) => ({
      fulfillment_type: type,
      order_count: b.count,
      revenue: b.revenue,
      avg_order_value: b.count > 0 ? b.revenue / b.count : 0,
      share_pct: totalRevenue > 0 ? (b.revenue / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    rows,
    total: rows.length,
    summary: {
      total_orders: totalOrders,
      total_revenue: totalRevenue,
      fulfillment_types: rows.length,
    },
  };
}

// ---------------------------------------------------------------------------
// 12. Discount Impact
// ---------------------------------------------------------------------------
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

export async function getDiscountImpact(q: ReportQuery, companyId: string) {
  const base = db()
    .from('orders')
    .select(`
      id, outlet_id, subtotal, total_amount, total_discount,
      extra_discount_amount, cd_amount,
      warehouses:outlet_id(name),
      order_items(discount_amount)
    `);

  const { data, error } = await applyOrderScope(base, q, companyId);
  if (error) throw toServiceError('Discount impact query', error);

  const buckets = new Map<string, DiscountImpactRow>();

  (data ?? []).forEach((o: any) => {
    const key = o.outlet_id ?? 'unassigned';
    if (!buckets.has(key)) {
      buckets.set(key, {
        outlet_id: key,
        outlet_name: o.warehouses?.name ?? '—',
        order_count: 0,
        orders_with_discount: 0,
        gross_sales: 0,
        line_discount: 0,
        extra_discount: 0,
        cd_amount: 0,
        total_discount: 0,
        net_sales: 0,
        discount_rate_pct: 0,
      });
    }
    const b = buckets.get(key)!;
    const lineDisc = (o.order_items ?? []).reduce((s: number, li: any) => s + Number(li.discount_amount || 0), 0);
    const extraDisc = Number(o.extra_discount_amount || 0);
    const cdAmt = Number(o.cd_amount || 0);
    const totalDisc = Number(o.total_discount || 0) || (lineDisc + extraDisc + cdAmt);
    const gross = Number(o.subtotal || 0) || (Number(o.total_amount || 0) + totalDisc);

    b.order_count += 1;
    if (totalDisc > 0) b.orders_with_discount += 1;
    b.gross_sales += gross;
    b.line_discount += lineDisc;
    b.extra_discount += extraDisc;
    b.cd_amount += cdAmt;
    b.total_discount += totalDisc;
    b.net_sales += Number(o.total_amount || 0);
  });

  const rows: DiscountImpactRow[] = Array.from(buckets.values()).map((b) => ({
    ...b,
    discount_rate_pct: b.gross_sales > 0 ? (b.total_discount / b.gross_sales) * 100 : 0,
  })).sort((a, b) => b.total_discount - a.total_discount);

  const sumRows = <K extends keyof DiscountImpactRow>(k: K) =>
    rows.reduce((s, r) => s + Number(r[k] || 0), 0);

  const totalGross = sumRows('gross_sales');
  const totalDisc = sumRows('total_discount');

  return {
    rows,
    total: rows.length,
    summary: {
      total_orders: sumRows('order_count'),
      orders_with_discount: sumRows('orders_with_discount'),
      gross_sales: totalGross,
      total_discount: totalDisc,
      net_sales: sumRows('net_sales'),
      discount_rate_pct: totalGross > 0 ? (totalDisc / totalGross) * 100 : 0,
    },
  };
}

// ---------------------------------------------------------------------------
// 13. Cashier / Session Performance
// ---------------------------------------------------------------------------
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

export async function getCashierPerformance(q: ReportQuery, companyId: string) {
  let sessionQuery = db()
    .from('pos_sessions')
    .select(`
      id, company_id, outlet_id, cashier_id, status,
      opened_at, closed_at, opening_cash, closing_cash, expected_cash,
      warehouses:outlet_id(name)
    `)
    .eq('company_id', companyId)
    .gte('opened_at', q.from_date)
    .lte('opened_at', q.to_date + 'T23:59:59Z');

  if (q.branch_ids?.length) sessionQuery = sessionQuery.in('outlet_id', q.branch_ids);
  if (q.pos_session_id) sessionQuery = sessionQuery.eq('id', q.pos_session_id);

  const { data: sessions, error: se } = await sessionQuery.order('opened_at', { ascending: false });
  if (se) throw toServiceError('Cashier sessions query', se);

  const sessionList = sessions ?? [];
  if (sessionList.length === 0) {
    return {
      rows: [] as CashierPerformanceRow[],
      total: 0,
      summary: {
        total_sessions: 0,
        total_orders: 0,
        total_sales: 0,
        total_cash_variance: 0,
        avg_ticket: 0,
      },
    };
  }

  const sessionIds = sessionList.map((s: any) => s.id);
  const cashierIds = [...new Set(sessionList.map((s: any) => s.cashier_id).filter(Boolean))];

  const [ordersRes, profilesRes] = await Promise.all([
    db().from('orders')
      .select('pos_session_id, total_amount')
      .eq('company_id', companyId)
      .eq('order_type', 'sales')
      .neq('status', 'cancelled')
      .in('pos_session_id', sessionIds),
    cashierIds.length
      ? db().from('profiles').select('id, first_name, last_name, email').in('id', cashierIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  if (ordersRes.error) throw toServiceError('Cashier session orders query', ordersRes.error);

  const orderAgg = new Map<string, { count: number; revenue: number }>();
  (ordersRes.data ?? []).forEach((o: any) => {
    const key = o.pos_session_id as string;
    if (!orderAgg.has(key)) orderAgg.set(key, { count: 0, revenue: 0 });
    const b = orderAgg.get(key)!;
    b.count += 1;
    b.revenue += Number(o.total_amount || 0);
  });

  const profileMap = new Map<string, any>();
  (profilesRes.data ?? []).forEach((p: any) => profileMap.set(p.id, p));

  const rows: CashierPerformanceRow[] = sessionList.map((s: any) => {
    const profile = profileMap.get(s.cashier_id);
    const name = profile
      ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || profile.email || 'Cashier'
      : 'Cashier';
    const agg = orderAgg.get(s.id) ?? { count: 0, revenue: 0 };
    const opened = s.opened_at ? new Date(s.opened_at).getTime() : null;
    const closed = s.closed_at ? new Date(s.closed_at).getTime() : null;
    const durationMin = opened && closed ? Math.max(0, Math.round((closed - opened) / 60000)) : 0;
    const closingCash = s.closing_cash != null ? Number(s.closing_cash) : null;
    const expectedCash = s.expected_cash != null ? Number(s.expected_cash) : null;
    const variance = closingCash != null && expectedCash != null ? closingCash - expectedCash : null;

    return {
      session_id: s.id,
      cashier_id: s.cashier_id,
      cashier_name: name,
      outlet_id: s.outlet_id,
      outlet_name: s.warehouses?.name ?? '—',
      status: s.status ?? 'open',
      opened_at: s.opened_at ?? '',
      closed_at: s.closed_at ?? null,
      duration_min: durationMin,
      orders_count: agg.count,
      gross_sales: agg.revenue,
      avg_ticket: agg.count > 0 ? agg.revenue / agg.count : 0,
      opening_cash: Number(s.opening_cash || 0),
      closing_cash: closingCash,
      expected_cash: expectedCash,
      cash_variance: variance,
    };
  });

  const totalSales = rows.reduce((s, r) => s + r.gross_sales, 0);
  const totalOrders = rows.reduce((s, r) => s + r.orders_count, 0);
  const totalVariance = rows.reduce((s, r) => s + (r.cash_variance ?? 0), 0);

  return {
    rows,
    total: rows.length,
    summary: {
      total_sessions: rows.length,
      total_orders: totalOrders,
      total_sales: totalSales,
      total_cash_variance: totalVariance,
      avg_ticket: totalOrders > 0 ? totalSales / totalOrders : 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Shared: previous-equivalent period bounds (Batch B comparison helper)
// ---------------------------------------------------------------------------
function previousEquivalentPeriod(q: ReportQuery): { from_date: string; to_date: string; days: number } {
  const from = new Date(q.from_date + 'T00:00:00Z');
  const to = new Date(q.to_date + 'T00:00:00Z');
  const msPerDay = 86400000;
  // Inclusive day count.
  const days = Math.max(1, Math.floor((to.getTime() - from.getTime()) / msPerDay) + 1);
  const prevTo = new Date(from.getTime() - msPerDay);
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * msPerDay);
  const toIso = (d: Date) => d.toISOString().split('T')[0];
  return { from_date: toIso(prevFrom), to_date: toIso(prevTo), days };
}

function withDateWindow(q: ReportQuery, from_date: string, to_date: string): ReportQuery {
  return { ...q, from_date, to_date };
}

const safePct = (prev: number, curr: number) =>
  prev > 0 ? ((curr - prev) / prev) * 100 : (curr > 0 ? 100 : 0);

// ---------------------------------------------------------------------------
// 14. Category-wise & Brand-wise Sales (Batch B)
// ---------------------------------------------------------------------------
export interface CategoryBrandSalesRow {
  category_id: string;
  category_name: string;
  brand_id: string;
  brand_name: string;
  total_qty: number;
  total_revenue: number;
  list_value: number;          // sum of products.price * qty (undiscounted list value, when list price known)
  total_discount: number;      // list_value - total_revenue (effective discount given off list)
  discount_pct: number;        // total_discount / list_value (0-100)
  margin_retention_pct: number;// 100 - discount_pct (effective retention of list price)
  order_count: number;
}

export async function getCategoryBrandSales(q: ReportQuery, companyId: string) {
  // Pull order items in scope joined to orders + products for category/brand tags.
  let query = db()
    .from('order_items')
    .select(`
      product_id, quantity, unit_price, tax_amount, discount_amount,
      order:order_id!inner(id, company_id, order_type, status, created_at, outlet_id, order_source, pos_session_id),
      products:product_id(id, name, price, category_id, brand_id)
    `)
    .eq('order.company_id', companyId)
    .eq('order.order_type', 'sales')
    .neq('order.status', 'cancelled')
    .gte('order.created_at', q.from_date)
    .lte('order.created_at', q.to_date + 'T23:59:59Z');

  if (q.order_source)   query = query.eq('order.order_source', q.order_source);
  if (q.pos_session_id) query = query.eq('order.pos_session_id', q.pos_session_id);
  if (q.branch_ids?.length) query = query.in('order.outlet_id', q.branch_ids);

  const { data: items, error } = await query;
  if (error) throw toServiceError('Category/brand sales query', error);

  const itemList = items ?? [];

  // Collect category and brand ids for label lookup
  const categoryIds = new Set<string>();
  const brandIds = new Set<string>();
  itemList.forEach((it: any) => {
    if (it.products?.category_id) categoryIds.add(it.products.category_id);
    if (it.products?.brand_id) brandIds.add(it.products.brand_id);
  });

  const [categoriesRes, brandsRes] = await Promise.all([
    categoryIds.size
      ? db().from('categories').select('id, name').in('id', Array.from(categoryIds))
      : Promise.resolve({ data: [] as any[] }),
    brandIds.size
      ? db().from('brands').select('id, name').in('id', Array.from(brandIds))
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const categoryMap = new Map<string, string>();
  (categoriesRes.data ?? []).forEach((c: any) => categoryMap.set(c.id, c.name));
  const brandMap = new Map<string, string>();
  (brandsRes.data ?? []).forEach((b: any) => brandMap.set(b.id, b.name));

  // Aggregate by (category_id, brand_id).
  const buckets = new Map<string, CategoryBrandSalesRow & { orders: Set<string> }>();
  itemList.forEach((it: any) => {
    const catId = it.products?.category_id ?? 'uncategorized';
    const brandId = it.products?.brand_id ?? 'no_brand';
    const key = `${catId}__${brandId}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        category_id: catId,
        category_name: categoryMap.get(catId) ?? (catId === 'uncategorized' ? 'Uncategorized' : '—'),
        brand_id: brandId,
        brand_name: brandMap.get(brandId) ?? (brandId === 'no_brand' ? 'No brand' : '—'),
        total_qty: 0,
        total_revenue: 0,
        list_value: 0,
        total_discount: 0,
        discount_pct: 0,
        margin_retention_pct: 0,
        order_count: 0,
        orders: new Set<string>(),
      });
    }
    const b = buckets.get(key)!;
    const qty = Number(it.quantity || 0);
    const listPrice = Number(it.products?.price ?? it.unit_price ?? 0);
    const unitPrice = Number(it.unit_price || 0);
    const revenue = qty * unitPrice;
    const listValue = qty * listPrice;
    b.total_qty += qty;
    b.total_revenue += revenue;
    b.list_value += listValue;
    b.total_discount += Math.max(0, listValue - revenue);
    if (it.order?.id) b.orders.add(it.order.id);
  });

  const rows: CategoryBrandSalesRow[] = Array.from(buckets.values()).map((b) => {
    const discPct = b.list_value > 0 ? (b.total_discount / b.list_value) * 100 : 0;
    return {
      category_id: b.category_id,
      category_name: b.category_name,
      brand_id: b.brand_id,
      brand_name: b.brand_name,
      total_qty: b.total_qty,
      total_revenue: b.total_revenue,
      list_value: b.list_value,
      total_discount: b.total_discount,
      discount_pct: discPct,
      margin_retention_pct: 100 - discPct,
      order_count: b.orders.size,
    };
  }).sort((a, b) => b.total_revenue - a.total_revenue);

  // Build category + brand rollups for the summary.
  const rollup = (dim: 'category' | 'brand') => {
    const map = new Map<string, { label: string; revenue: number; qty: number }>();
    rows.forEach((r) => {
      const id = dim === 'category' ? r.category_id : r.brand_id;
      const label = dim === 'category' ? r.category_name : r.brand_name;
      if (!map.has(id)) map.set(id, { label, revenue: 0, qty: 0 });
      const x = map.get(id)!;
      x.revenue += r.total_revenue;
      x.qty += r.total_qty;
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  };
  const byCategory = rollup('category');
  const byBrand = rollup('brand');

  const totalRevenue = rows.reduce((s, r) => s + r.total_revenue, 0);
  const totalList = rows.reduce((s, r) => s + r.list_value, 0);

  return {
    rows,
    total: rows.length,
    summary: {
      total_revenue: totalRevenue,
      total_qty: rows.reduce((s, r) => s + r.total_qty, 0),
      total_discount: rows.reduce((s, r) => s + r.total_discount, 0),
      avg_discount_pct: totalList > 0 ? ((totalList - totalRevenue) / totalList) * 100 : 0,
      top_category: byCategory[0]?.label ?? '—',
      top_brand: byBrand[0]?.label ?? '—',
      categories_json: JSON.stringify(byCategory.slice(0, 10)),
      brands_json: JSON.stringify(byBrand.slice(0, 10)),
    },
  };
}

// ---------------------------------------------------------------------------
// 15. Average Basket Metrics (Batch B)
// ---------------------------------------------------------------------------
export interface AverageBasketRow {
  day: string;            // YYYY-MM-DD
  orders: number;
  items: number;
  unique_skus: number;
  revenue: number;
  avg_basket_value: number;
  avg_items_per_order: number;
  avg_unique_skus: number;
}

export async function getAverageBasketMetrics(q: ReportQuery, companyId: string) {
  let query = db()
    .from('orders')
    .select(`
      id, created_at, total_amount,
      order_items(product_id, variant_id, quantity)
    `);
  query = applyOrderScope(query, q, companyId);

  const { data, error } = await query;
  if (error) throw toServiceError('Average basket metrics query', error);

  const orderList = data ?? [];

  // Per-day aggregates.
  const daily = new Map<string, {
    orders: number; items: number; skuSum: number; revenue: number;
  }>();

  let globalOrders = 0;
  let globalItems = 0;
  let globalSku = 0;
  let globalRevenue = 0;

  orderList.forEach((o: any) => {
    const day = (o.created_at ?? '').split('T')[0] || '';
    if (!day) return;
    const items = o.order_items ?? [];
    const itemCount = items.reduce((s: number, it: any) => s + Number(it.quantity || 0), 0);
    const uniqueSkus = new Set<string>();
    items.forEach((it: any) => {
      const key = `${it.product_id ?? ''}__${it.variant_id ?? ''}`;
      if (key !== '__') uniqueSkus.add(key);
    });
    if (!daily.has(day)) daily.set(day, { orders: 0, items: 0, skuSum: 0, revenue: 0 });
    const d = daily.get(day)!;
    d.orders += 1;
    d.items += itemCount;
    d.skuSum += uniqueSkus.size;
    d.revenue += Number(o.total_amount || 0);

    globalOrders += 1;
    globalItems += itemCount;
    globalSku += uniqueSkus.size;
    globalRevenue += Number(o.total_amount || 0);
  });

  const rows: AverageBasketRow[] = Array.from(daily.entries())
    .map(([day, d]) => ({
      day,
      orders: d.orders,
      items: d.items,
      unique_skus: d.skuSum,
      revenue: d.revenue,
      avg_basket_value: d.orders > 0 ? d.revenue / d.orders : 0,
      avg_items_per_order: d.orders > 0 ? d.items / d.orders : 0,
      avg_unique_skus: d.orders > 0 ? d.skuSum / d.orders : 0,
    }))
    .sort((a, b) => a.day.localeCompare(b.day));

  return {
    rows,
    total: rows.length,
    summary: {
      total_orders: globalOrders,
      total_items: globalItems,
      total_revenue: globalRevenue,
      avg_basket_value: globalOrders > 0 ? globalRevenue / globalOrders : 0,
      avg_items_per_order: globalOrders > 0 ? globalItems / globalOrders : 0,
      avg_unique_skus_per_order: globalOrders > 0 ? globalSku / globalOrders : 0,
    },
  };
}

// ---------------------------------------------------------------------------
// 16. Modifier / Add-on Revenue (Batch B)
// ---------------------------------------------------------------------------
export interface ModifierRevenueRow {
  modifier_id: string;
  modifier_name: string;
  group_name: string;
  attach_count: number;      // total times attached across orders
  orders_attached: number;   // distinct orders using this modifier
  total_adjust: number;
  avg_adjust: number;
  attach_rate_pct: number;   // % of in-scope orders that used this modifier
}

export async function getModifierAddonRevenue(q: ReportQuery, companyId: string) {
  // 1) In-scope orders
  const { data: orders, error: oe } = await applyOrderScope(
    db().from('orders').select('id'),
    q,
    companyId,
  );
  if (oe) throw toServiceError('Modifier revenue order scope query', oe);
  const orderIds = (orders ?? []).map((o: any) => o.id as string);
  const totalOrdersInScope = orderIds.length;

  if (!totalOrdersInScope) {
    return {
      rows: [] as ModifierRevenueRow[],
      total: 0,
      summary: {
        total_orders: 0,
        orders_with_modifiers: 0,
        total_attach_count: 0,
        total_adjust: 0,
        attach_rate_pct: 0,
      },
    };
  }

  // 2) Order items belonging to scoped orders (needed to link modifiers → orders)
  const { data: lineItems, error: lie } = await db()
    .from('order_items')
    .select('id, order_id')
    .in('order_id', orderIds);
  if (lie) throw toServiceError('Modifier revenue order_items query', lie);
  const itemToOrder = new Map<string, string>();
  (lineItems ?? []).forEach((li: any) => itemToOrder.set(li.id, li.order_id));
  const itemIds = Array.from(itemToOrder.keys());
  if (!itemIds.length) {
    return {
      rows: [] as ModifierRevenueRow[],
      total: 0,
      summary: {
        total_orders: totalOrdersInScope,
        orders_with_modifiers: 0,
        total_attach_count: 0,
        total_adjust: 0,
        attach_rate_pct: 0,
      },
    };
  }

  // 3) Modifier line rows
  const { data: modLines, error: me } = await db()
    .from('order_item_modifiers')
    .select('modifier_id, order_item_id, price_adjust')
    .eq('company_id', companyId)
    .in('order_item_id', itemIds);
  if (me) throw toServiceError('Modifier revenue order_item_modifiers query', me);
  const modRowsRaw = modLines ?? [];

  // 4) Modifier metadata
  const modifierIds = [...new Set(modRowsRaw.map((m: any) => m.modifier_id).filter(Boolean))] as string[];
  const { data: modifiers, error: mde } = modifierIds.length
    ? await db().from('modifiers').select('id, name, modifier_group_id').in('id', modifierIds)
    : { data: [] as any[], error: null };
  if (mde) throw toServiceError('Modifiers lookup query', mde);
  const groupIds = [...new Set((modifiers ?? []).map((m: any) => m.modifier_group_id).filter(Boolean))] as string[];
  const { data: groups } = groupIds.length
    ? await db().from('modifier_groups').select('id, name').in('id', groupIds)
    : { data: [] as any[] };
  const groupMap = new Map<string, string>();
  (groups ?? []).forEach((g: any) => groupMap.set(g.id, g.name));
  const modifierMeta = new Map<string, { name: string; group: string }>();
  (modifiers ?? []).forEach((m: any) =>
    modifierMeta.set(m.id, {
      name: m.name ?? '—',
      group: groupMap.get(m.modifier_group_id) ?? '—',
    }),
  );

  // 5) Aggregate
  const buckets = new Map<string, {
    row: ModifierRevenueRow;
    orders: Set<string>;
  }>();
  const globalOrders = new Set<string>();

  modRowsRaw.forEach((m: any) => {
    const modId = m.modifier_id ?? 'unknown';
    const orderId = itemToOrder.get(m.order_item_id) ?? '';
    const meta = modifierMeta.get(modId);
    if (!buckets.has(modId)) {
      buckets.set(modId, {
        row: {
          modifier_id: modId,
          modifier_name: meta?.name ?? '—',
          group_name: meta?.group ?? '—',
          attach_count: 0,
          orders_attached: 0,
          total_adjust: 0,
          avg_adjust: 0,
          attach_rate_pct: 0,
        },
        orders: new Set<string>(),
      });
    }
    const b = buckets.get(modId)!;
    b.row.attach_count += 1;
    b.row.total_adjust += Number(m.price_adjust || 0);
    if (orderId) {
      b.orders.add(orderId);
      globalOrders.add(orderId);
    }
  });

  const rows: ModifierRevenueRow[] = Array.from(buckets.values()).map(({ row, orders }) => {
    row.orders_attached = orders.size;
    row.avg_adjust = row.attach_count > 0 ? row.total_adjust / row.attach_count : 0;
    row.attach_rate_pct = totalOrdersInScope > 0 ? (orders.size / totalOrdersInScope) * 100 : 0;
    return row;
  }).sort((a, b) => b.total_adjust - a.total_adjust);

  return {
    rows,
    total: rows.length,
    summary: {
      total_orders: totalOrdersInScope,
      orders_with_modifiers: globalOrders.size,
      total_attach_count: rows.reduce((s, r) => s + r.attach_count, 0),
      total_adjust: rows.reduce((s, r) => s + r.total_adjust, 0),
      attach_rate_pct: totalOrdersInScope > 0 ? (globalOrders.size / totalOrdersInScope) * 100 : 0,
    },
  };
}

// ---------------------------------------------------------------------------
// 17. Hourly & Weekday Trend Comparison (Batch B)
// ---------------------------------------------------------------------------
export interface TrendComparisonRow {
  dimension: 'hour' | 'weekday';
  bucket: number;              // 0-23 for hour, 0-6 for weekday
  label: string;               // '08:00' or 'Mon'
  current_orders: number;
  current_revenue: number;
  previous_orders: number;
  previous_revenue: number;
  orders_delta_pct: number;
  revenue_delta_pct: number;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

async function fetchHourWeekdayBuckets(q: ReportQuery, companyId: string) {
  const { data, error } = await applyOrderScope(
    db().from('orders').select('created_at, total_amount'),
    q,
    companyId,
  );
  if (error) throw toServiceError('Trend comparison query', error);

  const byHour = new Map<number, { orders: number; revenue: number }>();
  const byWeekday = new Map<number, { orders: number; revenue: number }>();
  (data ?? []).forEach((o: any) => {
    if (!o.created_at) return;
    const d = new Date(o.created_at);
    if (Number.isNaN(d.getTime())) return;
    const h = d.getHours();
    const w = d.getDay();
    if (!byHour.has(h)) byHour.set(h, { orders: 0, revenue: 0 });
    if (!byWeekday.has(w)) byWeekday.set(w, { orders: 0, revenue: 0 });
    const bh = byHour.get(h)!;
    const bw = byWeekday.get(w)!;
    const rev = Number(o.total_amount || 0);
    bh.orders += 1; bh.revenue += rev;
    bw.orders += 1; bw.revenue += rev;
  });
  return { byHour, byWeekday };
}

export async function getHourlyWeekdayTrendComparison(q: ReportQuery, companyId: string) {
  const prevBounds = previousEquivalentPeriod(q);
  const prevQuery = withDateWindow(q, prevBounds.from_date, prevBounds.to_date);

  const [curr, prev] = await Promise.all([
    fetchHourWeekdayBuckets(q, companyId),
    fetchHourWeekdayBuckets(prevQuery, companyId),
  ]);

  const hourRows: TrendComparisonRow[] = [];
  for (let h = 0; h < 24; h++) {
    const c = curr.byHour.get(h) ?? { orders: 0, revenue: 0 };
    const p = prev.byHour.get(h) ?? { orders: 0, revenue: 0 };
    if (c.orders === 0 && p.orders === 0) continue;
    hourRows.push({
      dimension: 'hour',
      bucket: h,
      label: `${String(h).padStart(2, '0')}:00`,
      current_orders: c.orders,
      current_revenue: c.revenue,
      previous_orders: p.orders,
      previous_revenue: p.revenue,
      orders_delta_pct: safePct(p.orders, c.orders),
      revenue_delta_pct: safePct(p.revenue, c.revenue),
    });
  }

  const weekdayRows: TrendComparisonRow[] = [];
  for (let w = 0; w < 7; w++) {
    const c = curr.byWeekday.get(w) ?? { orders: 0, revenue: 0 };
    const p = prev.byWeekday.get(w) ?? { orders: 0, revenue: 0 };
    if (c.orders === 0 && p.orders === 0) continue;
    weekdayRows.push({
      dimension: 'weekday',
      bucket: w,
      label: WEEKDAY_LABELS[w],
      current_orders: c.orders,
      current_revenue: c.revenue,
      previous_orders: p.orders,
      previous_revenue: p.revenue,
      orders_delta_pct: safePct(p.orders, c.orders),
      revenue_delta_pct: safePct(p.revenue, c.revenue),
    });
  }

  const rows = [...hourRows, ...weekdayRows];

  const sumField = (arr: TrendComparisonRow[], k: keyof TrendComparisonRow) =>
    arr.reduce((s, r) => s + Number(r[k] as number || 0), 0);

  return {
    rows,
    total: rows.length,
    summary: {
      period_from: q.from_date,
      period_to: q.to_date,
      previous_from: prevBounds.from_date,
      previous_to: prevBounds.to_date,
      current_orders: sumField(hourRows, 'current_orders'),
      previous_orders: sumField(hourRows, 'previous_orders'),
      current_revenue: sumField(hourRows, 'current_revenue'),
      previous_revenue: sumField(hourRows, 'previous_revenue'),
      orders_delta_pct: safePct(sumField(hourRows, 'previous_orders'), sumField(hourRows, 'current_orders')),
      revenue_delta_pct: safePct(sumField(hourRows, 'previous_revenue'), sumField(hourRows, 'current_revenue')),
    },
  };
}

// ---------------------------------------------------------------------------
// 18. Top / Bottom Movers (Batch B)
// ---------------------------------------------------------------------------
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

async function fetchItemsWithinScope(q: ReportQuery, companyId: string) {
  let query = db()
    .from('order_items')
    .select(`
      product_id, variant_id, quantity, unit_price,
      order:order_id!inner(company_id, order_type, status, created_at, outlet_id, order_source, pos_session_id),
      products:product_id(id, name),
      product_variants:variant_id(id, name, sku)
    `)
    .eq('order.company_id', companyId)
    .eq('order.order_type', 'sales')
    .neq('order.status', 'cancelled')
    .gte('order.created_at', q.from_date)
    .lte('order.created_at', q.to_date + 'T23:59:59Z');

  if (q.order_source) query = query.eq('order.order_source', q.order_source);
  if (q.pos_session_id) query = query.eq('order.pos_session_id', q.pos_session_id);
  if (q.branch_ids?.length) query = query.in('order.outlet_id', q.branch_ids);

  const { data, error } = await query;
  if (error) throw toServiceError('Movers items query', error);
  return data ?? [];
}

export async function getTopBottomMovers(q: ReportQuery, companyId: string) {
  const prevBounds = previousEquivalentPeriod(q);
  const prevQuery = withDateWindow(q, prevBounds.from_date, prevBounds.to_date);

  const [currItems, prevItems] = await Promise.all([
    fetchItemsWithinScope(q, companyId),
    fetchItemsWithinScope(prevQuery, companyId),
  ]);

  const bucketKey = (it: any) => `${it.product_id}__${it.variant_id ?? 'null'}`;

  type Bucket = {
    product_id: string; variant_id: string;
    product_name: string; sku: string;
    qty: number; revenue: number;
  };

  const makeBucket = (it: any): Bucket => ({
    product_id: it.product_id ?? '',
    variant_id: it.variant_id ?? '',
    product_name: it.products?.name ?? '—',
    sku: it.product_variants?.sku ?? '—',
    qty: 0,
    revenue: 0,
  });

  const currMap = new Map<string, Bucket>();
  const prevMap = new Map<string, Bucket>();

  currItems.forEach((it: any) => {
    const key = bucketKey(it);
    if (!currMap.has(key)) currMap.set(key, makeBucket(it));
    const b = currMap.get(key)!;
    b.qty += Number(it.quantity || 0);
    b.revenue += Number(it.quantity || 0) * Number(it.unit_price || 0);
  });
  prevItems.forEach((it: any) => {
    const key = bucketKey(it);
    if (!prevMap.has(key)) prevMap.set(key, makeBucket(it));
    const b = prevMap.get(key)!;
    b.qty += Number(it.quantity || 0);
    b.revenue += Number(it.quantity || 0) * Number(it.unit_price || 0);
  });

  const allKeys = new Set<string>([...currMap.keys(), ...prevMap.keys()]);
  const MIN_SIGNAL = 2; // avoid pure-noise SKUs (combined qty across periods >= 2)

  const rows: MoverRow[] = [];
  allKeys.forEach((key) => {
    const c = currMap.get(key);
    const p = prevMap.get(key);
    const meta = c ?? p!;
    const curQty = c?.qty ?? 0;
    const prvQty = p?.qty ?? 0;
    if (curQty + prvQty < MIN_SIGNAL) return;
    const curRev = c?.revenue ?? 0;
    const prvRev = p?.revenue ?? 0;
    const qtyDelta = curQty - prvQty;
    const revDelta = curRev - prvRev;
    const qtyPct = safePct(prvQty, curQty);
    const revPct = safePct(prvRev, curRev);

    rows.push({
      product_id: meta.product_id,
      variant_id: meta.variant_id,
      product_name: meta.product_name,
      sku: meta.sku,
      current_qty: curQty,
      previous_qty: prvQty,
      qty_delta: qtyDelta,
      qty_delta_pct: qtyPct,
      current_revenue: curRev,
      previous_revenue: prvRev,
      revenue_delta: revDelta,
      revenue_delta_pct: revPct,
      direction: revDelta > 0 ? 'up' : revDelta < 0 ? 'down' : 'flat',
    });
  });

  rows.sort((a, b) => b.revenue_delta - a.revenue_delta);

  const topGainers = rows.slice(0, 10);
  const topDecliners = [...rows].sort((a, b) => a.revenue_delta - b.revenue_delta).slice(0, 10);

  return {
    rows,
    total: rows.length,
    summary: {
      period_from: q.from_date,
      period_to: q.to_date,
      previous_from: prevBounds.from_date,
      previous_to: prevBounds.to_date,
      skus_tracked: rows.length,
      gainers: rows.filter(r => r.direction === 'up').length,
      decliners: rows.filter(r => r.direction === 'down').length,
      top_gainer: topGainers[0]?.product_name ?? '—',
      top_decliner: topDecliners[0]?.product_name ?? '—',
      top_gainers_json: JSON.stringify(topGainers.map(r => ({ name: r.product_name, delta: r.revenue_delta, delta_pct: r.revenue_delta_pct }))),
      top_decliners_json: JSON.stringify(topDecliners.map(r => ({ name: r.product_name, delta: r.revenue_delta, delta_pct: r.revenue_delta_pct }))),
    },
  };
}

// ---------------------------------------------------------------------------
// 19. Outlet Comparison Leaderboard (Batch B — admin-gated in UI)
// ---------------------------------------------------------------------------
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

async function fetchOutletAggregates(q: ReportQuery, companyId: string) {
  let query = db()
    .from('orders')
    .select(`
      id, outlet_id, total_amount,
      warehouses:outlet_id(name),
      order_items(quantity)
    `);
  query = applyOrderScope(query, q, companyId);

  const { data, error } = await query;
  if (error) throw toServiceError('Outlet leaderboard query', error);

  const map = new Map<string, {
    outlet_id: string; outlet_name: string;
    orders: number; revenue: number; items: number;
  }>();
  (data ?? []).forEach((o: any) => {
    const key = o.outlet_id ?? 'unassigned';
    if (!map.has(key)) {
      map.set(key, {
        outlet_id: key,
        outlet_name: o.warehouses?.name ?? (key === 'unassigned' ? 'Unassigned' : '—'),
        orders: 0, revenue: 0, items: 0,
      });
    }
    const b = map.get(key)!;
    b.orders += 1;
    b.revenue += Number(o.total_amount || 0);
    b.items += (o.order_items ?? []).reduce((s: number, it: any) => s + Number(it.quantity || 0), 0);
  });
  return map;
}

export async function getOutletLeaderboard(q: ReportQuery, companyId: string) {
  const prevBounds = previousEquivalentPeriod(q);
  const prevQuery = withDateWindow(q, prevBounds.from_date, prevBounds.to_date);

  const [curr, prev] = await Promise.all([
    fetchOutletAggregates(q, companyId),
    fetchOutletAggregates(prevQuery, companyId),
  ]);

  const keys = new Set<string>([...curr.keys(), ...prev.keys()]);
  const rows: OutletLeaderboardRow[] = [];
  keys.forEach((key) => {
    const c = curr.get(key);
    const p = prev.get(key);
    const meta = c ?? p!;
    const curRev = c?.revenue ?? 0;
    const prvRev = p?.revenue ?? 0;
    const curOrd = c?.orders ?? 0;
    const prvOrd = p?.orders ?? 0;
    const items = c?.items ?? 0;

    rows.push({
      rank: 0,
      outlet_id: meta.outlet_id,
      outlet_name: meta.outlet_name,
      current_revenue: curRev,
      previous_revenue: prvRev,
      revenue_delta_pct: safePct(prvRev, curRev),
      current_orders: curOrd,
      previous_orders: prvOrd,
      orders_delta_pct: safePct(prvOrd, curOrd),
      items_sold: items,
      avg_ticket: curOrd > 0 ? curRev / curOrd : 0,
      items_per_order: curOrd > 0 ? items / curOrd : 0,
    });
  });

  rows.sort((a, b) => b.current_revenue - a.current_revenue);
  rows.forEach((r, i) => { r.rank = i + 1; });

  const totalCurr = rows.reduce((s, r) => s + r.current_revenue, 0);
  const totalPrev = rows.reduce((s, r) => s + r.previous_revenue, 0);

  return {
    rows,
    total: rows.length,
    summary: {
      period_from: q.from_date,
      period_to: q.to_date,
      previous_from: prevBounds.from_date,
      previous_to: prevBounds.to_date,
      outlets_active: rows.length,
      total_revenue: totalCurr,
      total_revenue_prev: totalPrev,
      revenue_delta_pct: safePct(totalPrev, totalCurr),
      top_outlet: rows[0]?.outlet_name ?? '—',
    },
  };
}

// ---------------------------------------------------------------------------
// KOT REPORT BATCH — sources: pos_kot_tickets, pos_food_counters
// ---------------------------------------------------------------------------

// 20. KOT Volume by Counter
// ---------------------------------------------------------------------------
export interface KotVolumeByCounterRow {
  counter_id: string;
  counter_name: string;
  outlet_id: string;
  outlet_name: string;
  total_tickets: number;
  open_tickets: number;
  completed_tickets: number;
  voided_tickets: number;
  avg_items_per_ticket: number;
  total_items: number;
}

export async function getKotVolumeByCounter(q: ReportQuery, companyId: string) {
  // Fetch tickets in range
  let ticketQuery = db()
    .from('pos_kot_tickets')
    .select('id, counter_id, outlet_id, status, ticket_items_snapshot, created_at')
    .eq('company_id', companyId)
    .gte('created_at', q.from_date)
    .lte('created_at', q.to_date + 'T23:59:59Z');

  if (q.branch_ids?.length) ticketQuery = ticketQuery.in('outlet_id', q.branch_ids);

  const { data: tickets, error: te } = await ticketQuery;
  if (te) throw toServiceError('KOT volume query', te);

  // Fetch counters + outlets
  const { data: counters, error: ce } = await db()
    .from('pos_food_counters')
    .select('id, name, outlet_id, warehouses:outlet_id(name)')
    .eq('company_id', companyId);
  if (ce) throw toServiceError('KOT counters query', ce);

  const counterMap = new Map<string, any>(
    (counters ?? []).map((c: any) => [c.id, c])
  );

  // Aggregate
  const buckets = new Map<string, {
    counter: any;
    total: number;
    open: number;
    completed: number;
    voided: number;
    totalItems: number;
  }>();

  (tickets ?? []).forEach((t: any) => {
    const key = t.counter_id ?? 'unknown';
    if (!buckets.has(key)) {
      buckets.set(key, { counter: counterMap.get(key) ?? null, total: 0, open: 0, completed: 0, voided: 0, totalItems: 0 });
    }
    const b = buckets.get(key)!;
    b.total += 1;
    if (t.status === 'open' || t.status === 'pending') b.open += 1;
    else if (t.status === 'completed' || t.status === 'done') b.completed += 1;
    else if (t.status === 'voided' || t.status === 'cancelled') b.voided += 1;
    const items = Array.isArray(t.ticket_items_snapshot) ? t.ticket_items_snapshot.length : 0;
    b.totalItems += items;
  });

  const rows: KotVolumeByCounterRow[] = Array.from(buckets.entries())
    .map(([cid, b]) => ({
      counter_id: cid,
      counter_name: b.counter?.name ?? 'Unknown Counter',
      outlet_id: b.counter?.outlet_id ?? '',
      outlet_name: (b.counter?.warehouses as any)?.name ?? '—',
      total_tickets: b.total,
      open_tickets: b.open,
      completed_tickets: b.completed,
      voided_tickets: b.voided,
      avg_items_per_ticket: b.total > 0 ? +(b.totalItems / b.total).toFixed(2) : 0,
      total_items: b.totalItems,
    }))
    .sort((a, b) => b.total_tickets - a.total_tickets);

  const total = rows.reduce((s, r) => s + r.total_tickets, 0);
  const completed = rows.reduce((s, r) => s + r.completed_tickets, 0);
  const paginated = rows.slice((q.page - 1) * q.page_size, q.page * q.page_size);

  return {
    rows: paginated,
    total: rows.length,
    summary: {
      total_tickets: total,
      total_completed: completed,
      completion_rate_pct: total > 0 ? +((completed / total) * 100).toFixed(1) : 0,
      counters_active: rows.length,
    },
  };
}

// ---------------------------------------------------------------------------
// 21. KOT Ticket Status Breakdown
// ---------------------------------------------------------------------------
export interface KotStatusBreakdownRow {
  outlet_id: string;
  outlet_name: string;
  status: string;
  ticket_count: number;
  share_pct: number;
}

export async function getKotStatusBreakdown(q: ReportQuery, companyId: string) {
  let query = db()
    .from('pos_kot_tickets')
    .select('outlet_id, status, warehouses:outlet_id(name), created_at')
    .eq('company_id', companyId)
    .gte('created_at', q.from_date)
    .lte('created_at', q.to_date + 'T23:59:59Z');

  if (q.branch_ids?.length) query = query.in('outlet_id', q.branch_ids);

  const { data, error } = await query;
  if (error) throw toServiceError('KOT status breakdown query', error);

  // Bucket by outlet+status
  const buckets = new Map<string, { outlet_id: string; outlet_name: string; status: string; count: number }>();
  let grandTotal = 0;

  (data ?? []).forEach((t: any) => {
    const key = `${t.outlet_id}::${t.status}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        outlet_id: t.outlet_id,
        outlet_name: (t.warehouses as any)?.name ?? '—',
        status: t.status ?? 'unknown',
        count: 0,
      });
    }
    buckets.get(key)!.count += 1;
    grandTotal += 1;
  });

  const rows: KotStatusBreakdownRow[] = Array.from(buckets.values())
    .map(b => ({
      outlet_id: b.outlet_id,
      outlet_name: b.outlet_name,
      status: b.status,
      ticket_count: b.count,
      share_pct: grandTotal > 0 ? +((b.count / grandTotal) * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.ticket_count - a.ticket_count);

  const openCount = rows.filter(r => r.status === 'open' || r.status === 'pending')
    .reduce((s, r) => s + r.ticket_count, 0);

  const paginated = rows.slice((q.page - 1) * q.page_size, q.page * q.page_size);
  return {
    rows: paginated,
    total: rows.length,
    summary: {
      total_tickets: grandTotal,
      open_tickets: openCount,
      open_rate_pct: grandTotal > 0 ? +((openCount / grandTotal) * 100).toFixed(1) : 0,
    },
  };
}

// ---------------------------------------------------------------------------
// 22. KOT Top Items (JSONB analysis)
// ---------------------------------------------------------------------------
export interface KotTopItemRow {
  product_id: string;
  product_name: string;
  variant_name: string;
  total_qty: number;
  ticket_count: number;
  avg_qty_per_ticket: number;
}

export async function getKotTopItems(q: ReportQuery, companyId: string) {
  let query = db()
    .from('pos_kot_tickets')
    .select('ticket_items_snapshot, created_at')
    .eq('company_id', companyId)
    .gte('created_at', q.from_date)
    .lte('created_at', q.to_date + 'T23:59:59Z');

  if (q.branch_ids?.length) query = query.in('outlet_id', q.branch_ids);

  const { data, error } = await query;
  if (error) throw toServiceError('KOT top items query', error);

  // Unnest JSONB ticket_items_snapshot — each element expected:
  // { product_id, product_name, variant_name, quantity }
  const buckets = new Map<string, {
    product_id: string; product_name: string; variant_name: string;
    totalQty: number; tickets: number;
  }>();

  (data ?? []).forEach((t: any) => {
    const items = Array.isArray(t.ticket_items_snapshot) ? t.ticket_items_snapshot : [];
    items.forEach((item: any) => {
      const pid = item.product_id ?? item.variant_id ?? 'unknown';
      const key = `${pid}::${item.kitchen_display_name ?? ''}`;
      if (!buckets.has(key)) {
        buckets.set(key, {
          product_id: pid,
          product_name: item.kitchen_display_name ?? '—',
          variant_name: '—',
          totalQty: 0,
          tickets: 0,
        });
      }
      const b = buckets.get(key)!;
      b.totalQty += Number(item.quantity ?? 1);
      b.tickets += 1;
    });
  });

  let rows: KotTopItemRow[] = Array.from(buckets.values())
    .map(b => ({
      product_id: b.product_id,
      product_name: b.product_name,
      variant_name: b.variant_name,
      total_qty: b.totalQty,
      ticket_count: b.tickets,
      avg_qty_per_ticket: b.tickets > 0 ? +(b.totalQty / b.tickets).toFixed(2) : 0,
    }))
    .sort((a, b) => b.total_qty - a.total_qty);

  if (q.search) {
    const s = q.search.toLowerCase();
    rows = rows.filter(r => r.product_name.toLowerCase().includes(s));
  }

  const paginated = rows.slice((q.page - 1) * q.page_size, q.page * q.page_size);
  return {
    rows: paginated,
    total: rows.length,
    summary: {
      unique_items: rows.length,
      total_qty_fired: rows.reduce((s, r) => s + r.total_qty, 0),
      top_item: rows[0]?.product_name ?? '—',
    },
  };
}

// ---------------------------------------------------------------------------
// 23. KOT Throughput / Fulfilment Time (created_at → updated_at when completed)
// ---------------------------------------------------------------------------
export interface KotThroughputRow {
  counter_id: string;
  counter_name: string;
  outlet_name: string;
  completed_tickets: number;
  avg_fulfilment_min: number;
  min_fulfilment_min: number;
  max_fulfilment_min: number;
}

export async function getKotThroughput(q: ReportQuery, companyId: string) {
  let query = db()
    .from('pos_kot_tickets')
    .select('counter_id, outlet_id, status, created_at, updated_at, warehouses:outlet_id(name)')
    .eq('company_id', companyId)
    .in('status', ['completed', 'done', 'served'])
    .gte('created_at', q.from_date)
    .lte('created_at', q.to_date + 'T23:59:59Z');

  if (q.branch_ids?.length) query = query.in('outlet_id', q.branch_ids);

  const { data: tickets, error: te } = await query;
  if (te) throw toServiceError('KOT throughput query', te);

  const { data: counters } = await db()
    .from('pos_food_counters')
    .select('id, name')
    .eq('company_id', companyId);
  const counterMap = new Map<string, string>(
    (counters ?? []).map((c: any) => [c.id, c.name])
  );

  const buckets = new Map<string, {
    outlet_name: string;
    durations: number[];
  }>();

  (tickets ?? []).forEach((t: any) => {
    if (!t.created_at || !t.updated_at) return;
    const diffMin = (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()) / 60000;
    if (diffMin < 0 || diffMin > 480) return; // ignore negative or >8h (data anomalies)
    const key = t.counter_id ?? 'unknown';
    if (!buckets.has(key)) {
      buckets.set(key, { outlet_name: (t.warehouses as any)?.name ?? '—', durations: [] });
    }
    buckets.get(key)!.durations.push(diffMin);
  });

  const rows: KotThroughputRow[] = Array.from(buckets.entries())
    .map(([cid, b]) => {
      const avg = b.durations.length > 0
        ? +(b.durations.reduce((s, d) => s + d, 0) / b.durations.length).toFixed(1)
        : 0;
      return {
        counter_id: cid,
        counter_name: counterMap.get(cid) ?? 'Unknown Counter',
        outlet_name: b.outlet_name,
        completed_tickets: b.durations.length,
        avg_fulfilment_min: avg,
        min_fulfilment_min: b.durations.length > 0 ? +Math.min(...b.durations).toFixed(1) : 0,
        max_fulfilment_min: b.durations.length > 0 ? +Math.max(...b.durations).toFixed(1) : 0,
      };
    })
    .sort((a, b) => a.avg_fulfilment_min - b.avg_fulfilment_min);

  const allDurations = rows.flatMap(r => Array(r.completed_tickets).fill(r.avg_fulfilment_min));
  const overallAvg = allDurations.length > 0
    ? +(allDurations.reduce((s, d) => s + d, 0) / allDurations.length).toFixed(1)
    : 0;

  const paginated = rows.slice((q.page - 1) * q.page_size, q.page * q.page_size);
  return {
    rows: paginated,
    total: rows.length,
    summary: {
      counters_measured: rows.length,
      total_completed: rows.reduce((s, r) => s + r.completed_tickets, 0),
      overall_avg_min: overallAvg,
      fastest_counter: rows[0]?.counter_name ?? '—',
    },
  };
}

// ---------------------------------------------------------------------------
// POS INVENTORY POOL REPORTS — pos_outlet_inventory, stock_movements
// ---------------------------------------------------------------------------

// 24. POS Pool Stock Levels
// ---------------------------------------------------------------------------
export interface PosPoolStockRow {
  variant_id: string;
  product_name: string;
  variant_name: string;
  sku: string;
  outlet_id: string;
  outlet_name: string;
  qty: number;
  stock_status: 'ok' | 'low' | 'zero' | 'negative';
}

export async function getPosPoolStockLevels(q: ReportQuery, companyId: string) {
  let query = db()
    .from('pos_outlet_inventory')
    .select(`
      variant_id, warehouse_id, qty,
      warehouses:warehouse_id(name),
      product_variants:variant_id(id, name, sku, product_id, products:product_id(name))
    `)
    .eq('company_id', companyId);

  if (q.branch_ids?.length) query = query.in('warehouse_id', q.branch_ids);
  if (q.search) query = query.ilike('product_variants.sku', `%${q.search}%`);

  const { data, error } = await query;
  if (error) throw toServiceError('POS pool stock query', error);

  let rows: PosPoolStockRow[] = (data ?? []).map((r: any) => {
    const qty = Number(r.qty ?? 0);
    const status: PosPoolStockRow['stock_status'] =
      qty < 0 ? 'negative' : qty === 0 ? 'zero' : qty < 5 ? 'low' : 'ok';
    const variant = r.product_variants as any;
    return {
      variant_id: r.variant_id,
      product_name: variant?.products?.name ?? '—',
      variant_name: variant?.name ?? '—',
      sku: variant?.sku ?? '—',
      outlet_id: r.warehouse_id,
      outlet_name: (r.warehouses as any)?.name ?? '—',
      qty,
      stock_status: status,
    };
  });

  // Filter by search on product/variant name (JS-side since nested ilike is limited)
  if (q.search) {
    const s = q.search.toLowerCase();
    rows = rows.filter(r =>
      r.product_name.toLowerCase().includes(s) ||
      r.variant_name.toLowerCase().includes(s) ||
      r.sku.toLowerCase().includes(s)
    );
  }

  rows.sort((a, b) => a.qty - b.qty); // show lowest stock first

  const summary = {
    total_variants: rows.length,
    zero_stock_items: rows.filter(r => r.qty <= 0).length,
    low_stock_items: rows.filter(r => r.stock_status === 'low').length,
    negative_items: rows.filter(r => r.stock_status === 'negative').length,
  };

  const paginated = rows.slice((q.page - 1) * q.page_size, q.page * q.page_size);
  return { rows: paginated, total: rows.length, summary };
}

// ---------------------------------------------------------------------------
// 25. POS Pool Movement Log
// ---------------------------------------------------------------------------
export interface PosPoolMovementRow {
  movement_id: string;
  movement_date: string;
  movement_type: string;
  product_name: string;
  variant_name: string;
  sku: string;
  outlet_name: string;
  qty_change: number;
  reference_id: string;
  notes: string;
}

export async function getPosPoolMovements(q: ReportQuery, companyId: string) {
  let query = db()
    .from('stock_movements')
    .select(`
      id, created_at, movement_type, quantity, reference_id, notes,
      outlet_id,
      warehouses:outlet_id(name),
      product_variants:variant_id(id, name, sku, product_id, products:product_id(name))
    `, { count: 'exact' })
    .eq('company_id', companyId)
    .in('movement_type', ['POS_SALE', 'POS_TRANSFER_IN', 'POS_ADJUSTMENT'])
    .gte('created_at', q.from_date)
    .lte('created_at', q.to_date + 'T23:59:59Z');

  if (q.branch_ids?.length) query = query.in('outlet_id', q.branch_ids);

  query = query
    .order('created_at', { ascending: false })
    .range((q.page - 1) * q.page_size, q.page * q.page_size - 1);

  const { data, count, error } = await query;
  if (error) throw toServiceError('POS pool movements query', error);

  const rows: PosPoolMovementRow[] = (data ?? []).map((m: any) => {
    const v = m.product_variants as any;
    return {
      movement_id: m.id,
      movement_date: m.created_at ?? '',
      movement_type: m.movement_type,
      product_name: v?.products?.name ?? '—',
      variant_name: v?.name ?? '—',
      sku: v?.sku ?? '—',
      outlet_name: (m.warehouses as any)?.name ?? '—',
      qty_change: Number(m.quantity),
      reference_id: m.reference_id ?? '—',
      notes: m.notes ?? '',
    };
  });

  // Summary agg (all, ignoring page)
  const { data: aggData } = await db()
    .from('stock_movements')
    .select('movement_type, quantity')
    .eq('company_id', companyId)
    .in('movement_type', ['POS_SALE', 'POS_TRANSFER_IN', 'POS_ADJUSTMENT'])
    .gte('created_at', q.from_date)
    .lte('created_at', q.to_date + 'T23:59:59Z');

  const totalSold = (aggData ?? [])
    .filter((m: any) => m.movement_type === 'POS_SALE')
    .reduce((s: number, m: any) => s + Math.abs(Number(m.quantity)), 0);
  const totalTransferred = (aggData ?? [])
    .filter((m: any) => m.movement_type === 'POS_TRANSFER_IN')
    .reduce((s: number, m: any) => s + Number(m.quantity), 0);

  return {
    rows,
    total: count ?? 0,
    summary: {
      total_movements: count ?? 0,
      total_qty_sold: totalSold,
      total_qty_transferred_in: totalTransferred,
    },
  };
}

// ---------------------------------------------------------------------------
// MENU PERFORMANCE REPORT — pos_menu_items, order_items
// ---------------------------------------------------------------------------

// 26. Menu Item Performance
// ---------------------------------------------------------------------------
export interface MenuItemPerformanceRow {
  menu_id: string;
  menu_name: string;
  product_id: string;
  variant_id: string;
  product_name: string;
  variant_name: string;
  sku: string;
  is_visible: boolean;
  pos_price: number;
  times_ordered: number;
  total_qty: number;
  total_revenue: number;
  performance_tag: 'star' | 'hidden_gem' | 'ghost' | 'invisible';
}

export async function getMenuItemPerformance(q: ReportQuery, companyId: string) {
  // Fetch all menu items with product info
  const { data: menuItems, error: me } = await db()
    .from('pos_menu_items')
    .select(`
      id, menu_id, variant_id, product_id, is_visible, pos_price,
      pos_menus:menu_id(id, name),
      product_variants:variant_id(id, name, sku, products:product_id(name))
    `)
    .eq('company_id', companyId);

  if (me) throw toServiceError('Menu items query', me);

  // Fetch order items for these variants in date range
  const variantIds = [...new Set((menuItems ?? []).map((mi: any) => mi.variant_id as string))];
  const orderRows: any[] = [];

  if (variantIds.length > 0) {
    const { data: oi } = await db()
      .from('order_items')
      .select('variant_id, quantity, unit_price, order_id, order:order_id!inner(company_id, created_at, order_source, order_type, status)')
      .eq('order.company_id', companyId)
      .eq('order.order_source', 'pos')
      .eq('order.order_type', 'sales')
      .neq('order.status', 'cancelled')
      .in('variant_id', variantIds)
      .gte('order.created_at', q.from_date)
      .lte('order.created_at', q.to_date + 'T23:59:59Z');
    if (oi) orderRows.push(...oi);
  }

  // Aggregate by variant
  const salesBuckets = new Map<string, { qty: number; revenue: number; orders: Set<string> }>();
  orderRows.forEach((oi: any) => {
    const vid = oi.variant_id;
    if (!salesBuckets.has(vid)) salesBuckets.set(vid, { qty: 0, revenue: 0, orders: new Set() });
    const b = salesBuckets.get(vid)!;
    b.qty += Number(oi.quantity);
    b.revenue += Number(oi.unit_price) * Number(oi.quantity);
    b.orders.add(oi.order_id);
  });

  const rows: MenuItemPerformanceRow[] = (menuItems ?? []).map((mi: any) => {
    const variant = mi.product_variants as any;
    const menu = mi.pos_menus as any;
    const sales = salesBuckets.get(mi.variant_id) ?? { qty: 0, revenue: 0, orders: new Set() };
    const timesOrdered = sales.orders.size;
    const isVisible = mi.is_visible;

    // Tag: star=visible+ordered, hidden_gem=hidden+ordered, ghost=visible+never, invisible=hidden+never
    const tag: MenuItemPerformanceRow['performance_tag'] =
      isVisible && timesOrdered > 0 ? 'star'
        : !isVisible && timesOrdered > 0 ? 'hidden_gem'
          : isVisible && timesOrdered === 0 ? 'ghost'
            : 'invisible';

    return {
      menu_id: mi.menu_id,
      menu_name: menu?.name ?? '—',
      product_id: mi.product_id,
      variant_id: mi.variant_id,
      product_name: variant?.products?.name ?? '—',
      variant_name: variant?.name ?? '—',
      sku: variant?.sku ?? '—',
      is_visible: isVisible,
      pos_price: Number(mi.pos_price ?? 0),
      times_ordered: timesOrdered,
      total_qty: sales.qty,
      total_revenue: sales.revenue,
      performance_tag: tag,
    };
  }).sort((a, b) => b.total_qty - a.total_qty);

  const filtered = q.search
    ? rows.filter(r =>
        r.product_name.toLowerCase().includes(q.search!.toLowerCase()) ||
        r.sku.toLowerCase().includes(q.search!.toLowerCase())
      )
    : rows;

  const paginated = filtered.slice((q.page - 1) * q.page_size, q.page * q.page_size);
  return {
    rows: paginated,
    total: filtered.length,
    summary: {
      total_menu_items: filtered.length,
      star_items: filtered.filter(r => r.performance_tag === 'star').length,
      ghost_items: filtered.filter(r => r.performance_tag === 'ghost').length,
      hidden_gem_items: filtered.filter(r => r.performance_tag === 'hidden_gem').length,
      total_menu_revenue: filtered.reduce((s, r) => s + r.total_revenue, 0),
    },
  };
}
