import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { ApiError, ValidationError } from '../middleware/error';
import { OrderService } from '../services/core/OrderService';

/**
 * Create POS order with optional customer details
 * POST /api/pos/orders
 * Industry-agnostic: Uses retail context by default
 */
export const createPOSOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      items,
      customer_name,
      customer_phone,
      payment_method = 'cash',
      notes,
      outlet_id
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ValidationError('At least one item is required');
    }

    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    if (!req.companyId) {
      throw new ValidationError('Company context is required');
    }

    // Create order notes with customer info if provided
    let orderNotes = notes || '';
    if (customer_name || customer_phone) {
      const customerInfo = [];
      if (customer_name) customerInfo.push(`Customer: ${customer_name}`);
      if (customer_phone) customerInfo.push(`Phone: ${customer_phone}`);
      orderNotes = customerInfo.join(', ') + (orderNotes ? ` | ${orderNotes}` : '');
    }

    // Use OrderService to create order
    const orderService = new OrderService(req.companyId);

    // Transform items to OrderService format
    const orderItems = items.map((item: any) => ({
      productId: item.product_id,
      variantId: item.variant_id || null,
      quantity: item.quantity,
      unitPrice: item.price || item.unit_price,
      outletId: item.warehouse_id || item.outlet_id || outlet_id || null,
    }));

    const result = await orderService.createOrder(
      {
        items: orderItems,
        paymentMethod: payment_method,
        paymentStatus: payment_method === 'cash' ? 'paid' : 'pending',
        notes: orderNotes,
      },
      {
        userId: null, // POS orders don't require a user
        outletId: outlet_id || null,
        industryContext: 'retail', // POS is retail-focused
        orderType: 'sales',
        orderSource: 'pos',
        fulfillmentType: 'cash_counter',
      }
    );

    // Fetch complete order
    const order = await orderService.getOrderById(result.id);

    res.status(201).json({
      success: true,
      data: order,
      invoice_url: `/api/invoices/pos/${result.id}`
    });
  } catch (error: any) {
    next(error instanceof ApiError || error instanceof ValidationError 
      ? error 
      : new ApiError(500, error.message || 'Failed to create POS order'));
  }
};
