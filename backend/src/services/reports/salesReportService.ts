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
  const { data: items, error } = await db()
    .from('order_items')
    .select(`
      product_id, variant_id, quantity, unit_price, tax_amount,
      order:order_id!inner(company_id, order_type, status, created_at, outlet_id),
      products:product_id(id, name),
      product_variants:variant_id(id, name, sku)
    `)
    .eq('order.company_id', companyId)
    .eq('order.order_type', 'sales')
    .neq('order.status', 'cancelled')
    .gte('order.created_at', q.from_date)
    .lte('order.created_at', q.to_date + 'T23:59:59Z');

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
  total_amount: number;
  payment_status: string;
}

export async function getSalesReturns(q: ReportQuery, companyId: string) {
  const { data, count, error } = await db()
    .from('orders')
    .select(`
      id, created_at, total_amount, payment_status, original_order_id,
      customers:user_id(first_name, last_name, email)
    `, { count: 'exact' })
    .eq('company_id', companyId)
    .eq('order_type', 'return')
    .gte('created_at', q.from_date)
    .lte('created_at', q.to_date + 'T23:59:59Z')
    .order('created_at', { ascending: false })
    .range((q.page - 1) * q.page_size, q.page * q.page_size - 1);

  if (error) throw toServiceError('Sales returns query', error);

  const rows: SalesReturnRow[] = (data ?? []).map((o: any) => {
    const c = o.customers;
    return {
      order_id: o.id,
      original_order_id: o.original_order_id ?? '—',
      return_date: o.created_at?.split('T')[0] ?? '',
      customer_name: c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || c.email : 'N/A',
      total_amount: Number(o.total_amount),
      payment_status: o.payment_status ?? '—',
    };
  });

  return {
    rows,
    total: count ?? 0,
    summary: {
      total_returns: count ?? 0,
      total_return_value: rows.reduce((s, r) => s + r.total_amount, 0),
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
    top_product: '—',   // computed separately in Phase 2 if needed
    top_customer: '—',
  };
}
