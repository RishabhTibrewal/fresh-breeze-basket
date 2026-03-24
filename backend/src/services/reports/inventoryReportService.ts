/**
 * inventoryReportService.ts
 * Supabase query implementations for Inventory Report endpoints.
 */

import { supabaseAdmin, supabase } from '../../config/supabase';
import type { ReportQuery } from '../../middleware/reportValidator';

const db = () => supabaseAdmin ?? supabase;

// ---------------------------------------------------------------------------
// 1. Stock Ledger — all movements for a period
// ---------------------------------------------------------------------------
export interface StockLedgerRow {
  [key: string]: unknown;
  movement_id: string;
  movement_date: string;
  product_name: string;
  variant_name: string;
  sku: string;
  warehouse: string;
  movement_type: string;
  reference_type: string;
  quantity: number;
  running_total?: number;
}

export async function getStockLedger(q: ReportQuery, companyId: string) {
  let query = db()
    .from('stock_movements')
    .select(`
      id, created_at, movement_type, reference_type, quantity, outlet_id, notes, source_type,
      products:product_id(id, name),
      product_variants:variant_id(id, name, sku),
      warehouses:outlet_id(id, name)
    `, { count: 'exact' })
    .eq('company_id', companyId)
    .gte('created_at', q.from_date)
    .lte('created_at', q.to_date + 'T23:59:59Z');

  if (q.branch_ids?.length) {
    query = query.in('outlet_id', q.branch_ids as string[]);
  }
  if (q.search) {
    // search not natively supported for joins easily; applied in JS below
  }

  query = query.order('created_at', { ascending: q.sort_dir === 'asc' });
  query = query.range((q.page - 1) * q.page_size, q.page * q.page_size - 1);

  const { data, count, error } = await query;
  if (error) throw error;

  let rows: StockLedgerRow[] = (data ?? []).map((m: any) => ({
    movement_id: m.id,
    movement_date: m.created_at?.split('T')[0] ?? '',
    product_name: m.products?.name ?? '—',
    variant_name: m.product_variants?.name ?? '—',
    sku: m.product_variants?.sku ?? '—',
    warehouse: m.warehouses?.name ?? '—',
    movement_type: m.movement_type,
    reference_type: m.reference_type ?? '—',
    quantity: Number(m.quantity),
    notes: m.notes ?? '',
  }));

  if (q.search) {
    const s = q.search.toLowerCase();
    rows = rows.filter(r =>
      r.product_name.toLowerCase().includes(s) ||
      String(r.sku).toLowerCase().includes(s)
    );
  }

  const totalIn  = rows.filter(r => r.quantity > 0).reduce((s, r) => s + r.quantity, 0);
  const totalOut = rows.filter(r => r.quantity < 0).reduce((s, r) => s + Math.abs(r.quantity), 0);

  return {
    rows,
    total: count ?? 0,
    summary: {
      total_in: totalIn,
      total_out: totalOut,
      net_movement: totalIn - totalOut,
    } as Record<string, string | number>,
  };
}

// ---------------------------------------------------------------------------
// 2. Current Stock Position
// ---------------------------------------------------------------------------
export interface CurrentStockRow {
  [key: string]: unknown;
  product_id: string;
  variant_id: string;
  product_name: string;
  variant_name: string;
  sku: string;
  warehouse: string;
  warehouse_id: string;
  stock_count: number;
  reserved_stock: number;
  available_stock: number;
}

export async function getCurrentStock(q: ReportQuery, companyId: string) {
  let query = db()
    .from('warehouse_inventory')
    .select(`
      id, stock_count, reserved_stock, warehouse_id, product_id, variant_id,
      warehouses:warehouse_id(id, name),
      products:product_id(id, name),
      product_variants:variant_id(id, name, sku)
    `, { count: 'exact' })
    .eq('company_id', companyId);

  if (q.branch_ids?.length) {
    query = query.in('warehouse_id', q.branch_ids as string[]);
  }

  query = query.order('stock_count', { ascending: false });
  query = query.range((q.page - 1) * q.page_size, q.page * q.page_size - 1);

  const { data, count, error } = await query;
  if (error) throw error;

  let rows: CurrentStockRow[] = (data ?? []).map((wi: any) => ({
    product_id: wi.product_id ?? '',
    variant_id: wi.variant_id ?? '',
    product_name: wi.products?.name ?? '—',
    variant_name: wi.product_variants?.name ?? '—',
    sku: wi.product_variants?.sku ?? '—',
    warehouse: wi.warehouses?.name ?? '—',
    warehouse_id: wi.warehouse_id ?? '',
    stock_count: Number(wi.stock_count ?? 0),
    reserved_stock: Number(wi.reserved_stock ?? 0),
    available_stock: Number(wi.stock_count ?? 0) - Number(wi.reserved_stock ?? 0),
  }));

  if (q.search) {
    const s = q.search.toLowerCase();
    rows = rows.filter(r =>
      r.product_name.toLowerCase().includes(s) ||
      String(r.sku).toLowerCase().includes(s)
    );
  }

  const totalItems = rows.reduce((s, r) => s + r.stock_count, 0);
  const outOfStock = rows.filter(r => r.available_stock <= 0).length;
  const lowStock   = rows.filter(r => r.available_stock > 0 && r.available_stock <= 10).length;

  return {
    rows,
    total: count ?? 0,
    summary: {
      total_skus: count ?? 0,
      total_units: totalItems,
      out_of_stock_skus: outOfStock,
      low_stock_skus: lowStock,
    } as Record<string, string | number>,
  };
}

// ---------------------------------------------------------------------------
// 3. Repack Summary
// ---------------------------------------------------------------------------
export interface RepackSummaryRow {
  [key: string]: unknown;
  repack_order_id: string;
  order_date: string;
  warehouse: string;
  status: string;
  input_product: string;
  input_qty: number;
  output_product: string;
  output_qty: number;
  wastage_qty: number;
  wastage_pct: number;
  unit_cost: number;
  total_cost: number;
}

export async function getRepackSummary(q: ReportQuery, companyId: string) {
  let query = db()
    .from('repack_orders')
    .select(`
      id, created_at, status, warehouse_id,
      warehouses:warehouse_id(name),
      repack_order_inputs(
        input_quantity, wastage_quantity, variant_id,
        product:products(name)
      ),
      repack_order_outputs(
        output_quantity, unit_cost, additional_cost_per_unit,
        product:products(name)
      )
    `, { count: 'exact' })
    .eq('company_id', companyId)
    .gte('created_at', q.from_date)
    .lte('created_at', q.to_date + 'T23:59:59Z');

  if (q.branch_ids?.length) {
    query = query.in('warehouse_id', q.branch_ids as string[]);
  }

  query = query.order('created_at', { ascending: q.sort_dir === 'asc' });
  query = query.range((q.page - 1) * q.page_size, q.page * q.page_size - 1);

  const { data, count, error } = await query;
  if (error) throw error;

  const rows: RepackSummaryRow[] = (data ?? []).map((ro: any) => {
    const inputs = ro.repack_order_inputs ?? [];
    const outputs = ro.repack_order_outputs ?? [];
    
    const inputQty = inputs.reduce((s: number, i: any) => s + Number(i.input_quantity || 0), 0);
    const wastageQty = inputs.reduce((s: number, i: any) => s + Number(i.wastage_quantity || 0), 0);
    
    const outputQty = outputs.reduce((s: number, o: any) => s + Number(o.output_quantity || 0), 0);
    
    const totalCost = outputs.reduce((s: number, o: any) => {
       const qty = Number(o.output_quantity || 0);
       const cost = Number(o.unit_cost || 0);
       const addCost = Number(o.additional_cost_per_unit || 0);
       return s + (qty * (cost + addCost));
    }, 0);

    const unitCost = outputQty > 0 ? totalCost / outputQty : 0;

    const inputProducts = inputs.map((i: any) => i.product?.name || '—').join(', ');
    const outputProducts = outputs.map((o: any) => o.product?.name || '—').join(', ');

    return {
      repack_order_id: ro.id,
      order_date: ro.created_at?.split('T')[0] ?? '',
      warehouse: ro.warehouses?.name ?? '—',
      status: ro.status,
      input_product: inputProducts || '—',
      input_qty: inputQty,
      output_product: outputProducts || '—',
      output_qty: outputQty,
      wastage_qty: wastageQty,
      wastage_pct: inputQty > 0 ? (wastageQty / inputQty) * 100 : 0,
      unit_cost: unitCost,
      total_cost: totalCost,
    };
  });

  const totalWastage  = rows.reduce((s, r) => s + r.wastage_qty, 0);
  const totalInput    = rows.reduce((s, r) => s + r.input_qty, 0);
  const totalCost     = rows.reduce((s, r) => s + r.total_cost, 0);

  return {
    rows,
    total: count ?? 0,
    summary: {
      total_repack_orders: count ?? 0,
      total_input_qty: totalInput,
      total_wastage_qty: totalWastage,
      avg_wastage_pct: totalInput > 0 ? (totalWastage / totalInput) * 100 : 0,
      total_cost: totalCost,
    } as Record<string, string | number>,
  };
}

// ---------------------------------------------------------------------------
// 4. Wastage Report
// ---------------------------------------------------------------------------
export interface WastageRow {
  [key: string]: unknown;
  repack_order_id: string;
  order_date: string;
  warehouse: string;
  input_product: string;
  input_qty: number;
  wastage_qty: number;
  wastage_pct: number;
  wastage_cost: number;
  status: string;
}

export async function getWastageReport(q: ReportQuery, companyId: string) {
  const { data, count, error } = await db()
    .from('repack_orders')
    .select(`
      id, created_at, status, warehouse_id,
      warehouses:warehouse_id(name),
      repack_order_inputs(
        input_quantity, wastage_quantity, variant_id,
        product:products(name)
      )
    `, { count: 'exact' })
    .eq('company_id', companyId)
    .gte('created_at', q.from_date)
    .lte('created_at', q.to_date + 'T23:59:59Z')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const variantIds = [...new Set((data ?? []).flatMap((ro: any) => 
    (ro.repack_order_inputs ?? [])
      .filter((item: any) => Number(item.wastage_quantity ?? 0) > 0)
      .map((item: any) => item.variant_id)
  ))];

  let pricesMap: Record<string, number> = {};
  if (variantIds.length > 0) {
    const { data: prices } = await db()
      .from('product_prices')
      .select('variant_id, sale_price')
      .eq('company_id', companyId)
      .eq('price_type', 'standard')
      .is('outlet_id', null)
      .in('variant_id', variantIds);
    (prices ?? []).forEach(p => {
      if (p.variant_id) pricesMap[p.variant_id] = Number(p.sale_price || 0);
    });
  }

  const rows: WastageRow[] = (data ?? []).flatMap((ro: any) =>
    (ro.repack_order_inputs ?? [])
      .filter((item: any) => Number(item.wastage_quantity ?? 0) > 0)
      .map((item: any) => {
        const inputQty   = Number(item.input_quantity ?? 0);
        const wastageQty = Number(item.wastage_quantity ?? 0);
        const unitCost   = pricesMap[item.variant_id] || 0;
        return {
          repack_order_id: ro.id,
          order_date: ro.created_at?.split('T')[0] ?? '',
          warehouse: ro.warehouses?.name ?? '—',
          input_product: item.product?.name ?? '—',
          input_qty: inputQty,
          wastage_qty: wastageQty,
          wastage_pct: inputQty > 0 ? (wastageQty / inputQty) * 100 : 0,
          wastage_cost: wastageQty * unitCost,
          status: ro.status,
        };
      })
  );

  const paginated = rows.slice((q.page - 1) * q.page_size, q.page * q.page_size);

  return {
    rows: paginated,
    total: rows.length,
    summary: {
      total_wastage_qty: rows.reduce((s, r) => s + r.wastage_qty, 0),
      total_wastage_cost: rows.reduce((s, r) => s + r.wastage_cost, 0),
      avg_wastage_pct: rows.length > 0
        ? rows.reduce((s, r) => s + r.wastage_pct, 0) / rows.length
        : 0,
    } as Record<string, string | number>,
  };
}

// ---------------------------------------------------------------------------
// 5. Inventory Dashboard KPIs
// ---------------------------------------------------------------------------
export interface InventoryDashboardKpis {
  total_skus: number;
  total_stock_units: number;
  out_of_stock: number;
  low_stock: number;
  total_repack_orders: number;
  total_wastage_this_period: number;
}

export async function getInventoryDashboardKpis(q: ReportQuery, companyId: string): Promise<InventoryDashboardKpis> {
  const [invRes, repackRes] = await Promise.all([
    db().from('warehouse_inventory').select('stock_count, reserved_stock').eq('company_id', companyId),
    db().from('repack_orders')
      .select('repack_order_inputs(wastage_quantity)')
      .eq('company_id', companyId)
      .gte('created_at', q.from_date)
      .lte('created_at', q.to_date + 'T23:59:59Z'),
  ]);

  const inv = invRes.data ?? [];
  const totalSkus = inv.length;
  const totalUnits = inv.reduce((s: number, r: any) => s + Number(r.stock_count ?? 0), 0);
  const available = inv.map((r: any) => Number(r.stock_count ?? 0) - Number(r.reserved_stock ?? 0));
  const outOfStock = available.filter((a: number) => a <= 0).length;
  const lowStock   = available.filter((a: number) => a > 0 && a <= 10).length;

  const repacks = repackRes.data ?? [];
  const totalWastage = repacks.reduce((s: number, ro: any) =>
    s + (ro.repack_order_inputs ?? []).reduce((ss: number, i: any) => ss + Number(i.wastage_quantity ?? 0), 0), 0
  );

  return {
    total_skus: totalSkus,
    total_stock_units: totalUnits,
    out_of_stock: outOfStock,
    low_stock: lowStock,
    total_repack_orders: repacks.length,
    total_wastage_this_period: totalWastage,
  };
}
