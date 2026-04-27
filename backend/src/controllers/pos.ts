import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { ApiError, ValidationError } from '../middleware/error';
import { OrderService } from '../services/core/OrderService';
import { KotService } from '../services/core/KotService';

async function resolvePosOutletId(
  companyId: string,
  outletIdBody: string | undefined,
  items: Array<{ warehouse_id?: string; outlet_id?: string }>
): Promise<string | null> {
  if (outletIdBody) return outletIdBody;
  const first = items[0];
  const fromLine = first?.warehouse_id || first?.outlet_id;
  if (fromLine) return fromLine;
  const { data } = await supabaseAdmin
    .from('warehouses')
    .select('id')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Create POS order
 * POST /api/pos/orders
 */
export const createPOSOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      items,
      payment_method = 'cash',
      payment_status,
      notes,
      outlet_id,
      // New fields
      fulfillment_type = 'cash_counter',
      order_type_label,
      extra_discount_percentage = 0,
      delivery_address,
      table_number,
      cash_tendered,
      change_given,
      transaction_id,
      split_payments,
      customer_id,
      pos_session_id,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ValidationError('At least one item is required');
    }

    const userId = req.user?.id;
    if (!userId) throw new ValidationError('User ID is required');
    if (!req.companyId) throw new ValidationError('Company context is required');

    const effectiveOutletId = await resolvePosOutletId(req.companyId, outlet_id, items);
    if (!effectiveOutletId) {
      throw new ValidationError('outlet_id is required for POS (select an outlet or configure a default warehouse).');
    }

    // ── PERF: Prefetch KOT settings once; reuse in generateTickets ──────────
    const { data: kotSettings, error: kotSettingsErr } = await supabaseAdmin
      .from('pos_kot_settings')
      .select('id, reset_frequency, timezone, number_prefix, default_counter_id')
      .eq('company_id', req.companyId)
      .eq('outlet_id', effectiveOutletId)
      .maybeSingle();

    if (kotSettingsErr || !kotSettings?.id) {
      throw new ValidationError(
        'Configure KOT settings and default counter for this outlet before taking POS orders (KOT settings in POS).'
      );
    }

    // Build order notes
    let orderNotes = notes || '';
    if (table_number) orderNotes = `Table: ${table_number}${orderNotes ? ' | ' + orderNotes : ''}`;

    // Map fulfillment type (POS uses our custom label internally)
    const mappedFulfillment: 'delivery' | 'pickup' | 'cash_counter' =
      fulfillment_type === 'delivery' ? 'delivery'
      : fulfillment_type === 'pickup' ? 'pickup'
      : 'cash_counter';

    // Auto-generate receipt number: RCP-YYYYMMDD-XXXX
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const receipt_number = `RCP-${dateStr}-${randomSuffix}`;

    const orderService = new OrderService(req.companyId);

    const orderItems = items.map((item: any) => ({
      productId: item.product_id,
      variantId: item.variant_id || null,
      quantity: item.quantity,
      unitPrice: item.price || item.unit_price,
      outletId: item.warehouse_id || item.outlet_id || effectiveOutletId,
      taxPercentage: item.tax_percentage || 0,
    }));

    const result = await orderService.createOrder(
      {
        items: orderItems,
        paymentMethod: payment_method,
        paymentStatus: payment_status
          || (payment_method === 'credit' ? 'full_credit' : 'paid'),
        notes: orderNotes,
        extraDiscountPercentage: parseFloat(extra_discount_percentage) || 0,
      },
      {
        userId: null,
        outletId: effectiveOutletId,
        industryContext: 'retail',
        orderType: 'sales',
        orderSource: 'pos',
        fulfillmentType: mappedFulfillment,
        customerId: customer_id || null,
        status: req.body.status || null,
      }
    );

    const orderId = result.id;

    // Patch order with POS-specific fields
    const patchData: Record<string, any> = {
      receipt_number,
    };
    if (extra_discount_percentage > 0) {
      patchData.extra_discount_percentage = extra_discount_percentage;
    }
    if (delivery_address) {
      patchData.delivery_address = delivery_address;
    }

    if (pos_session_id) {
      patchData.pos_session_id = pos_session_id;
    }

    await supabaseAdmin
      .from('orders')
      .update(patchData)
      .eq('id', orderId);

    // Update payment record with cash_tendered/change_given/transaction_id
    if (cash_tendered || change_given || transaction_id) {
      const paymentPatch: Record<string, any> = {};
      if (cash_tendered != null) paymentPatch.cash_tendered = cash_tendered;
      if (change_given != null) paymentPatch.change_given = change_given;
      if (transaction_id) paymentPatch.transaction_id = transaction_id;

      await supabaseAdmin
        .from('payments')
        .update(paymentPatch)
        .eq('order_id', orderId);
    }

    // Handle split payments: create additional payment records
    if (split_payments && Array.isArray(split_payments) && split_payments.length > 0) {
      const splitRecords = split_payments.map((sp: any) => ({
        order_id: orderId,
        company_id: req.companyId,
        amount: parseFloat(sp.amount) || 0,
        payment_method: sp.method,
        status: 'completed',
        cash_tendered: sp.method === 'cash' ? parseFloat(sp.amount) : null,
      }));
      await supabaseAdmin.from('payments').insert(splitRecords);
    }

    // Save order_item_modifiers
    const itemsWithModifiers = items.filter((item: any) =>
      item.selected_modifiers?.length > 0
    );
    if (itemsWithModifiers.length > 0) {
      // Fetch the created order_items to get their IDs
      const { data: orderItemRows } = await supabaseAdmin
        .from('order_items')
        .select('id, product_id')
        .eq('order_id', orderId);

      if (orderItemRows?.length) {
        const modifierInserts: any[] = [];
        items.forEach((item: any, idx: number) => {
          if (!item.selected_modifiers?.length) return;
          // Match by product_id (best effort)
          const match = orderItemRows.find((r: any) => r.product_id === item.product_id);
          if (!match) return;
          item.selected_modifiers.forEach((mod: any) => {
            modifierInserts.push({
              order_item_id: match.id,
              modifier_id: mod.modifier_id,
              price_adjust: mod.price_adjust || 0,
              company_id: req.companyId,
            });
          });
        });
        if (modifierInserts.length > 0) {
          await supabaseAdmin.from('order_item_modifiers').insert(modifierInserts);
        }
      }
    }

    const { data: orderItemRows, error: oiErr } = await supabaseAdmin
      .from('order_items')
      .select('id, product_id, variant_id, quantity, created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (oiErr || !orderItemRows?.length) {
      throw new ApiError(500, 'Failed to load order lines for KOT');
    }
    if (orderItemRows.length !== items.length) {
      throw new ApiError(500, 'KOT: order line count does not match cart; aborting ticket generation');
    }

    const kotService = new KotService(req.companyId);
    const kotTickets = await kotService.generateTickets({
      orderId,
      outletId: effectiveOutletId,
      requestItems: items,
      orderItemRows: orderItemRows,
      prefetchedSettings: kotSettings, // ─ reuse the already-fetched settings row
    });

    // ── PERF: Skip expensive getOrderById join ─ return lightweight response ──
    res.status(201).json({
      success: true,
      data: {
        id: orderId,
        receipt_number,
        kot_tickets: kotTickets,
      },
      invoice_url: `/api/invoices/pos/${orderId}`
    });
  } catch (error: any) {
    next(error instanceof ApiError || error instanceof ValidationError
      ? error
      : new ApiError(500, error.message || 'Failed to create POS order'));
  }
};

/**
 * Get active POS session for current user
 * GET /api/pos/sessions/active
 */
export const getActiveSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new ValidationError('User ID is required');
    if (!req.companyId) throw new ValidationError('Company context is required');

    const { data: session, error } = await supabaseAdmin
      .from('pos_sessions')
      .select('*')
      .eq('company_id', req.companyId)
      .eq('cashier_id', userId)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new ApiError(500, 'Failed to fetch active session');

    res.json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
};

/**
 * Start POS session
 * POST /api/pos/sessions
 */
export const startSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new ValidationError('User ID is required');
    if (!req.companyId) throw new ValidationError('Company context is required');

    const { outlet_id, opening_cash = 0 } = req.body;
    if (!outlet_id) throw new ValidationError('Outlet ID is required');

    // Check if already open
    const { data: existing } = await supabaseAdmin
      .from('pos_sessions')
      .select('*')
      .eq('company_id', req.companyId)
      .eq('cashier_id', userId)
      .eq('status', 'open')
      .maybeSingle();

    if (existing) {
      throw new ApiError(400, 'An active session already exists for this user.');
    }

    const { data: newSession, error } = await supabaseAdmin
      .from('pos_sessions')
      .insert({
        company_id: req.companyId,
        cashier_id: userId,
        outlet_id: outlet_id,
        status: 'open',
        opened_at: new Date().toISOString(),
        opening_cash: parseFloat(opening_cash),
      })
      .select('*')
      .single();

    if (error) throw new ApiError(500, 'Failed to start session');

    res.status(201).json({ success: true, data: newSession });
  } catch (error) {
    next(error);
  }
};

/**
 * Close POS session
 * POST /api/pos/sessions/:id/close
 */
export const closeSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { closing_cash = 0, closing_notes } = req.body;
    if (!userId) throw new ValidationError('User ID is required');
    if (!req.companyId) throw new ValidationError('Company context is required');

    // Aggregate totals for the session using orders table since we linked pos_session_id
    const { data: sessionDetails, error } = await supabaseAdmin
      .from('pos_sessions')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        closing_cash,
      })
      .eq('id', id)
      .eq('company_id', req.companyId)
      .select('*')
      .single();

    if (error) throw new ApiError(500, 'Failed to close session');

    res.json({ success: true, data: sessionDetails });
  } catch (error) {
    next(error);
  }
};
