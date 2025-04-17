import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { ApiError } from '../middleware/error';
import { stripeClient } from '../config';

// Get all orders (admin only)
export const getOrders = async (req: Request, res: Response) => {
  try {
    const { status, from_date, to_date, limit, page } = req.query;
    
    let query = supabase.from('orders').select('*, order_items(*, products(*))');
    
    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    
    if (from_date) {
      query = query.gte('created_at', from_date);
    }
    
    if (to_date) {
      query = query.lte('created_at', to_date);
    }
    
    // Apply sorting
    query = query.order('created_at', { ascending: false });
    
    // Apply pagination
    const pageSize = parseInt(limit as string) || 10;
    const pageNumber = parseInt(page as string) || 1;
    const start = (pageNumber - 1) * pageSize;
    
    query = query.range(start, start + pageSize - 1);
    
    const { data, error, count } = await query;
    
    if (error) {
      throw new ApiError(400, error.message);
    }
    
    res.status(200).json({
      success: true,
      count,
      data
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error fetching orders');
  }
};

// Get user's orders
export const getUserOrders = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new ApiError(400, error.message);
    }
    
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error fetching your orders');
  }
};

// Get order by ID (admin or order owner)
export const getOrderById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Check if user is admin
    const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin', { user_id: userId });
    
    if (adminError) {
      console.error('Error checking admin status:', adminError);
      return res.status(500).json({
        success: false,
        error: 'Error checking permissions'
      });
    }
    
    let query = supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', id);
    
    // If not admin, make sure user can only access their own orders
    if (!isAdmin) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query.single();
    
    if (error) {
      console.error('Error fetching order:', error);
      return res.status(404).json({
        success: false,
        error: 'Order not found or you do not have permission to view it'
      });
    }
    
    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error in getOrderById:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching order'
    });
  }
};

// Create a new order
export const createOrder = async (req: Request, res: Response) => {
  try {
    const { items, shipping_address, billing_address, payment_method, total_amount } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Order items are required'
      });
    }
    
    // Get product details to verify prices
    const productIds = items.map((item: any) => item.product_id);
    console.log('Validating products:', productIds);
    
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, price, sale_price, stock_count')
      .in('id', productIds);
    
    if (productsError) {
      console.error('Product validation error:', productsError);
      throw new ApiError(400, 'Error validating product information');
    }
    
    if (!products) {
      throw new ApiError(400, 'No products found');
    }
    
    // Verify product availability and prices
    for (const item of items) {
      const product = products.find(p => p.id === item.product_id);
      
      if (!product) {
        throw new ApiError(400, `Product with ID ${item.product_id} not found`);
      }
      
      if (product.stock_count < item.quantity) {
        throw new ApiError(400, `Not enough stock for ${product.name}`);
      }
      
      // Verify price
      const currentPrice = product.sale_price || product.price;
      if (currentPrice !== item.price) {
        throw new ApiError(400, `Price mismatch for ${product.name}. Please refresh and try again.`);
      }
    }
    
    // Create shipping address
    console.log('Creating shipping address...');
    const { data: shippingAddr, error: shippingAddrError } = await supabase
      .from('addresses')
      .insert({
        user_id: userId,
        ...shipping_address,
        address_type: 'shipping'
      })
      .select('*')
      .single();
    
    if (shippingAddrError) {
      console.error('Shipping address error:', shippingAddrError);
      throw new ApiError(400, `Error creating shipping address: ${shippingAddrError.message}`);
    }
    
    if (!shippingAddr) {
      throw new ApiError(400, 'Failed to create shipping address: No data returned');
    }
    
    console.log('Created shipping address:', shippingAddr.id);
    
    // Create billing address if different from shipping
    let billingAddr;
    if (billing_address && JSON.stringify(billing_address) !== JSON.stringify(shipping_address)) {
      console.log('Creating billing address...');
      const { data: addr, error: addrError } = await supabase
        .from('addresses')
        .insert({
          user_id: userId,
          ...billing_address,
          address_type: 'billing'
        })
        .select('*')
        .single();
      
      if (addrError) {
        console.error('Billing address error:', addrError);
        throw new ApiError(400, `Error creating billing address: ${addrError.message}`);
      }
      billingAddr = addr;
      console.log('Created billing address:', billingAddr.id);
    }
    
    // Create order
    console.log('Creating order...');
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        status: 'pending',
        shipping_address,
        payment_status: 'pending',
        payment_method,
        total_amount
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      return res.status(500).json({
        success: false,
        error: 'Error creating order'
      });
    }

    // Add order items
    console.log('Adding order items...');
    const orderItems = items.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      price: item.price
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('Order items error:', itemsError);
      throw new ApiError(400, `Error adding order items: ${itemsError.message}`);
    }
    
    console.log('Added order items');
    
    // Clear the user's cart
    console.log('Clearing cart...');
    const { data: cart } = await supabase
      .from('carts')
      .select('id')
      .eq('user_id', userId)
      .single();
    
    if (cart) {
      const { error: cartError } = await supabase
        .from('cart_items')
        .delete()
        .eq('cart_id', cart.id);
      
      return res.status(500).json({
        success: false,
        error: 'Error adding order items'
      });
    }

    res.status(201).json({
      success: true,
      data: {
        order_id: order.id
      }
    });
  } catch (error) {
    console.error('Error in createOrder:', error);
    res.status(500).json({
      success: false,
      error: 'Error creating order'
    });
  }
};

// Update order status (admin only)
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      throw new ApiError(400, 'Please provide a status');
    }
    
    // Validate status
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new ApiError(400, 'Invalid status');
    }
    
    // Update order
    const { data, error } = await supabase
      .from('orders')
      .update({
        status,
        updated_at: new Date()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      throw new ApiError(400, error.message);
    }
    
    // If order is canceled, restore inventory
    if (status === 'cancelled') {
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('product_id, quantity')
        .eq('order_id', id);
      
      if (orderItems) {
        for (const item of orderItems) {
          await supabase.rpc('update_stock', { 
            p_id: item.product_id,
            quantity: -item.quantity // Negative to add back to inventory
          });
        }
      }
    }
    
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error updating order status');
  }
}; 