import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { ApiError } from '../middleware/error';
import { stripeClient } from '../config';
import { scheduleOrderProcessing } from '../utils/orderScheduler';

// Get all orders (admin only)
export const getOrders = async (req: Request, res: Response) => {
  try {
    const { status, from_date, to_date, limit, page } = req.query;
    const userId = req.user.id;
    
    // Log to help with debugging
    console.log('getOrders for user ID:', userId);
    
    // Check if the user exists in profiles table
    let isAdmin = false;
    
    try {
      // First try to get the profile from profiles table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId);
      
      if (profileError) {
        console.error('Error fetching profile:', profileError);
      } else if (profile && profile.length > 0) {
        // Check if any of the returned rows has admin role
        isAdmin = profile.some(p => p.role === 'admin');
        console.log('Profile found in profiles table, admin status:', isAdmin);
      } else {
        console.log('Profile not found in profiles table, checking users table');
        
        // If profile not found, try users table or another table that might have role information
        const { data: user, error: userError } = await supabase
          .from('users')  // Change this to whatever table might have the role information
          .select('role')
          .eq('id', userId)
          .single();
          
        if (!userError && user) {
          isAdmin = user.role === 'admin';
          console.log('User found in users table, admin status:', isAdmin);
        }
      }
    } catch (error) {
      console.error('Error during admin check:', error);
    }
    
    // Fall back to authenticated middleware's check if we couldn't determine admin status
    if (!isAdmin) {
      // The user passed the adminOnly middleware, so they should be an admin
      console.log('Using middleware admin verification as fallback');
      isAdmin = req.user.role === 'admin';
    }
    
    if (!isAdmin) {
      console.error('Non-admin user attempting to access all orders');
      throw new ApiError(403, 'Admin access required');
    }
    
    console.log('Admin status confirmed, fetching all orders');
    
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
      console.error('Error fetching orders:', error);
      throw new ApiError(400, error.message);
    }
    
    console.log(`Successfully fetched ${data?.length || 0} orders`);
    
    res.status(200).json({
      success: true,
      count,
      data
    });
  } catch (error) {
    console.error('Error in getOrders:', error);
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Error fetching orders'
      });
    }
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
    
    console.log('getOrderById, Order ID:', id, 'User ID:', userId);
    
    // Check if the user exists in profiles table
    let isAdmin = false;
    
    try {
      // First try to get the profile from profiles table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId);
      
      if (profileError) {
        console.error('Error fetching profile:', profileError);
      } else if (profile && profile.length > 0) {
        // Check if any of the returned rows has admin role
        isAdmin = profile.some(p => p.role === 'admin');
        console.log('Profile found in profiles table, admin status:', isAdmin);
      } else {
        console.log('Profile not found in profiles table, checking users table');
        
        // If profile not found, try users table or another table that might have role information
        const { data: user, error: userError } = await supabase
          .from('users')  // Change this to whatever table might have the role information
          .select('role')
          .eq('id', userId)
          .single();
          
        if (!userError && user) {
          isAdmin = user.role === 'admin';
          console.log('User found in users table, admin status:', isAdmin);
        }
      }
    } catch (error) {
      console.error('Error during admin check:', error);
    }
    
    // Fall back to authenticated middleware's check if we couldn't determine admin status
    if (!isAdmin) {
      // The user passed the adminOnly middleware, so they should be an admin
      console.log('Using middleware admin verification as fallback');
      isAdmin = req.user.role === 'admin';
    }
    
    console.log('User admin status:', isAdmin);
    
    let query = supabase
      .from('orders')
      .select('*, order_items(*, products(*))')
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
    
    console.log('Successfully fetched order details');
    
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
    const { 
      items, 
      shipping_address, 
      billing_address, 
      shipping_address_id, 
      billing_address_id, 
      payment_method, 
      total_amount 
    } = req.body;
    const userId = req.user.id;

    console.log('createOrder for user ID:', userId);
    
    if (!items || !items.length) {
      throw new ApiError(400, 'No items provided');
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
    
    // Variables to store address IDs
    let finalShippingAddressId: string;
    let finalBillingAddressId: string;
    
    // If using existing addresses
    if (shipping_address_id) {
      // Add debug logging
      console.log('Checking shipping address:', shipping_address_id, 'for user:', userId);
      
      // Verify the shipping address exists and belongs to the user
      const { data: shippingAddr, error: shippingAddrError } = await supabase
        .from('addresses')
        .select('id, user_id')
        .eq('id', shipping_address_id)
        .eq('user_id', userId)
        .single();
      
      console.log('Address query result:', shippingAddr, 'Error:', shippingAddrError);
      
      if (shippingAddrError || !shippingAddr) {
        throw new ApiError(400, 'Invalid shipping address');
      }
      
      finalShippingAddressId = shipping_address_id;
      
      // Use either provided billing address ID or shipping address ID
      if (billing_address_id && billing_address_id !== shipping_address_id) {
        // Verify the billing address exists and belongs to the user
        const { data: billingAddr, error: billingAddrError } = await supabase
          .from('addresses')
          .select('id')
          .eq('id', billing_address_id)
          .eq('user_id', userId)
          .single();
        
        if (billingAddrError || !billingAddr) {
          throw new ApiError(400, 'Invalid billing address');
        }
        
        finalBillingAddressId = billing_address_id;
      } else {
        finalBillingAddressId = shipping_address_id;
      }
    }
    // If creating new addresses
    else if (shipping_address) {
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
      finalShippingAddressId = shippingAddr.id;
      
      // Create billing address if different from shipping
      if (billing_address && JSON.stringify(billing_address) !== JSON.stringify(shipping_address)) {
        console.log('Creating billing address...');
        const { data: billingAddr, error: billingAddrError } = await supabase
          .from('addresses')
          .insert({
            user_id: userId,
            ...billing_address,
            address_type: 'billing'
          })
          .select('*')
          .single();
        
        if (billingAddrError) {
          console.error('Billing address error:', billingAddrError);
          throw new ApiError(400, `Error creating billing address: ${billingAddrError.message}`);
        }
        
        finalBillingAddressId = billingAddr.id;
        console.log('Created billing address:', billingAddr.id);
      } else {
        finalBillingAddressId = shippingAddr.id;
      }
    } else {
      throw new ApiError(400, 'Either shipping address details or shipping address ID must be provided');
    }
    
    // Create order
    console.log('Creating order...');
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        status: 'pending',
        shipping_address_id: finalShippingAddressId,
        billing_address_id: finalBillingAddressId,
        total_amount,
        payment_status: 'pending',
        payment_method: payment_method || 'card'
      })
      .select('*')
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
    const orderItems = items.map((item: {product_id: string, quantity: number, price: number}) => ({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.price
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('Error adding order items:', itemsError);
      // Rollback order creation
      await supabase
        .from('orders')
        .delete()
        .eq('id', order.id);
      
      return res.status(500).json({
        success: false,
        error: 'Error adding order items'
      });
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
      
      if (cartError) {
        console.error('Error clearing cart:', cartError);
      } else {
        console.log('Cart cleared');
      }
    }

    // Schedule order processing (status update to 'processing' after 5 minutes)
    scheduleOrderProcessing(order.id);
    console.log(`Order ${order.id} scheduled for automatic processing after 5 minutes`);

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
      error: error instanceof ApiError ? error.message : 'Error creating order'
    });
  }
};

// Update order status (admin only)
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, tracking_number, estimated_delivery } = req.body;
    
    if (!status) {
      throw new ApiError(400, 'Please provide a status');
    }
    
    // Validate status
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new ApiError(400, 'Invalid status');
    }

    // Fetch the current order data to check previous status and inventory_updated flag
    const { data: currentOrder, error: currentOrderError } = await supabase
      .from('orders')
      .select('*, order_items(product_id, quantity), status, inventory_updated')
      .eq('id', id)
      .single();

    if (currentOrderError || !currentOrder) {
      throw new ApiError(404, 'Order not found');
    }
    
    // Prepare update data
    const updateData: any = {
      status,
      updated_at: new Date()
    };
    
    // Reset inventory_updated flag when cancelling an order
    if (status === 'cancelled') {
      updateData.inventory_updated = false;
    }
    
    // Set inventory_updated flag when processing an order
    if (status === 'processing') {
      updateData.inventory_updated = true;
    }
    
    // Add tracking number if provided
    if (tracking_number) {
      updateData.tracking_number = tracking_number;
    }
    
    // Add estimated delivery if provided
    if (estimated_delivery) {
      updateData.estimated_delivery = estimated_delivery;
    }
    
    // Update order
    const { data, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      throw new ApiError(400, error.message);
    }
    
    // If order is cancelled, inventory is restored by the database trigger if needed
    if (status === 'cancelled') {
      console.log(`Order ${id} cancelled by admin. Inventory restoration handled by database trigger if needed.`);
    }
    
    // If status is being changed to 'processing' and inventory hasn't been updated yet,
    // reduce product stock counts
    if (status === 'processing' && currentOrder.status !== 'processing' && !currentOrder.inventory_updated) {
      console.log(`Order ${id} status changed to processing. Reducing inventory...`);
      
      const orderItems = currentOrder.order_items;
      
      if (orderItems && orderItems.length > 0) {
        // Process each item and update stock
        for (const item of orderItems) {
          try {
            // First get the current stock
            const { data: product, error: productError } = await supabase
              .from('products')
              .select('stock_count')
              .eq('id', item.product_id)
              .single();
            
            if (productError) {
              console.error(`Error fetching product ${item.product_id}:`, productError);
              continue;
            }
            
            // Calculate new stock count
            const newStockCount = Math.max(0, product.stock_count - item.quantity);
            
            // Update the product stock
            const { error: updateError } = await supabase
              .from('products')
              .update({ stock_count: newStockCount })
              .eq('id', item.product_id);
            
            if (updateError) {
              console.error(`Error updating stock for product ${item.product_id}:`, updateError);
            } else {
              console.log(`Stock reduced for product ${item.product_id}: ${product.stock_count} -> ${newStockCount}`);
            }
          } catch (err) {
            console.error(`Error processing item ${item.product_id}:`, err);
          }
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

// Cancel order (user)
export const cancelOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Fetch the order and verify it belongs to the user
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items(product_id, quantity)')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    
    if (orderError || !order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found or you do not have permission to cancel it'
      });
    }
    
    // Check if order is in a status that can be cancelled
    if (order.status !== 'pending' && order.status !== 'processing') {
      return res.status(400).json({
        success: false,
        error: 'Only pending or processing orders can be cancelled'
      });
    }
    
    // Check if order was created within the last 5 minutes
    const orderCreatedAt = new Date(order.created_at);
    const currentTime = new Date();
    const timeDifferenceMinutes = (currentTime.getTime() - orderCreatedAt.getTime()) / (1000 * 60);
    
    if (timeDifferenceMinutes > 5) {
      return res.status(400).json({
        success: false,
        error: 'Orders can only be cancelled within 5 minutes of creation'
      });
    }
    
    console.log(`Cancelling order ${id} for user ${userId}`);
    
    // Update order status to cancelled
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        inventory_updated: false, // Reset inventory_updated flag
        updated_at: new Date()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (updateError) {
      throw new ApiError(400, updateError.message);
    }
    
    // If the order was in processing status and inventory was already updated,
    // we need to restore the inventory
    if (order.status === 'processing' && order.inventory_updated) {
      console.log(`Order ${id} was in processing state and had inventory updated. Restoring inventory...`);
      
      // Get the order items
      const orderItems = order.order_items;
      
      if (orderItems && orderItems.length > 0) {
        // Process each item and restore stock
        for (const item of orderItems) {
          try {
            // First get the current stock
            const { data: product, error: productError } = await supabase
              .from('products')
              .select('stock_count')
              .eq('id', item.product_id)
              .single();
            
            if (productError) {
              console.error(`Error fetching product ${item.product_id}:`, productError);
              continue;
            }
            
            // Calculate restored stock count
            const restoredStockCount = product.stock_count + item.quantity;
            
            // Update the product stock
            const { error: updateError } = await supabase
              .from('products')
              .update({ stock_count: restoredStockCount })
              .eq('id', item.product_id);
            
            if (updateError) {
              console.error(`Error restoring stock for product ${item.product_id}:`, updateError);
            } else {
              console.log(`Stock restored for product ${item.product_id}: ${product.stock_count} -> ${restoredStockCount}`);
            }
          } catch (err) {
            console.error(`Error processing item ${item.product_id}:`, err);
          }
        }
      }
    } else {
      console.log(`Order ${id} cancelled with inventory_updated=${order.inventory_updated}`);
    }
    
    res.status(200).json({
      success: true,
      data: updatedOrder,
      message: 'Order cancelled successfully'
    });
  } catch (error) {
    console.error('Error in cancelOrder:', error);
    res.status(500).json({
      success: false,
      error: 'Error cancelling order'
    });
  }
}; 