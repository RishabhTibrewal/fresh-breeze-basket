import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { ApiError, ValidationError } from '../middleware/error';
import { OrderService } from '../services/core/OrderService';

/**
 * Create POS order
 * POST /api/pos/orders
 */
export const createPOSOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      items,
      payment_method = 'cash',
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
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ValidationError('At least one item is required');
    }

    const userId = req.user?.id;
    if (!userId) throw new ValidationError('User ID is required');
    if (!req.companyId) throw new ValidationError('Company context is required');

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
      outletId: item.warehouse_id || item.outlet_id || outlet_id || null,
      taxPercentage: item.tax_percentage || 0,
    }));

    const result = await orderService.createOrder(
      {
        items: orderItems,
        paymentMethod: payment_method,
        paymentStatus: payment_method === 'cash' ? 'paid' : 'pending',
        notes: orderNotes,
      },
      {
        userId: null,
        outletId: outlet_id || null,
        industryContext: 'retail',
        orderType: 'sales',
        orderSource: 'pos',
        fulfillmentType: mappedFulfillment,
        customerId: customer_id || null,
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

    // Fetch complete order
    const order = await orderService.getOrderById(orderId);

    res.status(201).json({
      success: true,
      data: { ...order, receipt_number },
      invoice_url: `/api/invoices/pos/${orderId}`
    });
  } catch (error: any) {
    next(error instanceof ApiError || error instanceof ValidationError
      ? error
      : new ApiError(500, error.message || 'Failed to create POS order'));
  }
};
