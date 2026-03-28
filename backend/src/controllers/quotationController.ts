import { Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
import { AppError } from '../utils/appError';
import { calculateOrderTotals, ExtraCharge } from '../lib/orderCalculations';

// Get all quotations for the company
export const getQuotations = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new AppError('Company context is required', 400);
    }
    
    const { status, search } = req.query;

    let query = (supabaseAdmin || supabase)
      .from('quotations')
      .select('*, leads(contact_name, company_name), customer:customers(name, email)')
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false });

    if (status && typeof status === 'string') {
      query = query.eq('status', status);
    }

    if (search && typeof search === 'string') {
      const searchTerm = `%${search}%`;
      query = query.or(`quotation_number.ilike.${searchTerm}`);
    }

    const { data: quotations, error } = await query;

    if (error) {
      throw new AppError(`Error fetching quotations: ${error.message}`, 500);
    }

    const enrichedQuotations = await Promise.all((quotations || []).map(async (q) => {
      if (q.sales_executive_id) {
        const { data: profile } = await (supabaseAdmin || supabase)
          .from('profiles')
          .select('id, user_id, first_name, last_name, email')
          .eq('id', q.sales_executive_id)
          .single();
        return { ...q, sales_executive: profile || null };
      }
      return { ...q, sales_executive: null };
    }));

    return res.status(200).json({
      success: true,
      data: enrichedQuotations
    });
  } catch (error) {
    console.error('Error in getQuotations:', error);
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get a single quotation by ID
export const getQuotationById = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new AppError('Company context is required', 400);
    }
    
    const { id } = req.params;

    const { data: quotation, error } = await (supabaseAdmin || supabase)
      .from('quotations')
      .select(`
        *,
        leads(contact_name, company_name),
        quotation_items (
          *,
          product:products(name),
          variant:product_variants(name)
        )
      `)
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') throw new AppError('Quotation not found', 404);
      throw new AppError(`Error fetching quotation: ${error.message}`, 500);
    }

    return res.status(200).json({
      success: true,
      data: quotation
    });
  } catch (error) {
    console.error('Error in getQuotationById:', error);
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Create a new quotation
export const createQuotation = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new AppError('Company context is required', 400);
    }
    
    const {
      lead_id, customer_id, sales_executive_id,
      valid_until, notes, terms_and_conditions,
      extra_discount_amount,  // ← renamed from extra_discount
      extra_discount_percentage,
      items
    } = req.body;

    if (!items || !items.length) {
      throw new AppError('At least one item is required for a quotation', 400);
    }

    const extraCharges: ExtraCharge[] = Array.isArray(req.body.extra_charges) ? req.body.extra_charges : [];

    // ─── Per-line calculations for input to generic math ───────────────────────────────────────────────
    const calcInputItems = items.map((item: any, idx: number) => {
      const qty          = Number(item.quantity)         || 0;
      const unitPrice    = Number(item.unit_price)       || 0;
      const taxPct       = Number(item.tax_percentage)   || 0;
      const discPct      = Number(item.discount_percentage) || 0;

      const lineSubtotal  = qty * unitPrice;
      const discAmt       = parseFloat(((lineSubtotal * discPct) / 100).toFixed(2));

      return {
        id: idx.toString(),
        unit_price: unitPrice,
        quantity: qty,
        tax_percentage: taxPct,
        discount_amount: discAmt,
      };
    });

    const sumLineTotals = calcInputItems.reduce((acc: number, i: any) => acc + (i.unit_price * i.quantity), 0);
    const extraDiscPct = Number(extra_discount_percentage) || 0;
    const finalExtraDiscAmt = (extraDiscPct > 0)
      ? parseFloat(((sumLineTotals * extraDiscPct) / 100).toFixed(2))
      : Number(extra_discount_amount || 0);

    const totals = calculateOrderTotals(
      calcInputItems,
      finalExtraDiscAmt,
      0, // CD disabled for quotes
      'credit_note', // CD not applicable
      extraCharges
    );

    const itemInserts = items.map((item: any, idx: number) => {
      const qty          = Number(item.quantity)         || 0;
      const unitPrice    = Number(item.unit_price)       || 0;
      const taxPct       = Number(item.tax_percentage)   || 0;
      const discPct      = Number(item.discount_percentage) || 0;
      
      const calcItem = totals.items.find(i => i.id === idx.toString());

      return {
        company_id:           req.companyId,
        product_id:           item.product_id,
        variant_id:           item.variant_id || null,
        quantity:             qty,
        unit_price:           unitPrice,
        tax_percentage:       taxPct,
        discount_percentage:  discPct,
        tax_amount:           calcItem?.tax_amount || 0,
        discount_amount:      parseFloat((qty * unitPrice * discPct / 100).toFixed(2)),
        line_total:           calcItem?.line_total || 0,
        notes:                item.notes || null,
      };
    });

    // ─── Insert quotation header ─────────────────────────────────────────────
    const { data: quotation, error: qError } = await (supabaseAdmin || supabase)
      .from('quotations')
      .insert({
        company_id:               req.companyId,
        lead_id:                  lead_id || null,
        customer_id:              customer_id || null,
        sales_executive_id:       sales_executive_id || req.user?.id,
        status:                   'draft',
        notes:                    notes || null,
        terms_and_conditions:     terms_and_conditions || null,
        valid_until:              valid_until || null,
        subtotal:                 totals.subtotal,
        total_tax:                totals.total_tax,
        total_discount:           totals.total_discount,
        extra_discount_percentage: extraDiscPct,
        extra_discount_amount:    totals.extra_discount_amount,
        taxable_value:            totals.taxable_value,
        extra_charges:            extraCharges,
        total_extra_charges:      totals.total_extra_charges,
        round_off_amount:         totals.round_off_amount,
        total_amount:             totals.total_amount,
        created_by:               req.user?.id
      })
      .select()
      .single();

    if (qError || !quotation) {
      throw new AppError(`Error creating quotation: ${qError?.message}`, 500);
    }

    // ─── Insert items ────────────────────────────────────────────────────────
    const itemsWithQuotationId = itemInserts.map((i: any) => ({ ...i, quotation_id: quotation.id }));
    const { error: itemsError } = await (supabaseAdmin || supabase)
      .from('quotation_items')
      .insert(itemsWithQuotationId);

    if (itemsError) {
      await (supabaseAdmin || supabase).from('quotations').delete().eq('id', quotation.id);
      throw new AppError(`Error adding quotation items: ${itemsError.message}`, 500);
    }

    return res.status(201).json({
      success: true,
      data: quotation
    });
  } catch (error) {
    console.error('Error in createQuotation:', error);
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Accept quotation (via RPC — kept for backward compat, but UI should redirect to CreateOrder)
export const acceptQuotation = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new AppError('Company context is required', 400);
    }
    
    const { id } = req.params;

    const { data: orderId, error } = await (supabaseAdmin || supabase)
      .rpc('accept_quotation', { p_quotation_id: id });

    if (error) {
      throw new AppError(`Error accepting quotation: ${error.message}`, 500);
    }

    return res.status(200).json({
      success: true,
      message: 'Quotation accepted and order created successfully',
      data: { order_id: orderId }
    });
  } catch (error) {
    console.error('Error in acceptQuotation:', error);
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Mark quotation as rejected or sent
export const updateQuotationStatus = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new AppError('Company context is required', 400);
    }
    
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['draft', 'sent', 'rejected', 'expired'].includes(status)) {
        throw new AppError('Invalid status', 400);
    }

    const { data: quotation, error } = await (supabaseAdmin || supabase)
      .from('quotations')
      .update({ status })
      .eq('id', id)
      .eq('company_id', req.companyId)
      .select()
      .single();

    if (error) throw new AppError(`Error updating quotation status: ${error.message}`, 500);

    return res.status(200).json({
      success: true,
      data: quotation
    });
  } catch (error) {
    console.error('Error in updateQuotationStatus:', error);
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
