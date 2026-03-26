import { Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
import { AppError } from '../utils/appError';

const adminClient = () => supabaseAdmin || supabase;

// List all credit notes for the company
export const listCreditNotes = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) throw new AppError('Company context is required', 400);

    const { data, error } = await adminClient()
      .from('credit_notes')
      .select(`
        *,
        order:orders(id, total_amount),
        customer:customers(id, name, phone)
      `)
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error listing credit notes:', error);
      throw new AppError(error.message, 500);
    }

    // Add order_number fallback to matching orders
    const transformed = (data || []).map(cn => ({
      ...cn,
      order: cn.order ? {
        ...cn.order,
        order_number: (cn.order as any).order_number || `ORD-${cn.order.id.substring(0, 8)}`
      } : null
    }));

    res.json({ success: true, data: transformed });
  } catch (err: any) {
    console.error('Failed to fetch credit notes:', err);
    if (err instanceof AppError) throw err;
    throw new AppError(err.message || 'Failed to fetch credit notes', 500);
  }
};

// Create a credit note for an order (cd_settlement_mode = 'credit_note')
export const createCreditNote = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) throw new AppError('Company context is required', 400);
    const { order_id } = req.body;

    if (!order_id) throw new AppError('order_id is required', 400);

    // 1. Fetch order — verify cd_settlement_mode
    const { data: order, error: orderError } = await adminClient()
      .from('orders')
      .select('id, company_id, user_id, cd_settlement_mode, cd_enabled, cd_percentage, cd_amount, cd_valid_until')
      .eq('id', order_id)
      .eq('company_id', req.companyId)
      .single();

    if (orderError || !order) throw new AppError('Order not found', 404);

    if (!order.cd_enabled) throw new AppError('Cash discount is not enabled on this order', 400);
    if (order.cd_settlement_mode !== 'credit_note') {
      throw new AppError('This order uses direct CD settlement — no credit note required', 400);
    }

    // 2. Verify no existing active CN for this order
    const { data: existingCNs } = await adminClient()
      .from('credit_notes')
      .select('id, status')
      .eq('order_id', order_id)
      .eq('company_id', req.companyId)
      .eq('reason', 'cash_discount')
      .neq('status', 'cancelled');

    if (existingCNs && existingCNs.length > 0) {
      throw new AppError('An active credit note already exists for this order', 409);
    }

    // 3. Get customer_id from customers table (via order user_id)
    let customerId: string | null = null;
    if (order.user_id) {
      const { data: cust } = await adminClient()
        .from('customers')
        .select('id')
        .eq('user_id', order.user_id)
        .eq('company_id', req.companyId)
        .maybeSingle();
      customerId = cust?.id || null;
    }

    // 4. Generate CN number
    const today = new Date();
    const year = today.getFullYear();
    const { data: lastCN } = await adminClient()
      .from('credit_notes')
      .select('cn_number')
      .eq('company_id', req.companyId)
      .ilike('cn_number', `CN-${year}-%`)
      .order('cn_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    let seq = 1;
    if (lastCN?.cn_number) {
      const parts = (lastCN.cn_number as string).split('-');
      const parsed = parseInt(parts[2], 10);
      if (!isNaN(parsed)) seq = parsed + 1;
    }
    const cnNumber = `CN-${year}-${seq.toString().padStart(4, '0')}`;

    // 5. Insert credit note
    const { data: cn, error: cnError } = await adminClient()
      .from('credit_notes')
      .insert({
        company_id: req.companyId,
        order_id: order.id,
        customer_id: customerId,
        cn_number: cnNumber,
        cn_date: today.toISOString().split('T')[0],
        reason: 'cash_discount',
        cd_percentage: order.cd_percentage || 0,
        amount: order.cd_amount || 0,
        tax_amount: 0,
        total_amount: order.cd_amount || 0,
        status: 'draft',
        created_by: req.user?.id || null,
      })
      .select()
      .single();

    if (cnError) throw new AppError(`Failed to create credit note: ${cnError.message}`, 500);

    res.status(201).json({ success: true, data: cn });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('Failed to create credit note', 500);
  }
};

// Create a manual credit note
export const createManualCreditNote = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) throw new AppError('Company context is required', 400);
    const { customer_id, reason, amount, tax_amount, total_amount, notes, order_id } = req.body;

    if (!customer_id || !amount || !total_amount || !reason) {
      throw new AppError('Missing required fields: customer_id, reason, amount, total_amount', 400);
    }

    // 1. Verify customer belongs to same company
    const { data: customer, error: customerErr } = await adminClient()
      .from('customers')
      .select('id')
      .eq('id', customer_id)
      .eq('company_id', req.companyId)
      .single();

    if (customerErr || !customer) throw new AppError('Customer not found for this company', 404);

    // 2. Generate CN number (reuse pattern or specific for manual?)
    const today = new Date();
    const year = today.getFullYear();
    const { data: lastCN } = await adminClient()
      .from('credit_notes')
      .select('cn_number')
      .eq('company_id', req.companyId)
      .ilike('cn_number', `CN-${year}-%`)
      .order('cn_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    let seq = 1;
    if (lastCN?.cn_number) {
      const parts = (lastCN.cn_number as string).split('-');
      const parsed = parseInt(parts[2], 10);
      if (!isNaN(parsed)) seq = parsed + 1;
    }
    const cnNumber = `CN-${year}-${seq.toString().padStart(4, '0')}`;

    // 3. Insert credit note
    const { data: cn, error: cnError } = await adminClient()
      .from('credit_notes')
      .insert({
        company_id: req.companyId,
        order_id: order_id || null, // Optional for manual CN
        customer_id: customer_id,
        cn_number: cnNumber,
        cn_date: today.toISOString().split('T')[0],
        reason: reason,
        amount: amount,
        tax_amount: tax_amount || 0,
        total_amount: total_amount,
        status: 'draft',
        notes: notes || null,
        created_by: req.user?.id || null,
      })
      .select()
      .single();

    if (cnError) throw new AppError(`Failed to create credit note: ${cnError.message}`, 500);

    res.status(201).json({ success: true, data: cn });
  } catch (err) {
    if (err instanceof AppError) throw err;
    console.error('Manual CN creation error:', err);
    throw new AppError('Failed to create manual credit note', 500);
  }
};

// Update credit note status: draft → issued → applied | any → cancelled
export const updateCreditNoteStatus = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) throw new AppError('Company context is required', 400);
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ['draft', 'issued', 'applied', 'cancelled'];
    if (!allowed.includes(status)) {
      throw new AppError(`Invalid status. Must be one of: ${allowed.join(', ')}`, 400);
    }

    const { data, error } = await adminClient()
      .from('credit_notes')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', req.companyId)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    if (!data) throw new AppError('Credit note not found', 404);

    res.json({ success: true, data });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('Failed to update credit note status', 500);
  }
};

// Check whether an active CN exists for an order
export const getOrderCreditNote = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) throw new AppError('Company context is required', 400);
    const { order_id } = req.params;

    const { data, error } = await adminClient()
      .from('credit_notes')
      .select('*')
      .eq('order_id', order_id)
      .eq('company_id', req.companyId)
      .eq('reason', 'cash_discount')
      .neq('status', 'cancelled')
      .maybeSingle();

    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data: data || null });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('Failed to fetch credit note for order', 500);
  }
};
