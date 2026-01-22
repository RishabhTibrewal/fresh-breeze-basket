import { Request, Response, NextFunction } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
import { ApiError, ValidationError } from '../middleware/error';
import { reserveWarehouseStock, getDefaultWarehouseId } from '../utils/warehouseInventory';

/**
 * Create POS order with optional customer details
 * POST /api/pos/orders
 */
export const createPOSOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      items,
      customer_name,
      customer_phone,
      payment_method = 'cash',
      notes
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

    // Get product prices (filtered by company_id)
    const productIds = items.map((item: any) => item.product_id);
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, price, sale_price')
      .in('id', productIds)
      .eq('company_id', req.companyId);

    if (productsError || !products) {
      throw new ApiError(400, 'Failed to fetch product prices');
    }

    const productPrices: Record<string, number> = {};
    products.forEach(product => {
      productPrices[product.id] = product.sale_price || product.price;
    });

    // Calculate total
    let subtotal = 0;
    const orderItems = items.map((item: any) => {
      const unitPrice = item.price || item.unit_price || productPrices[item.product_id];
      if (!unitPrice || isNaN(Number(unitPrice))) {
        throw new ValidationError(`Missing or invalid price for product ${item.product_id}`);
      }
      const lineTotal = item.quantity * unitPrice;
      subtotal += lineTotal;
      
      return {
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: unitPrice,
        warehouse_id: item.warehouse_id || null
      };
    });

    const tax = subtotal * 0.05; // 5% tax
    const totalAmount = subtotal + tax;

    // Get default warehouse if needed
    const { getDefaultWarehouseId } = await import('../utils/warehouseInventory');
    const defaultWarehouseId = await getDefaultWarehouseId(req.companyId);

    // Reserve stock for all items
    const reservationErrors: string[] = [];
    for (const item of orderItems) {
      try {
        const warehouseId = item.warehouse_id || defaultWarehouseId;
        if (!warehouseId) {
          reservationErrors.push(`No warehouse_id for product ${item.product_id}`);
          continue;
        }
        
        await reserveWarehouseStock(
          item.product_id,
          warehouseId,
          item.quantity,
          req.companyId,
          true // Use admin client
        );
      } catch (err: any) {
        console.error(`Error reserving stock for product ${item.product_id}:`, err);
        reservationErrors.push(`Failed to reserve stock for product ${item.product_id}: ${err.message}`);
      }
    }

    if (reservationErrors.length > 0) {
      console.error('Stock reservation errors:', reservationErrors);
      return res.status(400).json({
        success: false,
        error: 'Stock reservation failed',
        details: reservationErrors
      });
    }

    // Create order notes with customer info if provided
    let orderNotes = notes || '';
    if (customer_name || customer_phone) {
      const customerInfo = [];
      if (customer_name) customerInfo.push(`Customer: ${customer_name}`);
      if (customer_phone) customerInfo.push(`Phone: ${customer_phone}`);
      orderNotes = customerInfo.join(', ') + (orderNotes ? ` | ${orderNotes}` : '');
    }

    // Create order (without customer/user_id for POS orders) (with company_id)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: null, // POS orders don't require a user
        company_id: req.companyId,
        total_amount: totalAmount,
        status: 'pending',
        payment_method: payment_method,
        payment_status: payment_method === 'cash' ? 'paid' : 'pending',
        notes: orderNotes,
        inventory_updated: false
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      // Rollback stock reservations
      const { restoreReservedStock } = await import('../utils/warehouseInventory');
      for (const item of orderItems) {
        try {
          const warehouseId = item.warehouse_id || defaultWarehouseId;
          if (warehouseId) {
            await restoreReservedStock(item.product_id, warehouseId, item.quantity, req.companyId, true);
          }
        } catch (err) {
          console.error(`Error rolling back reservation for product ${item.product_id}:`, err);
        }
      }
      throw new ApiError(500, `Failed to create order: ${orderError.message}`);
    }

    // Create order items using admin client to bypass RLS (POS orders have null user_id)
    const itemsToInsert = orderItems.map(item => ({
      order_id: order.id,
      company_id: req.companyId,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      warehouse_id: item.warehouse_id || defaultWarehouseId
    }));

    const adminClient = supabaseAdmin || supabase;
    const { error: itemsError } = await adminClient
      .from('order_items')
      .insert(itemsToInsert);

    if (itemsError) {
      console.error('Error creating order items:', itemsError);
      // Rollback order and stock reservations (filtered by company_id)
      await supabase.from('orders').delete().eq('id', order.id).eq('company_id', req.companyId);
      const { restoreReservedStock } = await import('../utils/warehouseInventory');
      for (const item of orderItems) {
        try {
          const warehouseId = item.warehouse_id || defaultWarehouseId;
          if (warehouseId) {
            await restoreReservedStock(item.product_id, warehouseId, item.quantity, req.companyId, true);
          }
        } catch (err) {
          console.error(`Error rolling back reservation for product ${item.product_id}:`, err);
        }
      }
      throw new ApiError(500, `Failed to create order items: ${itemsError.message}`);
    }

    // Fetch complete order (filtered by company_id)
    const { data: completeOrder, error: fetchError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          products (*)
        )
      `)
      .eq('id', order.id)
      .eq('company_id', req.companyId)
      .single();

    if (fetchError) {
      console.error('Error fetching order:', fetchError);
    }

    res.status(201).json({
      success: true,
      data: completeOrder || order,
      invoice_url: `/api/invoices/pos/${order.id}`
    });
  } catch (error) {
    next(error);
  }
};
