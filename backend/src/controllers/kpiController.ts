import { Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';

// Use service role client to bypass RLS — security is enforced by
// the protect middleware (JWT) and company_id filters in every query.
const db = supabaseAdmin || supabase;

export const getModuleKPIs = async (req: Request, res: Response) => {
  const { moduleKey } = req.params;
  const companyId = req.companyId || req.user?.company_id;

  if (!companyId) {
    return res.status(400).json({ success: false, message: 'Company ID is required' });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  try {
    let kpiData: Record<string, number | null> = {};

    switch (moduleKey) {
      case 'sales':
        // Today's orders count (only sales orders)
        const { count: ordersToday } = await db
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('order_type', 'sales')
          .gte('created_at', todayISO);

        // Outstanding invoices (only sales orders)
        const { count: outstandingInvoices } = await db
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('order_type', 'sales')
          .in('status', ['pending', 'processing']);

        // Monthly revenue (only sales orders)
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const { data: revenueData } = await db
          .from('orders')
          .select('total_amount')
          .eq('company_id', companyId)
          .eq('order_type', 'sales')
          .gte('created_at', monthStart.toISOString());

        const monthlyRevenue = revenueData?.reduce((sum, o) => sum + (parseFloat(o.total_amount?.toString() || '0') || 0), 0) || 0;

        kpiData = {
          orders_today: ordersToday || 0,
          outstanding_invoices: outstandingInvoices || 0,
          monthly_revenue: monthlyRevenue
        };
        break;

      case 'inventory':
        // Total products
        const { count: totalProducts } = await db
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId);

        // Low stock items (from warehouse_inventory)
        const { count: lowStock } = await db
          .from('warehouse_inventory')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .lt('stock_count', 10);

        // Stock value (simplified calculation)
        const { data: stockData } = await db
          .from('products')
          .select('price')
          .eq('company_id', companyId);

        const stockValue = stockData?.reduce((sum, p) => sum + (parseFloat(p.price?.toString() || '0') || 0), 0) || 0;

        kpiData = {
          total_products: totalProducts || 0,
          low_stock: lowStock || 0,
          stock_value: stockValue
        };
        break;

      case 'procurement':
        // Open purchase orders
        const { count: openPOs } = await db
          .from('purchase_orders')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .in('status', ['pending', 'approved', 'partially_received']);

        // Pending GRNs
        const { count: pendingGRNs } = await db
          .from('goods_receipts')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('status', 'pending');

        // Supplier outstanding (simplified - sum of unpaid purchase invoices)
        const { data: supplierOutstandingData } = await db
          .from('purchase_invoices')
          .select('total_amount, status')
          .eq('company_id', companyId)
          .in('status', ['pending', 'partial']);

        const supplierOutstanding = supplierOutstandingData?.reduce(
          (sum, inv) => sum + (parseFloat(inv.total_amount?.toString() || '0') || 0),
          0
        ) || 0;

        kpiData = {
          open_pos: openPOs || 0,
          pending_grns: pendingGRNs || 0,
          supplier_outstanding: supplierOutstanding
        };
        break;

      case 'accounting':
        // Receivables (from customer sales orders)
        const { data: receivablesData } = await db
          .from('orders')
          .select('total_amount, status, order_type')
          .eq('company_id', companyId)
          .eq('order_type', 'sales')
          .in('status', ['pending', 'processing']);

        const receivables = receivablesData?.reduce(
          (sum, o) => sum + (parseFloat(o.total_amount?.toString() || '0') || 0),
          0
        ) || 0;

        // Payables (from purchase invoices)
        const { data: payablesData } = await db
          .from('purchase_invoices')
          .select('total_amount, status')
          .eq('company_id', companyId)
          .in('status', ['pending', 'partial']);

        const payables = payablesData?.reduce(
          (sum, inv) => sum + (parseFloat(inv.total_amount?.toString() || '0') || 0),
          0
        ) || 0;

        // Cash balance (placeholder - would need proper accounting entries)
        kpiData = {
          receivables: receivables,
          payables: payables,
          cash_balance: 0 // Placeholder
        };
        break;

      case 'reports':
        // Placeholder KPIs for reports module
        kpiData = {
          sales_report: 0,
          inventory_valuation: 0
        };
        break;

      case 'pos':
        // Today's POS sales (sales orders with POS source)
        const { data: posSalesData } = await db
          .from('orders')
          .select('total_amount, order_type, order_source')
          .eq('company_id', companyId)
          .eq('order_type', 'sales')
          .eq('order_source', 'pos')
          .gte('created_at', todayISO);

        const posSalesToday = posSalesData?.reduce(
          (sum, o) => sum + (parseFloat(o.total_amount?.toString() || '0') || 0),
          0
        ) || 0;

        const posTransactions = posSalesData?.length || 0;
        const posAvgTicket = posTransactions > 0 ? posSalesToday / posTransactions : 0;

        kpiData = {
          pos_sales_today: posSalesToday,
          pos_transactions: posTransactions,
          pos_avg_ticket: posAvgTicket
        };
        break;

      case 'ecommerce':
        // Online (ecommerce) sales orders today
        const { count: ecommerceOrdersToday } = await db
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('order_type', 'sales')
          .eq('order_source', 'ecommerce')
          .gte('created_at', todayISO);

        // Placeholder KPIs
        kpiData = {
          orders_today: ecommerceOrdersToday || 0,
          visitors: 0, // Would need analytics integration
          conversion_rate: 0 // Would need analytics integration
        };
        break;

      default:
        kpiData = {};
    }

    res.json({ success: true, data: kpiData });
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch KPIs' });
  }
};
