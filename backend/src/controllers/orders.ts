import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { supabaseAdmin } from '../lib/supabase';
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
    
    // First get the total count
    const { count: totalCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });
    
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
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching orders:', error);
      throw new ApiError(400, error.message);
    }
    
    console.log(`Successfully fetched ${data?.length || 0} orders out of ${totalCount || 0} total orders`);
    
    res.status(200).json({
      success: true,
      count: totalCount || 0,
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
    let isSales = false;
    
    try {
      // First try to get the profile from profiles table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (profileError) {
        console.error('Error fetching profile:', profileError);
      } else if (profile) {
        // Check role
        isAdmin = profile.role === 'admin';
        isSales = profile.role === 'sales';
        console.log('Profile found in profiles table, admin status:', isAdmin, 'sales status:', isSales);
      }
    } catch (error) {
      console.error('Error during admin check:', error);
    }
    
    // Fall back to middleware's check if we couldn't determine status
    if (!isAdmin && !isSales) {
      console.log('Using middleware admin verification as fallback');
      isAdmin = req.user.role === 'admin';
      isSales = req.user.role === 'sales';
    }
    
    console.log('User admin status:', isAdmin, 'User sales status:', isSales);
    
    // First, get the order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          product:products (
            *,
            images:product_images (*)
          )
        )
      `)
      .eq('id', id)
      .single();

    if (orderError) {
      console.error('Error fetching order:', orderError);
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Check access permission - admins can see all, sales executives can see their customers' orders
    let hasAccess = isAdmin;
    
    if (!hasAccess && isSales) {
      // For sales, check if this order belongs to their customer
      const { data: customer } = await supabase
        .from('customers')
        .select('id, sales_executive_id')
        .eq('user_id', order.user_id)
        .single();
        
      if (customer && customer.sales_executive_id === userId) {
        hasAccess = true;
      }
    }
    
    // Allow the order owner to view their own order
    if (!hasAccess && order.user_id === userId) {
      hasAccess = true;
    }
    
    if (!hasAccess) {
      console.log('Access denied: User is not admin or sales with access to this customer');
      return res.status(403).json({ error: 'You do not have permission to view this order' });
    }
    
    // Get order items with product details
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select(`
        *,
        product:products (*)
      `)
      .eq('order_id', id);
      
    if (itemsError) {
      console.error('Error fetching order items:', itemsError);
    }
      
    if (orderItems) {
      order.order_items = orderItems;
    }
    
    // Get credit details if applicable
    if (order.payment_status === 'credit') {
      const { data: creditPeriod, error: creditError } = await supabase
        .from('credit_periods')
        .select('*')
        .eq('order_id', id)
        .single();
      
      if (!creditError && creditPeriod) {
        order.credit_details = creditPeriod;
      }
    }

    // Get shipping address if available
    if (order.shipping_address_id) {
      const { data: shippingAddress, error: shippingAddressError } = await supabase
        .from('addresses')
        .select('*')
        .eq('id', order.shipping_address_id)
        .single();
        
      if (!shippingAddressError && shippingAddress) {
        order.shipping_address = shippingAddress;
      }
    }
    
    // Get billing address if available and different from shipping
    if (order.billing_address_id && order.billing_address_id !== order.shipping_address_id) {
      const { data: billingAddress, error: billingAddressError } = await supabase
        .from('addresses')
        .select('*')
        .eq('id', order.billing_address_id)
        .single();
        
      if (!billingAddressError && billingAddress) {
        order.billing_address = billingAddress;
      }
    }

    // Get customer details
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', order.user_id)
      .single();
      
    if (!customerError && customer) {
      order.customer = customer;
    }
    
    res.json(order);
  } catch (error) {
    console.error('Error in getOrderById:', error);
    res.status(500).json({ 
      error: 'Failed to fetch order details',
      message: error instanceof Error ? error.message : 'Unknown error'
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
      payment_status: req_payment_status,
      total_amount,
      credit_period,
      partial_payment_amount,
      payment_intent_id
    } = req.body;
    const userId = req.user.id;

    console.log('createOrder for user ID:', userId);
    console.log('Received payment_status from request body:', req_payment_status);
    console.log('Received payment_method:', payment_method);
    console.log('Received payment_intent_id:', payment_intent_id);
    
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
    console.log('Creating order with payment_status from request:', req_payment_status);
    
    // Determine final payment status
    let finalPaymentStatus = req_payment_status;
    if (payment_intent_id) {
      finalPaymentStatus = 'paid';
      console.log('Payment intent ID provided, setting payment_status to paid');
    }
    
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        status: 'pending', 
        shipping_address_id: finalShippingAddressId,
        billing_address_id: finalBillingAddressId,
        total_amount,
        payment_status: finalPaymentStatus,
        payment_method: payment_method,
        payment_intent_id: payment_intent_id 
      })
      .select('*')
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      // Log the exact error from Supabase
      console.error('Supabase order insertion error details:', orderError.message, orderError.details, orderError.hint);
      return res.status(500).json({
        success: false,
        error: 'Error creating order',
        details: orderError.message
      });
    }
    console.log('Order created in DB with ID:', order.id, 'and resulting payment_status:', order.payment_status);

    // If we have a payment intent ID, update the payment record to link it to this order
    if (payment_intent_id) {
      console.log('Linking payment record to order:', order.id);
      
      // First check if payment record exists
      const { data: existingPayment, error: checkError } = await supabaseAdmin
        .from('payments')
        .select('id, order_id')
        .eq('stripe_payment_intent_id', payment_intent_id)
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking payment record:', checkError);
      } else if (existingPayment) {
        // Payment record exists, update it with order_id
        const { error: paymentUpdateError } = await supabaseAdmin
          .from('payments')
          .update({
            order_id: order.id,
            updated_at: new Date()
          })
          .eq('stripe_payment_intent_id', payment_intent_id);

        if (paymentUpdateError) {
          console.error('Error updating payment record with order_id:', paymentUpdateError);
        } else {
          console.log('Successfully linked existing payment record to order');
        }
      } else {
        // Payment record doesn't exist, create it with order_id
        console.log('Payment record not found, creating new one with order_id');
        const { error: paymentCreateError } = await supabaseAdmin
          .from('payments')
          .insert({
            order_id: order.id,
            amount: total_amount,
            status: 'completed',
            payment_method: 'card',
            stripe_payment_intent_id: payment_intent_id,
            payment_gateway_response: {
              source: 'order_creation',
              created_at: new Date().toISOString(),
              payment_intent_id: payment_intent_id
            },
            transaction_references: {
              order_created: true,
              stripe_payment_intent_id: payment_intent_id
            }
          });

        if (paymentCreateError) {
          console.error('Error creating payment record:', paymentCreateError);
          // Check if it's a duplicate key error
          if (paymentCreateError.code === '23505') {
            console.log('Duplicate payment record detected, attempting to update existing record');
            // Try to update the existing record instead
            const { error: updateError } = await supabaseAdmin
              .from('payments')
              .update({
                order_id: order.id,
                updated_at: new Date()
              })
              .eq('stripe_payment_intent_id', payment_intent_id);

            if (updateError) {
              console.error('Error updating existing payment record:', updateError);
            } else {
              console.log('Successfully updated existing payment record with order_id');
            }
          }
        } else {
          console.log('Successfully created payment record with order_id');
        }
      }
    }

    // If payment status is credit or partial, create credit period
    if (req_payment_status === 'full_credit' || req_payment_status === 'partial_payment') {
      console.log('Creating credit period for order:', order.id, 'request payment_status:', req_payment_status);
      const creditAmount = req_payment_status === 'full_credit' ? total_amount : (total_amount - (partial_payment_amount || 0));
      
      // First get the customer ID for this user
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', userId)
        .single();
        
      if (customerError) {
        console.error('Error finding customer:', customerError);
        // Rollback order creation
        await supabase
          .from('orders')
          .delete()
          .eq('id', order.id);
          
        return res.status(500).json({
          success: false,
          error: 'Error finding customer for credit period'
        });
      }
      
      // Calculate end date which is start_date + period days
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + (credit_period || 30));
      
      const { error: creditError } = await supabase
        .from('credit_periods')
        .insert({
          order_id: order.id,
          amount: creditAmount,
          period: credit_period || 30,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          customer_id: customerData.id,  // Use the customer ID we just fetched
          type: 'credit',  // This is required based on the schema
          description: `Credit for order ${order.id}. Payment ${req_payment_status}.`
        });

      if (creditError) {
        console.error('Error creating credit period:', creditError);
        // Rollback order creation
        await supabase
          .from('orders')
          .delete()
          .eq('id', order.id);
        
        return res.status(500).json({
          success: false,
          error: 'Error creating credit period'
        });
      }
      console.log('Credit period created successfully for order:', order.id);
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

// Update order status (admin and sales executives)
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      status, 
      tracking_number, 
      estimated_delivery, 
      notes,
      payment_status,
      payment_method,
      partial_payment_amount
    } = req.body;
    const userId = req.user.id;
    
    // Check user role (admin or sales)
    let isAdmin = false;
    let isSales = false;
    
    try {
      // Get user's role from profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (profileError) {
        console.error('Error fetching profile:', profileError);
      } else if (profile) {
        isAdmin = profile.role === 'admin';
        isSales = profile.role === 'sales';
      }
    } catch (error) {
      console.error('Error checking user role:', error);
    }
    
    // Fallback to middleware role check
    if (!isAdmin && !isSales) {
      isAdmin = req.user.role === 'admin';
      isSales = req.user.role === 'sales';
    }
    
    // Only allow admins and sales executives to update orders
    if (!isAdmin && !isSales) {
      return res.status(403).json({
        success: false,
        error: 'Only admins and sales executives can update order status'
      });
    }
    
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
      .select('*, order_items(product_id, quantity), status, inventory_updated, user_id, payment_status')
      .eq('id', id)
      .single();

    if (currentOrderError || !currentOrder) {
      throw new ApiError(404, 'Order not found');
    }
    
    // Check if the sales executive has permission to update this order
    let hasAccess = isAdmin; // Admins always have access
    
    if (!hasAccess && isSales) {
      // Check if this order belongs to a customer assigned to this sales exec
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('sales_executive_id')
        .eq('user_id', currentOrder.user_id)
        .single();
        
      if (!customerError && customer && customer.sales_executive_id === userId) {
        hasAccess = true;
      }
    }
    
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to update this order'
      });
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
    
    // Add notes if provided
    if (notes) {
      updateData.notes = notes;
    }
    
    // Flag to track if payment status is changing
    let isPaymentStatusChanging = false;
    let dbPaymentStatus = '';
    
    // Handle payment status update
    if (payment_status && payment_status !== currentOrder.payment_status) {
      isPaymentStatusChanging = true;
      // Map the frontend payment status formats to database formats
      dbPaymentStatus = payment_status;
      if (payment_status === 'full_payment') {
        dbPaymentStatus = 'paid';
      } else if (payment_status === 'partial_payment') {
        dbPaymentStatus = 'partial';
      } else if (payment_status === 'full_credit') {
        dbPaymentStatus = 'credit';
      }
      
      updateData.payment_status = dbPaymentStatus;
      
      // Update payment related fields
      if (payment_method) {
        updateData.payment_method = payment_method;
      }
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
    
    // If payment status is changing and a payment method is provided, update credit_periods and customers tables
    if (isPaymentStatusChanging) {
      try {
        // Find associated credit period
        const { data: creditPeriod, error: creditError } = await supabase
          .from('credit_periods')
          .select('*')
          .eq('order_id', id)
          .single();
          
        if (creditError) {
          console.error('Error finding credit period for order:', creditError);
        } else if (creditPeriod) {
          console.log('Found credit period:', creditPeriod);
          
          // Prepare credit period update data
          const creditUpdateData: any = {};
          
          let paymentAmountToProcess = 0;
          
          // Handle different payment scenarios
          if (dbPaymentStatus === 'paid') {
            // Full payment - set amount to 0
            paymentAmountToProcess = parseFloat(creditPeriod.amount.toString());
            creditUpdateData.amount = 0;
            creditUpdateData.description = `Fully paid off on ${new Date().toISOString().split('T')[0]} via ${payment_method}`;
          } else if (dbPaymentStatus === 'partial' && partial_payment_amount) {
            const currentAmount = parseFloat(creditPeriod.amount.toString());
            // Ensure payment amount is a number
            const parsedPaymentAmount = parseFloat(partial_payment_amount.toString());
            
            // Partial payment - reduce the amount
            if (parsedPaymentAmount >= currentAmount) {
              // If payment is greater than or equal to the balance, treat as full payment
              paymentAmountToProcess = currentAmount;
              creditUpdateData.amount = 0;
              creditUpdateData.description = `Fully paid off on ${new Date().toISOString().split('T')[0]} via ${payment_method}`;
            } else {
              // Regular partial payment
              paymentAmountToProcess = parsedPaymentAmount;
              const remainingAmount = currentAmount - parsedPaymentAmount;
              creditUpdateData.amount = remainingAmount;
              creditUpdateData.description = `Partial payment of $${parsedPaymentAmount.toFixed(2)} received on ${new Date().toISOString().split('T')[0]} via ${payment_method}. Remaining: $${remainingAmount.toFixed(2)}`;
            }
          }
          
          // Only proceed with updates if there's a valid payment amount or we're marking as paid
          if (paymentAmountToProcess > 0 || dbPaymentStatus === 'paid') {
            console.log('[OrderUpdate] Attempting to update credit_periods for ID:', creditPeriod.id, 'with data:', JSON.stringify(creditUpdateData));
            
            // Update credit period
            const { data: updatedCpData, error: updateCreditError } = await supabase
              .from('credit_periods')
              .update(creditUpdateData)
              .eq('id', creditPeriod.id)
              .select(); // Added .select() to get the result of the update

            if (updateCreditError) {
              console.error('[OrderUpdate] Error updating credit period:', updateCreditError);
            } else {
              console.log('[OrderUpdate] Credit period updated successfully. Result:', JSON.stringify(updatedCpData));
              
              // Find the customer record for this order
              const { data: customer, error: customerError } = await supabase
                .from('customers')
                .select('id, current_credit')
                .eq('user_id', currentOrder.user_id)
                .single();
                
              if (customerError) {
                console.error('Error finding customer:', customerError);
              } else if (customer && paymentAmountToProcess > 0) {
                // Update customer's current_credit
                const currentCredit = parseFloat(customer.current_credit.toString());
                const newCreditAmount = Math.max(0, currentCredit - paymentAmountToProcess);
                
                const { error: customerUpdateError } = await supabase
                  .from('customers')
                  .update({ current_credit: newCreditAmount })
                  .eq('id', customer.id);
                  
                if (customerUpdateError) {
                  console.error('Error updating customer credit:', customerUpdateError);
                } else {
                  console.log('Customer current credit updated successfully to:', newCreditAmount);
                }
              }
            }
          }
        }
      } catch (e) {
        console.error('Error handling credit period and customer updates:', e);
        // Don't throw an error as the order update was successful
      }
    }
    
    // If order is cancelled, handle credit amounts and inventory
    if (status === 'cancelled') {
      console.log(`Order ${id} cancelled. Handling credit amounts and inventory restoration.`);
      
      // Find associated credit period if it exists
      const { data: creditPeriod, error: creditError } = await supabase
        .from('credit_periods')
        .select('*')
        .eq('order_id', id)
        .single();
        
      if (!creditError && creditPeriod) {
        console.log('Found credit period for cancelled order:', creditPeriod);
        
        // Get the customer record
        const { data: customer, error: customerError } = await supabase
          .from('customers')
          .select('id, current_credit')
          .eq('user_id', currentOrder.user_id)
          .single();
          
        if (!customerError && customer) {
          // Calculate new current_credit by subtracting the credit amount
          const currentCredit = parseFloat(customer.current_credit.toString());
          const creditAmount = parseFloat(creditPeriod.amount.toString());
          const newCreditAmount = Math.max(0, currentCredit - creditAmount);
          
          console.log('Updating customer credit after cancellation:', {
            customerId: customer.id,
            currentCredit,
            creditAmount,
            newCreditAmount
          });
          
          // Update customer's current_credit
          const { error: updateError } = await supabase
            .from('customers')
            .update({ current_credit: newCreditAmount })
            .eq('id', customer.id);
            
          if (updateError) {
            console.error('Error updating customer credit after cancellation:', updateError);
          } else {
            console.log('Customer credit updated successfully after cancellation');
          }
        }
        
        // Mark credit period as cancelled and update its description (no status field)
        const creditUpdateResult = await supabase
          .from('credit_periods')
          .update({
            description: 'Order Cancelled',
            // amount: 0, // Set amount to 0 since the credit is cancelled
            end_date: new Date().toISOString().split('T')[0] // Set end date to current date
          })
          .eq('id', creditPeriod.id);
        if (creditUpdateResult.error) {
          console.error('Error updating credit period:', creditUpdateResult.error);
        } else {
          console.log('Credit period updated successfully');
        }
      }
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

// Cancel order (user, admin, or sales executive)
export const cancelOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // Order ID from URL
    const userId = req.user.id; // Currently logged-in user
    const userRole = req.user.role; // Role from token (e.g., 'user', 'admin', 'sales')

    console.log(`Attempting to cancel order ${id} by user ${userId} with role ${userRole}`);

    // Fetch the order
    let orderQuery = supabase
      .from('orders')
      .select('*, order_items(product_id, quantity), user_id') // Ensure user_id is selected
      .eq('id', id)
      .single();

    const { data: order, error: orderError } = await orderQuery;

    if (orderError || !order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Log details for debugging permission issues
    console.log(`Order details for cancellation check: OrderID=${order.id}, OwnerID=${order.user_id}, Status=${order.status}`);
    console.log(`Requesting user for cancellation: UserID=${userId}, Role=${userRole}`);

    // Determine effective role for permission and business logic
    let effectiveRoleForCancellation = userRole;
    if (userRole === 'sales' && order.user_id === userId) {
      console.log(`Sales executive ${userId} is acting on their OWN order ${order.id}. Applying user-level cancellation rules.`);
      effectiveRoleForCancellation = 'user'; // Treat as a regular user for their own order's cancellation rules
    }

    // Permission checks based on effectiveRoleForCancellation
    let hasPermission = false;
    if (effectiveRoleForCancellation === 'admin') {
      hasPermission = true;
      console.log(`Admin ${userId} has permission to cancel order ${id}`);
    } else if (effectiveRoleForCancellation === 'sales') { // This means sales exec acting on OTHERS' orders
      const { data: customer } = await supabase
        .from('customers')
        .select('sales_executive_id')
        .eq('user_id', order.user_id)
        .single();
      if (customer && customer.sales_executive_id === userId) {
        hasPermission = true;
        console.log(`Sales executive ${userId} has permission to cancel order ${id} for customer ${order.user_id}`);
      }
    } else if ((effectiveRoleForCancellation === 'user' || effectiveRoleForCancellation === 'authenticated')) {
      // This now also covers sales exec acting on their own order if order.user_id === userId
      console.log(`User/Authenticated/Sales (own order) role attempting self-cancel: Comparing OrderOwnerID (${order.user_id}) with LoggedInUserID (${userId})`);
      if (order.user_id === userId) { // This check is vital for self-cancellation
        hasPermission = true;
        console.log(`User ${userId} (effective role ${effectiveRoleForCancellation}) has permission to cancel their own order ${id}`);
      }
    }

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to cancel this order'
      });
    }

    // Business logic for cancellation based on effectiveRoleForCancellation
    if (effectiveRoleForCancellation === 'admin' || effectiveRoleForCancellation === 'sales') {
      // Admin/Sales (for OTHERS' orders): Can only cancel if status is 'pending'
      if (order.status !== 'pending') {
        return res.status(400).json({
          success: false,
          error: 'Orders can only be cancelled by admin/sales if the status is pending'
        });
      }
      console.log(`Admin/Sales (for others) cancelling a '${order.status}' order. Proceeding.`);
    } else { // Regular user OR Sales exec cancelling their OWN order (effectiveRoleForCancellation is 'user' or 'authenticated')
      // User rules: Can cancel if status is 'pending' or 'processing' AND within 5 minutes
      if (order.status !== 'pending' && order.status !== 'processing') {
        return res.status(400).json({
          success: false,
          error: 'Only pending or processing orders can be cancelled by user'
        });
      }
      const orderCreatedAt = new Date(order.created_at);
      const currentTime = new Date();
      const timeDifferenceMinutes = (currentTime.getTime() - orderCreatedAt.getTime()) / (1000 * 60);
      if (timeDifferenceMinutes > 5) {
        return res.status(400).json({
          success: false,
          error: 'Orders can only be cancelled by user within 5 minutes of creation'
        });
      }
      console.log(`User (or Sales on own order) cancelling a '${order.status}' order within time limit. Proceeding.`);
    }
    
    console.log(`Cancelling order ${id} by user ${userId} (effective role ${effectiveRoleForCancellation})`);
    
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
    
    // After updating the order status to cancelled, update the associated credit period if it exists
    const { data: creditPeriod, error: creditError } = await supabase
      .from('credit_periods')
      .select('*')
      .eq('order_id', id)
      .single();
    console.log('[CancelOrder] creditPeriod lookup result:', { creditPeriod, creditError });
    if (!creditError && creditPeriod) {
      console.log('[CancelOrder] Found credit period for cancelled order:', creditPeriod);
      // Get the customer record
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id, current_credit')
        .eq('user_id', order.user_id)
        .single();
      if (!customerError && customer) {
        // Calculate new current_credit by subtracting the credit amount
        const currentCredit = parseFloat(customer.current_credit.toString());
        const creditAmount = parseFloat(creditPeriod.amount.toString());
        const newCreditAmount = Math.max(0, currentCredit - creditAmount);
        // Update customer's current_credit
        const { error: updateError } = await supabase
          .from('customers')
          .update({ current_credit: newCreditAmount })
          .eq('id', customer.id);
        if (updateError) {
          console.error('[CancelOrder] Error updating customer credit after cancellation:', updateError);
        } else {
          console.log('[CancelOrder] Customer credit updated successfully after cancellation');
        }
      }
      // Mark credit period as cancelled and update its description (no status field)
      const creditUpdateResult = await supabase
        .from('credit_periods')
        .update({
          description: 'Order Cancelled',
          amount: 0, // Set amount to 0 since the credit is cancelled
          end_date: new Date().toISOString().split('T')[0] // Set end date to current date
        })
        .eq('id', creditPeriod.id);
      if (creditUpdateResult.error) {
        console.error('Error updating credit period:', creditUpdateResult.error);
      } else {
        console.log('Credit period updated successfully');
      }
    } else {
      console.log('[CancelOrder] No credit period found for this order or error occurred:', creditError);
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

// Get all orders for sales executive's customers
export const getSalesOrders = async (req: Request, res: Response) => {
  try {
    const sales_executive_id = req.user?.id;
    console.log('Fetching orders for sales executive:', sales_executive_id);

    // Get all customers for this sales executive
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('id, user_id, name')
      .eq('sales_executive_id', sales_executive_id);

    if (customersError) {
      console.error('Error fetching customers:', customersError);
      return res.status(500).json({ error: 'Failed to fetch customers' });
    }

    console.log('Found customers:', customers?.length || 0);

    if (!customers || customers.length === 0) {
      console.log('No customers found for sales executive');
      return res.json([]); // Return empty array if no customers
    }

    // Get all orders for these customers
    const customerUserIds = customers.map(c => c.user_id);
    console.log('Fetching orders for customer user IDs:', customerUserIds);

    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          product:products (*)
        ),
        credit_periods (*)
      `)
      .in('user_id', customerUserIds)
      .order('created_at', { ascending: false });

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return res.status(500).json({ error: 'Failed to fetch orders' });
    }

    console.log('Found orders:', orders?.length || 0);

    // Process orders to include credit details
    const processedOrders = orders.map(order => {
      // Get the first credit period if it exists
      const creditPeriod = order.credit_periods?.[0];
      
      // Remove the credit_periods array and add credit_details if exists
      const { credit_periods, ...orderWithoutCreditPeriods } = order;
      
      return {
        ...orderWithoutCreditPeriods,
        credit_details: creditPeriod || null
      };
    });

    // Add customer information to each order
    const ordersWithCustomer = processedOrders.map(order => {
      const customer = customers.find(c => c.user_id === order.user_id);
      return {
        ...order,
        customer: customer ? {
          id: customer.id,
          name: customer.name
        } : null,
        // Add order_number if not present
        order_number: order.order_number || `ORD-${order.id.substring(0, 8)}`,
        // Ensure status is never null
        status: order.status || 'pending',
        // Ensure payment_status is never null
        payment_status: order.payment_status || 'pending'
      };
    });

    console.log('Returning orders with customer info and credit details');
    res.json(ordersWithCustomer);
  } catch (error: any) {
    console.error('Error in getSalesOrders:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch orders' });
  }
};

// Get sales dashboard statistics for the logged-in sales executive
export const getSalesDashboardStats = async (req: Request, res: Response) => {
  try {
    const sales_executive_id = req.user?.id;
    // Get all customers for this sales executive
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('id, user_id, name, current_credit')
      .eq('sales_executive_id', sales_executive_id);
    if (customersError) {
      console.error('Error fetching customers:', customersError);
      return res.status(500).json({ error: 'Failed to fetch customers' });
    }
    const totalCustomers = customers?.length || 0;
    const customerUserIds = customers.map(c => c.user_id);
    // Get all orders for these customers
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, user_id, total_amount, status, created_at')
      .in('user_id', customerUserIds);
    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return res.status(500).json({ error: 'Failed to fetch orders' });
    }
    const totalOrders = orders?.length || 0;
    // Calculate total credit (sum of current_credit for all customers)
    const totalCredit = customers.reduce((sum, c) => sum + (parseFloat(c.current_credit) || 0), 0);
    // Get 5 most recent orders
    const recentOrders = (orders || [])
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .map(order => {
        const customer = customers.find(c => c.user_id === order.user_id);
        return {
          id: order.id,
          customer: customer ? customer.name : 'Unknown',
          amount: order.total_amount,
          status: order.status,
          created_at: order.created_at
        };
      });
    res.json({
      totalCustomers,
      totalOrders,
      totalCredit,
      recentOrders
    });
  } catch (error) {
    console.error('Error in getSalesDashboardStats:', error);
    res.status(500).json({ error: 'Failed to fetch sales dashboard stats' });
  }
}; 