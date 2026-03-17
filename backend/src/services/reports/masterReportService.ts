/**
 * masterReportService.ts
 * Master List reports — products, customers, suppliers, users/roles.
 * No new schema needed; reads from existing public tables.
 */

import { supabaseAdmin, supabase } from '../../config/supabase';
import type { ReportQuery } from '../../middleware/reportValidator';

const db = () => supabaseAdmin ?? supabase;

// ---------------------------------------------------------------------------
// 1. Product Master List
// ---------------------------------------------------------------------------
export interface ProductMasterRow {
  [key: string]: unknown;
  product_id: string;
  product_code: string;
  name: string;
  unit_type: string;
  price: number;
  sale_price: number;
  tax_pct: number;
  is_active: string;
  created_at: string;
}

export async function getProductMaster(q: ReportQuery, companyId: string) {
  const client = db();

  let query = client
    .from('products')
    .select(`id, product_code, name, unit_type, price, sale_price, tax, is_active, created_at`, { count: 'exact' })
    .eq('company_id', companyId);

  if (q.search) {
    query = query.or(`name.ilike.%${q.search}%,product_code.ilike.%${q.search}%`);
  }
  query = query.order('name', { ascending: q.sort_dir === 'asc' });
  query = query.range((q.page - 1) * q.page_size, q.page * q.page_size - 1);

  const { data, count, error } = await query;
  if (error) throw error;

  const rows: ProductMasterRow[] = (data ?? []).map((p: any) => ({
    product_id:   p.id,
    product_code: p.product_code ?? '—',
    name:         p.name,
    unit_type:    p.unit_type ?? '—',
    price:        Number(p.price ?? 0),
    sale_price:   Number(p.sale_price ?? 0),
    tax_pct:      Number(p.tax ?? 0),
    is_active:    p.is_active ? 'Active' : 'Inactive',
    created_at:   p.created_at?.split('T')[0] ?? '',
  }));

  return {
    rows,
    total: count ?? 0,
    summary: {
      total_products: count ?? 0,
      active_products: rows.filter(r => r.is_active === 'Active').length,
    } as Record<string, string | number>,
  };
}

// ---------------------------------------------------------------------------
// 2. Customer Master List
// ---------------------------------------------------------------------------
export interface CustomerMasterRow {
  [key: string]: unknown;
  customer_id: string;
  name: string;
  email: string;
  phone: string;
  trn_number: string;
  credit_limit: number;
  current_credit: number;
  credit_period_days: number;
  created_at: string;
}

export async function getCustomerMaster(q: ReportQuery, companyId: string) {
  const client = db();

  let query = client
    .from('customers')
    .select(`id, name, email, phone, trn_number, credit_limit, current_credit, credit_period_days, created_at`, { count: 'exact' })
    .eq('company_id', companyId);

  if (q.search) {
    query = query.or(`name.ilike.%${q.search}%,email.ilike.%${q.search}%,phone.ilike.%${q.search}%`);
  }
  query = query.order('name', { ascending: q.sort_dir === 'asc' });
  query = query.range((q.page - 1) * q.page_size, q.page * q.page_size - 1);

  const { data, count, error } = await query;
  if (error) throw error;

  const rows: CustomerMasterRow[] = (data ?? []).map((c: any) => ({
    customer_id:       c.id,
    name:              c.name,
    email:             c.email ?? '—',
    phone:             c.phone ?? '—',
    trn_number:        c.trn_number ?? '—',
    credit_limit:      Number(c.credit_limit ?? 0),
    current_credit:    Number(c.current_credit ?? 0),
    credit_period_days: Number(c.credit_period_days ?? 0),
    created_at:        c.created_at?.split('T')[0] ?? '',
  }));

  return {
    rows,
    total: count ?? 0,
    summary: {
      total_customers:    count ?? 0,
      total_credit_limit: rows.reduce((s, r) => s + r.credit_limit, 0),
      total_outstanding:  rows.reduce((s, r) => s + r.current_credit, 0),
    } as Record<string, string | number>,
  };
}

// ---------------------------------------------------------------------------
// 3. Supplier Master List
// ---------------------------------------------------------------------------
export interface SupplierMasterRow {
  [key: string]: unknown;
  supplier_id: string;
  supplier_code: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  gst_no: string;
  opening_balance: number;
  closing_balance: number;
  is_active: string;
}

export async function getSupplierMaster(q: ReportQuery, companyId: string) {
  const client = db();

  let query = client
    .from('suppliers')
    .select(`id, supplier_code, name, email, phone, city, country, gst_no, opening_balance, closing_balance, is_active`, { count: 'exact' })
    .eq('company_id', companyId);

  if (q.search) {
    query = query.or(`name.ilike.%${q.search}%,email.ilike.%${q.search}%,supplier_code.ilike.%${q.search}%`);
  }
  query = query.order('name', { ascending: q.sort_dir === 'asc' });
  query = query.range((q.page - 1) * q.page_size, q.page * q.page_size - 1);

  const { data, count, error } = await query;
  if (error) throw error;

  const rows: SupplierMasterRow[] = (data ?? []).map((s: any) => ({
    supplier_id:     s.id,
    supplier_code:   s.supplier_code ?? '—',
    name:            s.name,
    email:           s.email ?? '—',
    phone:           s.phone ?? '—',
    city:            s.city ?? '—',
    country:         s.country ?? '—',
    gst_no:          s.gst_no ?? '—',
    opening_balance: Number(s.opening_balance ?? 0),
    closing_balance: Number(s.closing_balance ?? 0),
    is_active:       s.is_active ? 'Active' : 'Inactive',
  }));

  return {
    rows,
    total: count ?? 0,
    summary: {
      total_suppliers: count ?? 0,
      active_suppliers: rows.filter(r => r.is_active === 'Active').length,
    } as Record<string, string | number>,
  };
}

// ---------------------------------------------------------------------------
// 4. User & Role Master List
// ---------------------------------------------------------------------------
export interface UserMasterRow {
  [key: string]: unknown;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  role_name: string;
  role_display: string;
  created_at: string;
}

export async function getUserMaster(q: ReportQuery, companyId: string) {
  const client = db();

  // Get profiles for this company
  let profQuery = client
    .from('profiles')
    .select(`id, first_name, last_name, email, phone, created_at`, { count: 'exact' })
    .eq('company_id', companyId);

  if (q.search) {
    profQuery = profQuery.or(`first_name.ilike.%${q.search}%,last_name.ilike.%${q.search}%,email.ilike.%${q.search}%`);
  }
  profQuery = profQuery.order('created_at', { ascending: q.sort_dir === 'asc' });
  profQuery = profQuery.range((q.page - 1) * q.page_size, q.page * q.page_size - 1);

  const { data: profiles, count, error } = await profQuery;
  if (error) throw error;

  // Fetch user_roles + role names for these users
  const userIds = (profiles ?? []).map((p: any) => p.id);
  const roleMap = new Map<string, { name: string; display_name: string }>();

  if (userIds.length) {
    const { data: userRoles } = await client
      .from('user_roles')
      .select(`user_id, role_id`)
      .in('user_id', userIds)
      .eq('company_id', companyId)
      .eq('is_primary', true);

    const roleIds = [...new Set((userRoles ?? []).map((ur: any) => ur.role_id).filter(Boolean))];
    if (roleIds.length) {
      const { data: roles } = await client.from('roles').select('id, name, display_name').in('id', roleIds);
      const rMap = new Map((roles ?? []).map((r: any) => [r.id, { name: r.name, display_name: r.display_name ?? r.name }]));
      for (const ur of userRoles ?? []) {
        const role = rMap.get(ur.role_id);
        if (role) roleMap.set(ur.user_id, role);
      }
    }
  }

  const rows: UserMasterRow[] = (profiles ?? []).map((p: any) => {
    const role = roleMap.get(p.id);
    return {
      user_id:      p.id,
      full_name:    `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || '—',
      email:        p.email ?? '—',
      phone:        p.phone ?? '—',
      role_name:    role?.name ?? '—',
      role_display: role?.display_name ?? '—',
      created_at:   p.created_at?.split('T')[0] ?? '',
    };
  });

  return {
    rows,
    total: count ?? 0,
    summary: {
      total_users: count ?? 0,
    } as Record<string, string | number>,
  };
}

// ---------------------------------------------------------------------------
// 5. Activity Summary (lightweight audit from order_status_history)
// ---------------------------------------------------------------------------
export interface ActivityRow {
  [key: string]: unknown;
  changed_at: string;
  order_id: string;
  from_status: string;
  to_status: string;
  changed_by: string;
}

export async function getActivitySummary(q: ReportQuery, companyId: string) {
  const client = db();

  let query = client
    .from('order_status_history')
    .select(`id, order_id, from_status, to_status, changed_by, created_at`, { count: 'exact' })
    .eq('company_id', companyId)
    .gte('created_at', q.from_date)
    .lte('created_at', q.to_date + 'T23:59:59Z');

  query = query.order('created_at', { ascending: q.sort_dir === 'asc' });
  query = query.range((q.page - 1) * q.page_size, q.page * q.page_size - 1);

  const { data, count, error } = await query;
  if (error) {
    // table may not exist — return empty
    return { rows: [], total: 0, summary: {} as Record<string, string | number> };
  }

  // Enrich changed_by with profile name
  const userIds = [...new Set((data ?? []).map((h: any) => h.changed_by).filter(Boolean))];
  const profileMap = new Map<string, string>();
  if (userIds.length) {
    const { data: profiles } = await client.from('profiles').select('id, first_name, last_name').in('id', userIds);
    profiles?.forEach((p: any) => profileMap.set(p.id, `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.id));
  }

  const rows: ActivityRow[] = (data ?? []).map((h: any) => ({
    changed_at:  h.created_at?.split('T')[0] ?? '',
    order_id:    h.order_id ?? '—',
    from_status: h.from_status ?? '—',
    to_status:   h.to_status ?? '—',
    changed_by:  h.changed_by ? (profileMap.get(h.changed_by) ?? h.changed_by) : '—',
  }));

  return {
    rows,
    total: count ?? 0,
    summary: {
      total_events: count ?? 0,
    } as Record<string, string | number>,
  };
}

// ---------------------------------------------------------------------------
// 6. Dashboard KPIs
// ---------------------------------------------------------------------------
export interface MasterDashboardKpis {
  total_products: number;
  total_customers: number;
  total_suppliers: number;
  total_users: number;
}

export async function getMasterDashboardKpis(companyId: string): Promise<MasterDashboardKpis> {
  const client = db();
  const [prodsRes, custsRes, supsRes, usersRes] = await Promise.all([
    client.from('products').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    client.from('customers').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    client.from('suppliers').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    client.from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
  ]);
  return {
    total_products:  prodsRes.count ?? 0,
    total_customers: custsRes.count ?? 0,
    total_suppliers: supsRes.count ?? 0,
    total_users:     usersRes.count ?? 0,
  };
}
