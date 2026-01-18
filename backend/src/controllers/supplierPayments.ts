import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { ApiError, ValidationError } from '../middleware/error';

/**
 * Generate payment number (e.g., PAY-2024-001)
 */
const generatePaymentNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  
  const { data: latestPayment, error } = await supabase
    .from('procurement.supplier_payments')
    .select('payment_number')
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

    // Verify invoice exists and get supplier_id if not provided
    const { data: invoice, error: invoiceError } = await supabase
      .from('procurement.purchase_invoices')
      .select('*, procurement.purchase_orders!inner(supplier_id)')
      .eq('id', purchase_invoice_id)
      .single();

    if (invoiceError || !invoice) {
      throw new ApiError(404, 'Purchase invoice not found');
    }

    // Handle purchase_orders - Supabase returns relations, need to type cast
    const invoiceWithRelations = invoice as any;
    const purchaseOrder = Array.isArray(invoiceWithRelations.purchase_orders) 
      ? invoiceWithRelations.purchase_orders[0] 
      : invoiceWithRelations.purchase_orders;
    const finalSupplierId = supplier_id || purchaseOrder?.supplier_id;
    if (!finalSupplierId) {
      throw new ValidationError('Supplier ID is required');
    }

    // Generate payment number
    const payment_number = await generatePaymentNumber();

    // Create supplier payment
    const { data: payment, error: paymentError } = await supabase
      .from('procurement.supplier_payments')
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
        created_by: userId
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Error creating supplier payment:', paymentError);
      throw new ApiError(500, `Failed to create supplier payment: ${paymentError.message}`);
    }

    // Update invoice paid amount and status
    const { data: invoiceData } = await supabase
      .from('procurement.purchase_invoices')
      .select('paid_amount, total_amount')
      .eq('id', purchase_invoice_id)
      .single();

    if (invoiceData) {
      const newPaidAmount = (invoiceData.paid_amount || 0) + amount;
      let newStatus = 'pending';
      
      if (newPaidAmount >= invoiceData.total_amount) {
        newStatus = 'paid';
      } else if (newPaidAmount > 0) {
        newStatus = 'partial';
      }

      await supabase
        .from('procurement.purchase_invoices')
        .update({
          paid_amount: newPaidAmount,
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', purchase_invoice_id);
    }

    // Fetch complete payment with relations
    const { data: completePayment, error: fetchError } = await supabase
      .from('procurement.supplier_payments')
      .select(`
        *,
        procurement.purchase_invoices (*),
        suppliers (*)
      `)
      .eq('id', payment.id)
      .single();

    if (fetchError) {
      console.error('Error fetching supplier payment:', fetchError);
    }

    res.status(201).json({
      success: true,
      data: completePayment || payment
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

    let query = supabase
      .from('procurement.supplier_payments')
      .select(`
        *,
        procurement.purchase_invoices (*),
        suppliers (*)
      `)
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

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching supplier payments:', error);
      throw new ApiError(500, 'Failed to fetch supplier payments');
    }

    res.json({
      success: true,
      data: data || []
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

    const { data: payment, error } = await supabase
      .from('procurement.supplier_payments')
      .select(`
        *,
        procurement.purchase_invoices (*),
        suppliers (*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new ApiError(404, 'Supplier payment not found');
      }
      console.error('Error fetching supplier payment:', error);
      throw new ApiError(500, 'Failed to fetch supplier payment');
    }

    res.json({
      success: true,
      data: payment
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

    const { data: payment, error: updateError } = await supabase
      .from('procurement.supplier_payments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        throw new ApiError(404, 'Supplier payment not found');
      }
      console.error('Error updating supplier payment:', updateError);
      throw new ApiError(500, 'Failed to update supplier payment');
    }

    // If amount changed, update invoice paid amount
    if (amount !== undefined && payment.purchase_invoice_id) {
      const { data: payments } = await supabase
        .from('procurement.supplier_payments')
        .select('amount')
        .eq('purchase_invoice_id', payment.purchase_invoice_id);

      if (payments) {
        const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        
        const { data: invoiceData } = await supabase
          .from('procurement.purchase_invoices')
          .select('total_amount')
          .eq('id', payment.purchase_invoice_id)
          .single();

        if (invoiceData) {
          let newStatus = 'pending';
          if (totalPaid >= invoiceData.total_amount) {
            newStatus = 'paid';
          } else if (totalPaid > 0) {
            newStatus = 'partial';
          }

          await supabase
            .from('procurement.purchase_invoices')
            .update({
              paid_amount: totalPaid,
              status: newStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', payment.purchase_invoice_id);
        }
      }
    }

    const { data: completePayment, error: fetchError } = await supabase
      .from('procurement.supplier_payments')
      .select(`
        *,
        procurement.purchase_invoices (*),
        suppliers (*)
      `)
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching supplier payment:', fetchError);
    }

    res.json({
      success: true,
      data: completePayment || payment
    });
  } catch (error) {
    next(error);
  }
};
