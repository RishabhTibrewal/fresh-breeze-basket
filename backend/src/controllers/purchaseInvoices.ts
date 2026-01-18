import { Request, Response, NextFunction } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
import { ApiError, ValidationError } from '../middleware/error';

/**
 * Generate invoice number (e.g., INV-2024-001)
 */
const generateInvoiceNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  
  const adminClient = supabaseAdmin || supabase;
  const { data: latestInvoice, error } = await adminClient
    .schema('procurement')
    .from('purchase_invoices')
    .select('invoice_number')
    .ilike('invoice_number', `INV-${year}-%`)
    .order('invoice_number', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching latest invoice:', error);
  }

  let sequence = 1;
  if (latestInvoice && latestInvoice.invoice_number) {
    const parts = latestInvoice.invoice_number.split('-');
    if (parts.length === 3) {
      sequence = parseInt(parts[2]) + 1;
    }
  }

  return `INV-${year}-${sequence.toString().padStart(3, '0')}`;
};

/**
 * Create a new purchase invoice from goods receipt
 */
export const createPurchaseInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      goods_receipt_id,
      purchase_order_id,
      supplier_invoice_number,
      invoice_date,
      due_date,
      subtotal,
      tax_amount,
      discount_amount,
      total_amount,
      notes
    } = req.body;

    if (!goods_receipt_id) {
      throw new ValidationError('Goods receipt ID is required');
    }

    if (!invoice_date) {
      throw new ValidationError('Invoice date is required');
    }

    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    // Verify goods receipt exists
    const adminClient = supabaseAdmin || supabase;
    const { data: goodsReceipt, error: grnError } = await adminClient
      .schema('procurement')
      .from('goods_receipts')
      .select('*')
      .eq('id', goods_receipt_id)
      .single();

    if (grnError || !goodsReceipt) {
      throw new ApiError(404, 'Goods receipt not found');
    }

    // Generate invoice number
    const invoice_number = await generateInvoiceNumber();

    // Calculate amounts if not provided
    const calculatedSubtotal = subtotal || goodsReceipt.total_received_amount || 0;
    const calculatedTax = tax_amount || 0;
    const calculatedDiscount = discount_amount || 0;
    const calculatedTotal = calculatedSubtotal + calculatedTax - calculatedDiscount;

    // Create purchase invoice
    const { data: purchaseInvoice, error: invoiceError } = await adminClient
      .schema('procurement')
      .from('purchase_invoices')
      .insert({
        purchase_order_id: purchase_order_id || goodsReceipt.purchase_order_id,
        goods_receipt_id,
        invoice_number,
        supplier_invoice_number,
        invoice_date,
        due_date,
        subtotal: calculatedSubtotal,
        tax_amount: calculatedTax,
        discount_amount: calculatedDiscount,
        total_amount: calculatedTotal,
        paid_amount: 0,
        status: 'pending',
        notes,
        created_by: userId
      })
      .select()
      .single();

    if (invoiceError) {
      console.error('Error creating purchase invoice:', invoiceError);
      throw new ApiError(500, `Failed to create purchase invoice: ${invoiceError.message}`);
    }

    // Return the created invoice (relations can be fetched via getPurchaseInvoiceById if needed)
    res.status(201).json({
      success: true,
      data: purchaseInvoice
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all purchase invoices with optional filters
 */
export const getPurchaseInvoices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, supplier_id, purchase_order_id, date_from, date_to } = req.query;

    const adminClient = supabaseAdmin || supabase;
    let query = adminClient
      .schema('procurement')
      .from('purchase_invoices')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (purchase_order_id) {
      query = query.eq('purchase_order_id', purchase_order_id);
    }

    if (date_from) {
      query = query.gte('invoice_date', date_from);
    }

    if (date_to) {
      query = query.lte('invoice_date', date_to);
    }

    const { data: invoices, error } = await query;

    if (error) {
      console.error('Error fetching purchase invoices:', error);
      throw new ApiError(500, 'Failed to fetch purchase invoices');
    }

    // Fetch related purchase orders and goods receipts separately
    const purchaseOrderIds = [...new Set(invoices?.map((inv: any) => inv.purchase_order_id).filter(Boolean) || [])];
    const goodsReceiptIds = [...new Set(invoices?.map((inv: any) => inv.goods_receipt_id).filter(Boolean) || [])];

    const purchaseOrdersMap = new Map();
    const goodsReceiptsMap = new Map();
    const suppliersMap = new Map();

    if (purchaseOrderIds.length > 0) {
      const { data: purchaseOrders } = await adminClient
        .schema('procurement')
        .from('purchase_orders')
        .select('*')
        .in('id', purchaseOrderIds);
      
      purchaseOrders?.forEach((po: any) => {
        purchaseOrdersMap.set(po.id, po);
        if (po.supplier_id) {
          suppliersMap.set(po.supplier_id, po.supplier_id); // Store ID for later fetch
        }
      });
    }

    if (goodsReceiptIds.length > 0) {
      const { data: goodsReceipts } = await adminClient
        .schema('procurement')
        .from('goods_receipts')
        .select('*')
        .in('id', goodsReceiptIds);
      
      goodsReceipts?.forEach((gr: any) => {
        goodsReceiptsMap.set(gr.id, gr);
      });
    }

    // Fetch suppliers if needed
    const supplierIds = [...suppliersMap.keys()];
    if (supplierIds.length > 0) {
      const { data: suppliers } = await adminClient
        .from('suppliers')
        .select('*')
        .in('id', supplierIds);
      
      suppliers?.forEach((supplier: any) => {
        suppliersMap.set(supplier.id, supplier);
      });
    }

    // Join the data
    let enrichedInvoices = (invoices || []).map((inv: any) => {
      const po = inv.purchase_order_id ? purchaseOrdersMap.get(inv.purchase_order_id) : null;
      const supplier = po?.supplier_id ? suppliersMap.get(po.supplier_id) : null;
      return {
        ...inv,
        purchase_orders: po ? { ...po, suppliers: supplier } : null,
        goods_receipts: inv.goods_receipt_id ? goodsReceiptsMap.get(inv.goods_receipt_id) : null
      };
    });

    // Filter by supplier_id if provided
    if (supplier_id) {
      enrichedInvoices = enrichedInvoices.filter((invoice: any) => 
        invoice.purchase_orders?.supplier_id === supplier_id
      );
    }

    res.json({
      success: true,
      data: enrichedInvoices
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get purchase invoice by ID
 */
export const getPurchaseInvoiceById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const adminClient = supabaseAdmin || supabase;
    
    // Fetch purchase invoice from procurement schema
    const { data: purchaseInvoice, error } = await adminClient
      .schema('procurement')
      .from('purchase_invoices')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new ApiError(404, 'Purchase invoice not found');
      }
      console.error('Error fetching purchase invoice:', error);
      throw new ApiError(500, 'Failed to fetch purchase invoice');
    }

    // Fetch related purchase order, goods receipt, and supplier payments separately
    const [purchaseOrderResult, goodsReceiptResult, paymentsResult] = await Promise.all([
      purchaseInvoice.purchase_order_id 
        ? adminClient.schema('procurement').from('purchase_orders').select('*').eq('id', purchaseInvoice.purchase_order_id).single()
        : Promise.resolve({ data: null, error: null }),
      purchaseInvoice.goods_receipt_id
        ? adminClient.schema('procurement').from('goods_receipts').select('*').eq('id', purchaseInvoice.goods_receipt_id).single()
        : Promise.resolve({ data: null, error: null }),
      adminClient.schema('procurement').from('supplier_payments').select('*').eq('purchase_invoice_id', id)
    ]);

    const purchaseOrder = purchaseOrderResult.error ? null : purchaseOrderResult.data;
    const goodsReceipt = goodsReceiptResult.error ? null : goodsReceiptResult.data;
    const payments = paymentsResult.error ? [] : (paymentsResult.data || []);

    // Fetch supplier if purchase order exists
    let supplier = null;
    if (purchaseOrder?.supplier_id) {
      const { data: supplierData } = await adminClient
        .from('suppliers')
        .select('*')
        .eq('id', purchaseOrder.supplier_id)
        .single();
      supplier = supplierData || null;
    }

    res.json({
      success: true,
      data: {
        ...purchaseInvoice,
        purchase_orders: purchaseOrder ? { ...purchaseOrder, suppliers: supplier } : null,
        goods_receipts: goodsReceipt,
        supplier_payments: payments
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update purchase invoice
 */
export const updatePurchaseInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      supplier_invoice_number,
      invoice_date,
      due_date,
      subtotal,
      tax_amount,
      discount_amount,
      total_amount,
      notes,
      status
    } = req.body;

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (supplier_invoice_number !== undefined) updateData.supplier_invoice_number = supplier_invoice_number;
    if (invoice_date !== undefined) updateData.invoice_date = invoice_date;
    if (due_date !== undefined) updateData.due_date = due_date;
    if (subtotal !== undefined) updateData.subtotal = subtotal;
    if (tax_amount !== undefined) updateData.tax_amount = tax_amount;
    if (discount_amount !== undefined) updateData.discount_amount = discount_amount;
    if (total_amount !== undefined) updateData.total_amount = total_amount;
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) updateData.status = status;

    const adminClient = supabaseAdmin || supabase;
    const { data: purchaseInvoice, error: updateError } = await adminClient
      .schema('procurement')
      .from('purchase_invoices')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        throw new ApiError(404, 'Purchase invoice not found');
      }
      console.error('Error updating purchase invoice:', updateError);
      throw new ApiError(500, 'Failed to update purchase invoice');
    }

    // Update status based on paid amount
    if (purchaseInvoice.paid_amount >= purchaseInvoice.total_amount) {
      await adminClient
        .schema('procurement')
        .from('purchase_invoices')
        .update({ status: 'paid' })
        .eq('id', id);
    } else if (purchaseInvoice.paid_amount > 0) {
      await adminClient
        .schema('procurement')
        .from('purchase_invoices')
        .update({ status: 'partial' })
        .eq('id', id);
    }

    // Fetch updated invoice with relations (reuse getPurchaseInvoiceById logic)
    const { data: updatedInvoice } = await adminClient
      .schema('procurement')
      .from('purchase_invoices')
      .select('*')
      .eq('id', id)
      .single();

    res.json({
      success: true,
      data: updatedInvoice || purchaseInvoice
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload invoice file
 */
export const uploadInvoiceFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { invoice_file_url } = req.body;

    if (!invoice_file_url) {
      throw new ValidationError('Invoice file URL is required');
    }

    const adminClient = supabaseAdmin || supabase;
    const { data: purchaseInvoice, error } = await adminClient
      .schema('procurement')
      .from('purchase_invoices')
      .update({
        invoice_file_url,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new ApiError(404, 'Purchase invoice not found');
      }
      console.error('Error updating invoice file URL:', error);
      throw new ApiError(500, 'Failed to update invoice file URL');
    }

    res.json({
      success: true,
      message: 'Invoice file uploaded successfully',
      data: purchaseInvoice
    });
  } catch (error) {
    next(error);
  }
};
