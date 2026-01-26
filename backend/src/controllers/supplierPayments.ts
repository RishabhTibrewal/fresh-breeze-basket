import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { ApiError, ValidationError } from '../middleware/error';

/**
 * Generate payment number (e.g., PAY-2024-001)
 */
const generatePaymentNumber = async (companyId: string): Promise<string> => {
  const year = new Date().getFullYear();
  
  const { data: latestPayment, error } = await supabase
    .schema('procurement')
    .from('supplier_payments')
    .select('payment_number')
    .eq('company_id', companyId)
    .like('payment_number', `PAY-${year}-%`)
    .order('payment_number', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching latest payment:', error);
  }

  let sequence = 1;
  if (latestPayment && latestPayment.payment_number) {
    const parts = latestPayment.payment_number.split('-');
    if (parts.length === 3) {
      sequence = parseInt(parts[2]) + 1;
    }
  }

  return `PAY-${year}-${sequence.toString().padStart(3, '0')}`;
};

/**
 * Create a new supplier payment
 */
export const createSupplierPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      purchase_invoice_id,
      supplier_id,
      payment_date,
      payment_method,
      amount,
      reference_number,
      bank_name,
      cheque_number,
      transaction_id,
      notes
    } = req.body;

    if (!purchase_invoice_id) {
      throw new ValidationError('Purchase invoice ID is required');
    }

    if (!supplier_id) {
      throw new ValidationError('Supplier ID is required');
    }

    if (!payment_date) {
      throw new ValidationError('Payment date is required');
    }

    if (!payment_method) {
      throw new ValidationError('Payment method is required');
    }

    if (!amount || amount <= 0) {
      throw new ValidationError('Payment amount must be greater than 0');
    }

    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    if (!req.companyId) {
      throw new ValidationError('Company context is required');
    }

    // Verify invoice exists and get supplier_id if not provided
    const { data: invoice, error: invoiceError } = await supabase
      .schema('procurement')
      .from('purchase_invoices')
      .select('*')
      .eq('id', purchase_invoice_id)
      .eq('company_id', req.companyId)
      .single();

    if (invoiceError || !invoice) {
      console.error('Error fetching invoice:', invoiceError);
      throw new ApiError(404, 'Purchase invoice not found');
    }

    // Fetch purchase order to get supplier_id if not provided
    let finalSupplierId = supplier_id;
    if (!finalSupplierId && invoice.purchase_order_id) {
      const { data: purchaseOrder, error: poError } = await supabase
        .schema('procurement')
        .from('purchase_orders')
        .select('supplier_id')
        .eq('id', invoice.purchase_order_id)
        .eq('company_id', req.companyId)
        .single();
      
      if (!poError && purchaseOrder) {
        finalSupplierId = purchaseOrder.supplier_id;
      }
    }
    if (!finalSupplierId) {
      throw new ValidationError('Supplier ID is required');
    }

    // Generate payment number
    const payment_number = await generatePaymentNumber(req.companyId);

    // Create supplier payment
    const { data: payment, error: paymentError } = await supabase
      .schema('procurement')
      .from('supplier_payments')
      .insert({
        purchase_invoice_id,
        supplier_id: finalSupplierId,
        payment_number,
        payment_date,
        payment_method,
        amount,
        reference_number,
        bank_name,
        cheque_number,
        transaction_id,
        notes,
        status: 'pending',
        created_by: userId,
        company_id: req.companyId
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Error creating supplier payment:', paymentError);
      throw new ApiError(500, `Failed to create supplier payment: ${paymentError.message}`);
    }

    // Update invoice paid amount and status
    // Only count completed payments towards paid_amount
    const { data: invoiceData } = await supabase
      .schema('procurement')
      .from('purchase_invoices')
      .select('paid_amount, total_amount, status')
      .eq('id', purchase_invoice_id)
      .eq('company_id', req.companyId)
      .single();

    if (invoiceData) {
      // Get all completed payments for this invoice
      const { data: completedPayments } = await supabase
        .schema('procurement')
        .from('supplier_payments')
        .select('amount')
        .eq('purchase_invoice_id', purchase_invoice_id)
        .eq('status', 'completed')
        .eq('company_id', req.companyId);

      const newPaidAmount = completedPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
      let newStatus = invoiceData.status || 'pending';
      
      // Don't change status if invoice is cancelled
      if (invoiceData.status !== 'cancelled') {
        if (newPaidAmount >= invoiceData.total_amount) {
          newStatus = 'paid';
        } else if (newPaidAmount > 0) {
          newStatus = 'partial';
        } else {
          newStatus = 'pending';
        }
      }

      await supabase
        .schema('procurement')
        .from('purchase_invoices')
        .update({
          paid_amount: newPaidAmount,
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', purchase_invoice_id)
        .eq('company_id', req.companyId);
    }

    // Fetch complete payment with relations separately
    const [relatedInvoiceResult, supplierResult] = await Promise.all([
      payment.purchase_invoice_id
        ? supabase.schema('procurement').from('purchase_invoices').select('*').eq('id', payment.purchase_invoice_id).eq('company_id', req.companyId).single()
        : Promise.resolve({ data: null, error: null }),
      payment.supplier_id
        ? supabase.from('suppliers').select('*').eq('id', payment.supplier_id).eq('company_id', req.companyId).single()
        : Promise.resolve({ data: null, error: null })
    ]);

    const relatedInvoice = relatedInvoiceResult.error ? null : relatedInvoiceResult.data;
    const supplier = supplierResult.error ? null : supplierResult.data;

    const completePayment = {
      ...payment,
      purchase_invoices: relatedInvoice,
      suppliers: supplier
    };

    res.status(201).json({
      success: true,
      data: completePayment
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all supplier payments with optional filters
 */
export const getSupplierPayments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { supplier_id, status, date_from, date_to, payment_method } = req.query;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    let query = supabase
      .schema('procurement')
      .from('supplier_payments')
      .select('*')
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false });

    if (supplier_id) {
      query = query.eq('supplier_id', supplier_id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (payment_method) {
      query = query.eq('payment_method', payment_method);
    }

    if (date_from) {
      query = query.gte('payment_date', date_from);
    }

    if (date_to) {
      query = query.lte('payment_date', date_to);
    }

    const { data: payments, error } = await query;

    if (error) {
      console.error('Error fetching supplier payments:', error);
      throw new ApiError(500, 'Failed to fetch supplier payments');
    }

    // Fetch related purchase invoices and suppliers separately
    const invoiceIds = [...new Set((payments || []).map((p: any) => p.purchase_invoice_id).filter(Boolean))];
    const supplierIds = [...new Set((payments || []).map((p: any) => p.supplier_id).filter(Boolean))];

    const invoicesMap = new Map();
    const suppliersMap = new Map();

    if (invoiceIds.length > 0) {
      const { data: invoices, error: invoicesError } = await supabase
        .schema('procurement')
        .from('purchase_invoices')
        .select('*')
        .in('id', invoiceIds)
        .eq('company_id', req.companyId);
      
      if (invoicesError) {
        console.error('Error fetching purchase invoices:', invoicesError);
        // Continue without invoices if there's an error
      } else {
        invoices?.forEach((inv: any) => {
          invoicesMap.set(inv.id, inv);
        });
      }
    }

    if (supplierIds.length > 0) {
      const { data: suppliers, error: suppliersError } = await supabase
        .from('suppliers')
        .select('*')
        .in('id', supplierIds)
        .eq('company_id', req.companyId);
      
      if (suppliersError) {
        console.error('Error fetching suppliers:', suppliersError);
        // Continue without suppliers if there's an error
      } else {
        suppliers?.forEach((supplier: any) => {
          suppliersMap.set(supplier.id, supplier);
        });
      }
    }

    // Enrich payments with related data
    const enrichedPayments = (payments || []).map((payment: any) => ({
      ...payment,
      purchase_invoices: payment.purchase_invoice_id ? invoicesMap.get(payment.purchase_invoice_id) : null,
      suppliers: payment.supplier_id ? suppliersMap.get(payment.supplier_id) : null
    }));

    res.json({
      success: true,
      data: enrichedPayments
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get supplier payment by ID
 */
export const getSupplierPaymentById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const { data: payment, error } = await supabase
      .schema('procurement')
      .from('supplier_payments')
      .select('*')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new ApiError(404, 'Supplier payment not found');
      }
      console.error('Error fetching supplier payment:', error);
      throw new ApiError(500, 'Failed to fetch supplier payment');
    }

    // Fetch related purchase invoice and supplier separately
    const [invoiceResult, supplierResult] = await Promise.all([
      payment.purchase_invoice_id
        ? supabase.schema('procurement').from('purchase_invoices').select('*').eq('id', payment.purchase_invoice_id).eq('company_id', req.companyId).single()
        : Promise.resolve({ data: null, error: null }),
      payment.supplier_id
        ? supabase.from('suppliers').select('*').eq('id', payment.supplier_id).eq('company_id', req.companyId).single()
        : Promise.resolve({ data: null, error: null })
    ]);

    const invoice = invoiceResult.error ? null : invoiceResult.data;
    const supplier = supplierResult.error ? null : supplierResult.data;

    res.json({
      success: true,
      data: {
        ...payment,
        purchase_invoices: invoice,
        suppliers: supplier
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update supplier payment
 */
export const updateSupplierPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      payment_date,
      payment_method,
      amount,
      reference_number,
      bank_name,
      cheque_number,
      transaction_id,
      notes,
      status
    } = req.body;

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (payment_date !== undefined) updateData.payment_date = payment_date;
    if (payment_method !== undefined) updateData.payment_method = payment_method;
    if (amount !== undefined) updateData.amount = amount;
    if (reference_number !== undefined) updateData.reference_number = reference_number;
    if (bank_name !== undefined) updateData.bank_name = bank_name;
    if (cheque_number !== undefined) updateData.cheque_number = cheque_number;
    if (transaction_id !== undefined) updateData.transaction_id = transaction_id;
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) updateData.status = status;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const { data: payment, error: updateError } = await supabase
      .schema('procurement')
      .from('supplier_payments')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', req.companyId)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        throw new ApiError(404, 'Supplier payment not found');
      }
      console.error('Error updating supplier payment:', updateError);
      throw new ApiError(500, 'Failed to update supplier payment');
    }

    // Update invoice paid amount if amount or status changed
    if ((amount !== undefined || status !== undefined) && payment.purchase_invoice_id) {
      const { data: payments } = await supabase
        .schema('procurement')
        .from('supplier_payments')
        .select('amount, status')
        .eq('purchase_invoice_id', payment.purchase_invoice_id)
        .eq('company_id', req.companyId);

      if (payments) {
        // Only count completed payments towards paid_amount
        const totalPaid = payments
          .filter((p) => p.status === 'completed')
          .reduce((sum, p) => sum + (p.amount || 0), 0);
        
        const { data: invoiceData } = await supabase
          .schema('procurement')
          .from('purchase_invoices')
          .select('total_amount, status')
          .eq('id', payment.purchase_invoice_id)
          .eq('company_id', req.companyId)
          .single();

        if (invoiceData) {
          let newStatus = invoiceData.status || 'pending';
          
          // Don't change status to 'paid' if invoice is cancelled
          if (invoiceData.status !== 'cancelled') {
            if (totalPaid >= invoiceData.total_amount) {
              newStatus = 'paid';
            } else if (totalPaid > 0) {
              newStatus = 'partial';
            } else {
              newStatus = 'pending';
            }
          }

          await supabase
            .schema('procurement')
            .from('purchase_invoices')
            .update({
              paid_amount: totalPaid,
              status: newStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', payment.purchase_invoice_id)
            .eq('company_id', req.companyId);
        }
      }
    }

    // Fetch related purchase invoice and supplier separately
    const [invoiceResult, supplierResult] = await Promise.all([
      payment.purchase_invoice_id
        ? supabase.schema('procurement').from('purchase_invoices').select('*').eq('id', payment.purchase_invoice_id).eq('company_id', req.companyId).single()
        : Promise.resolve({ data: null, error: null }),
      payment.supplier_id
        ? supabase.from('suppliers').select('*').eq('id', payment.supplier_id).eq('company_id', req.companyId).single()
        : Promise.resolve({ data: null, error: null })
    ]);

    const invoice = invoiceResult.error ? null : invoiceResult.data;
    const supplier = supplierResult.error ? null : supplierResult.data;

    const completePayment = {
      ...payment,
      purchase_invoices: invoice,
      suppliers: supplier
    };

    res.json({
      success: true,
      data: completePayment
    });
  } catch (error) {
    next(error);
  }
};
