import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { supabaseAdmin } from '../lib/supabase';
import { ApiError } from '../middleware/error';
import { stripeClient } from '../config';
import { scheduleOrderProcessing } from '../utils/orderScheduler';
import { hasAnyRole } from '../utils/roles';
import { OrderService } from '../services/core/OrderService';
import { ProductService } from '../services/core/ProductService';

// Get all orders (admin only)
export const getOrders = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }
    const {
      status,
      from_date,
      to_date,
      limit,
      page,
      order_type,
      order_source,
      fulfillment_type,
    } = req.query as {
      status?: string;
      from_date?: string;
      to_date?: string;
      limit?: string;
      page?: string;
      order_type?: string;
      order_source?: string;
      fulfillment_type?: string;
    };
    const userId = req.user.id;
    const userRoles = req.user?.roles || [];
    
    // Log to help with debugging
    console.log('getOrders for user ID:', userId, 'roles:', userRoles);
    
    // Check if user has admin or sales role
    const isAdmin = userRoles.includes('admin');
    const isSales = userRoles.includes('sales');
    
    if (!isAdmin && !isSales) {
      console.error('User does not have admin or sales role');
      throw new ApiError(403, 'Admin or Sales access required');
    }
    
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }
    
    // Get customer user IDs if user is sales (not admin)
    let customerUserIds: string[] | null = null;
    if (isSales && !isAdmin) {
      const { data: customers } = await (supabaseAdmin || supabase)
        .from('customers')
        .select('user_id')
        .eq('sales_executive_id', userId)
        .eq('company_id', req.companyId);
      
      customerUserIds = customers?.map(c => c.user_id).filter(Boolean) || [];
      
      if (customerUserIds.length === 0) {
        // No customers, return empty result
        return res.json({
          data: [],
          pagination: {
            total: 0,
            page: parseInt(page as string) || 1,
            limit: parseInt(limit as string) || 10,
            totalPages: 0
          }
        });
      }
    }
    
    // First get the total count (filtered by company_id and sales_executive if needed)
    let countQuery = (supabaseAdmin || supabase)
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', req.companyId);

    if (order_type) {
      countQuery = countQuery.eq('order_type', order_type);
    }
    if (order_source) {
      countQuery = countQuery.eq('order_source', order_source);
    }
    if (fulfillment_type) {
      countQuery = countQuery.eq('fulfillment_type', fulfillment_type);
    }
    
    if (customerUserIds) {
      countQuery = countQuery.in('user_id', customerUserIds);
    }
    
    const { count: totalCount } = await countQuery;
    
    let query = (supabaseAdmin || supabase)
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          products (*),
          variant:product_variants (
            id,
            name,
            sku,
            price:product_prices!price_id (
              sale_price,
              mrp_price
            ),
            brand:brands (
              id,
              name,
              logo_url
            ),
            tax:taxes (
              id,
              name,
              rate
            )
          )
        )
      `)
      .eq('company_id', req.companyId);
    
    // Filter by customer user IDs if user is sales (not admin)
    if (customerUserIds) {
      query = query.in('user_id', customerUserIds);
    }
    
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

    if (order_type) {
      query = query.eq('order_type', order_type);
    }
    if (order_source) {
      query = query.eq('order_source', order_source);
    }
    if (fulfillment_type) {
      query = query.eq('fulfillment_type', fulfillment_type);
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
    
    const orders = data || [];
    let enrichedOrders = orders;

    if (orders.length > 0) {
      const userIds = Array.from(new Set(orders.map(order => order.user_id).filter(Boolean)));
      if (userIds.length > 0) {
        const adminClient = supabaseAdmin || supabase;
        const { data: profiles, error: profilesError } = await adminClient
          .from('profiles')
          .select('id, email, first_name, last_name')
          .in('id', userIds);

        if (profilesError) {
          console.error('Error fetching order profiles:', profilesError);
        } else {
          const profileMap = new Map(profiles?.map(profile => [profile.id, profile]) || []);
          enrichedOrders = orders.map(order => ({
            ...order,
            profiles: order.user_id ? profileMap.get(order.user_id) || null : null
          }));
        }
      }
    }

    console.log(`Successfully fetched ${orders.length || 0} orders out of ${totalCount || 0} total orders`);
    
    res.status(200).json({
      success: true,
      count: totalCount || 0,
      data: enrichedOrders
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
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }
    const userId = req.user.id;
    
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }
    
    const { data, error } = await (supabaseAdmin || supabase)
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          products (*),
          variant:product_variants (
            id,
            name,
            sku,
            price:product_prices!price_id (
              sale_price,
              mrp_price
            ),
            brand:brands (
              id,
              name,
              logo_url
            ),
            tax:taxes (
              id,
              name,
              rate
            )
          )
        )
      `)
      .eq('user_id', userId)
      .eq('company_id', req.companyId)
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
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }
    const { id } = req.params;
    const userId = req.user.id;
    
    console.log('getOrderById, Order ID:', id, 'User ID:', userId);

    if (!req.companyId) {
      return res.status(400).json({ error: 'Company context is required' });
    }
    
    // Check roles using new role system
    const isAdmin = await hasAnyRole(req.user.id, req.companyId, ['admin']);
    const isSales = await hasAnyRole(req.user.id, req.companyId, ['sales']);
    
    console.log('User admin status:', isAdmin, 'User sales status:', isSales);
    
    // First, get the order details
    const { data: order, error: orderError } = await (supabaseAdmin || supabase)
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          product:products (
            *,
            images:product_images (*)
          ),
          variant:product_variants (
            id,
            name,
            sku,
            price:product_prices!price_id (
              sale_price,
              mrp_price
            ),
            brand:brands (
              id,
              name,
              logo_url
            ),
            tax:taxes (
              id,
              name,
              rate
            )
          )
        )
      `)
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();

    if (orderError) {
      console.error('Error fetching order:', orderError);
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Check access permission - admins can see all, sales executives can see their customers' orders
    let hasAccess = isAdmin;
    
    if (!hasAccess && isSales) {
      // For sales, check if this order belongs to their customer
      const { data: customer } = await (supabaseAdmin || supabase)
        .from('customers')
        .select('id, sales_executive_id')
        .eq('user_id', order.user_id)
        .eq('company_id', req.companyId)
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
    
    // Get order items with product and variant details
    const { data: orderItems, error: itemsError } = await (supabaseAdmin || supabase)
      .from('order_items')
      .select(`
        *,
        product:products (*),
        variant:product_variants (
          id,
          name,
          sku,
          price:product_prices!price_id (
            sale_price,
            mrp_price
          ),
          brand:brands (
            id,
            name,
            logo_url
          ),
          tax:taxes (
            id,
            name,
            rate
          )
        )
      `)
      .eq('order_id', id)
      .eq('company_id', req.companyId);
      
    if (itemsError) {
      console.error('Error fetching order items:', itemsError);
    }
      
    if (orderItems) {
      order.order_items = orderItems;
    }
    
    // Get credit details if applicable (for both credit and partial payment status)
    if (order.payment_status === 'credit' || order.payment_status === 'partial') {
      const { data: creditPeriod, error: creditError } = await (supabaseAdmin || supabase)
        .from('credit_periods')
        .select('*')
        .eq('order_id', id)
        .eq('company_id', req.companyId)
        .single();
      
      if (!creditError && creditPeriod) {
        order.credit_details = creditPeriod;
      }
    }

    // Get shipping address if available
    if (order.shipping_address_id) {
      const { data: shippingAddress, error: shippingAddressError } = await (supabaseAdmin || supabase)
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
      const { data: billingAddress, error: billingAddressError } = await (supabaseAdmin || supabase)
        .from('addresses')
        .select('*')
        .eq('id', order.billing_address_id)
        .single();
        
      if (!billingAddressError && billingAddress) {
        order.billing_address = billingAddress;
      }
    }

    // Get customer details
    const { data: customer, error: customerError } = await (supabaseAdmin || supabase)
      .from('customers')
      .select('*')
      .eq('user_id', order.user_id)
      .eq('company_id', req.companyId)
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
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }
    const userId = req.user.id;

    console.log('createOrder for user ID:', userId);
    console.log('Received payment_status from request body:', req_payment_status);
    console.log('Received payment_method:', payment_method);
    console.log('Received payment_intent_id:', payment_intent_id);
    
    if (!items || !items.length) {
      throw new ApiError(400, 'No items provided');
    }
    
    // Variables to store address IDs
    let finalShippingAddressId: string;
    let finalBillingAddressId: string;
    
    // If using existing addresses
    if (shipping_address_id) {
      // Add debug logging
      console.log('Checking shipping address:', shipping_address_id, 'for user:', userId);
      
      // Verify the shipping address exists and belongs to the user
      const { data: shippingAddr, error: shippingAddrError } = await (supabaseAdmin || supabase)
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
        const { data: billingAddr, error: billingAddrError } = await (supabaseAdmin || supabase)
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
      const { data: shippingAddr, error: shippingAddrError } = await (supabaseAdmin || supabase)
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
        const { data: billingAddr, error: billingAddrError } = await (supabaseAdmin || supabase)
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
    
    // Create order using OrderService
    console.log('Creating order with payment_status from request:', req_payment_status);
    
    // Determine final payment status
    let finalPaymentStatus = req_payment_status;
    if (payment_intent_id) {
      finalPaymentStatus = 'paid';
      console.log('Payment intent ID provided, setting payment_status to paid');
    }
    
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const orderService = new OrderService(req.companyId);

    // Transform items to OrderService format
    const orderItems = items.map((item: any) => ({
      productId: item.product_id,
      variantId: item.variant_id || null,
      quantity: item.quantity,
      unitPrice: item.price,
      outletId: item.warehouse_id || item.outlet_id || null,
    }));

    // Determine fulfillment type for ecommerce order
    const fulfillmentType: 'delivery' | 'pickup' =
      !!finalShippingAddressId ? 'delivery' : 'pickup';

    // Create order using OrderService
    const result = await orderService.createOrder(
      {
        items: orderItems,
        shippingAddressId: finalShippingAddressId,
        billingAddressId: finalBillingAddressId,
        paymentMethod: payment_method,
        paymentStatus: finalPaymentStatus,
        totalAmount: total_amount,
        paymentIntentId: payment_intent_id || undefined,
      },
      {
        userId,
        outletId: items[0]?.warehouse_id || items[0]?.outlet_id || null,
        industryContext: 'retail', // E-commerce orders are retail
        orderType: 'sales',
        orderSource: 'ecommerce',
        fulfillmentType,
      }
    );

    const order = await orderService.getOrderById(result.id);
    console.log('Order created in DB with ID:', result.id, 'and resulting payment_status:', order.payment_status);

    // Payment handling is done by OrderService.createOrder if payment_intent_id is provided
    // Additional payment linking logic can be added here if needed

    // If payment status is credit or partial, create credit period
    if (req_payment_status === 'full_credit' || req_payment_status === 'partial_payment') {
      console.log('Creating credit period for order:', result.id, 'request payment_status:', req_payment_status);
      const creditAmount = req_payment_status === 'full_credit' ? total_amount : (total_amount - (partial_payment_amount || 0));
      
      // First get the customer ID for this user
      const { data: customerData, error: customerError } = await (supabaseAdmin || supabase)
        .from('customers')
        .select('id')
        .eq('user_id', userId)
        .single();
        
      if (customerError) {
        console.error('Error finding customer:', customerError);
        // Rollback order creation
        await orderService.cancelOrder(result.id);
          
        return res.status(500).json({
          success: false,
          error: 'Error finding customer for credit period'
        });
      }
      
      // Calculate end date which is start_date + period days
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + (credit_period || 30));
      
      const { error: creditError } = await (supabaseAdmin || supabase)
        .from('credit_periods')
        .insert({
          order_id: result.id,
          amount: creditAmount,
          period: credit_period || 30,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          customer_id: customerData.id,  // Use the customer ID we just fetched
          type: 'credit',  // This is required based on the schema
          description: `Credit for order ${result.id}. Payment ${req_payment_status}.`
        });

      if (creditError) {
        console.error('Error creating credit period:', creditError);
        // Rollback order creation
        await orderService.cancelOrder(result.id);
        
        return res.status(500).json({
          success: false,
          error: 'Error creating credit period'
        });
      }
      console.log('Credit period created successfully for order:', result.id);
    }

    // Order items are created by OrderService.createOrder
    console.log('Order items created by OrderService');
    
    // Clear the user's cart
    console.log('Clearing cart...');
    const { data: cart } = await (supabaseAdmin || supabase)
      .from('carts')
      .select('id')
      .eq('user_id', userId)
      .single();
    
    if (cart) {
      const { error: cartError } = await (supabaseAdmin || supabase)
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
    scheduleOrderProcessing(result.id);
    console.log(`Order ${result.id} scheduled for automatic processing after 5 minutes`);

    res.status(201).json({
      success: true,
      data: {
        order_id: result.id
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
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }
    const userId = req.user.id;
    
    // Check roles using new role system
    const isAdmin = await hasAnyRole(userId, req.companyId, ['admin']);
    const isSales = await hasAnyRole(userId, req.companyId, ['sales']);
    
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
    const { data: currentOrder, error: currentOrderError } = await (supabaseAdmin || supabase)
      .from('orders')
      .select('*, order_items(product_id, quantity, warehouse_id), status, inventory_updated, user_id, payment_status')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();

    if (currentOrderError || !currentOrder) {
      throw new ApiError(404, 'Order not found');
    }
    
    // Check if the sales executive has permission to update this order
    let hasAccess = isAdmin; // Admins always have access
    
    if (!hasAccess && isSales) {
      // Check if this order belongs to a customer assigned to this sales exec
      const { data: customer, error: customerError } = await (supabaseAdmin || supabase)
        .from('customers')
        .select('sales_executive_id')
        .eq('user_id', currentOrder.user_id)
        .eq('company_id', req.companyId)
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
    
    // Check if this order was created through sales dashboard
    // Sales dashboard orders have a customer record associated with the user_id
    const { data: customer } = await (supabaseAdmin || supabase)
      .from('customers')
      .select('id')
      .eq('user_id', currentOrder.user_id)
      .single();
    
    const isSalesDashboardOrder = !!customer;
    
    // Use OrderService to update order status (handles inventory updates)
    const orderService = new OrderService(req.companyId!);
        
    // Update order status using OrderService
    await orderService.updateOrderStatus(id, status, {
      trackingNumber: tracking_number,
      estimatedDelivery: estimated_delivery,
      notes,
      paymentStatus: dbPaymentStatus || payment_status,
      paymentMethod: payment_method,
    });
    
    // Fetch updated order
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();
    
    if (error) {
      throw new ApiError(400, error.message);
    }
    
    // If payment status is changing and a payment method is provided, update credit_periods and customers tables
    if (isPaymentStatusChanging) {
      try {
        // Find associated credit period
        const { data: creditPeriod, error: creditError } = await (supabaseAdmin || supabase)
          .from('credit_periods')
          .select('*')
          .eq('order_id', id)
          .eq('company_id', req.companyId)
          .single();
          
        if (creditError) {
          console.error('Error finding credit period for order:', creditError);
        } else if (creditPeriod) {
          console.log('Found credit period:', creditPeriod);
          
          // Prepare credit period update data
          const creditUpdateData: any = {};
          
          let paymentAmountToProcess = 0;
          
          // Helper to append to existing description instead of overwriting
          const appendDescription = (entry: string) => {
            const existing = creditPeriod.description || '';
            return existing ? `${existing}\n${entry}` : entry;
          };
          
          // Handle different payment scenarios
          if (dbPaymentStatus === 'paid') {
            // Full payment - set amount to 0
            paymentAmountToProcess = parseFloat(creditPeriod.amount.toString());
            creditUpdateData.amount = 0;
            creditUpdateData.description = appendDescription(
              `Fully paid off on ${new Date().toISOString().split('T')[0]} via ${payment_method}`
            );
          } else if (dbPaymentStatus === 'partial' && partial_payment_amount) {
            const currentAmount = parseFloat(creditPeriod.amount.toString());
            // Ensure payment amount is a number
            const parsedPaymentAmount = parseFloat(partial_payment_amount.toString());
            
            // Partial payment - reduce the amount
            if (parsedPaymentAmount >= currentAmount) {
              // If payment is greater than or equal to the balance, treat as full payment
              paymentAmountToProcess = currentAmount;
              creditUpdateData.amount = 0;
              creditUpdateData.description = appendDescription(
                `Fully paid off on ${new Date().toISOString().split('T')[0]} via ${payment_method}`
              );
            } else {
              // Regular partial payment
              paymentAmountToProcess = parsedPaymentAmount;
              const remainingAmount = currentAmount - parsedPaymentAmount;
              creditUpdateData.amount = remainingAmount;
              creditUpdateData.description = appendDescription(
                `Partial payment of $${parsedPaymentAmount.toFixed(2)} received on ${new Date().toISOString().split('T')[0]} via ${payment_method}. Remaining: $${remainingAmount.toFixed(2)}`
              );
            }
          }
          
          // Only proceed with updates if there's a valid payment amount or we're marking as paid
          if (paymentAmountToProcess > 0 || dbPaymentStatus === 'paid') {
            console.log('[OrderUpdate] Attempting to update credit_periods for ID:', creditPeriod.id, 'with data:', JSON.stringify(creditUpdateData));
            
            // Update credit period
            const { data: updatedCpData, error: updateCreditError } = await (supabaseAdmin || supabase)
              .from('credit_periods')
              .update(creditUpdateData)
              .eq('id', creditPeriod.id)
              .eq('company_id', req.companyId)
              .select(); // Added .select() to get the result of the update

            if (updateCreditError) {
              console.error('[OrderUpdate] Error updating credit period:', updateCreditError);
            } else {
              console.log('[OrderUpdate] Credit period updated successfully. Result:', JSON.stringify(updatedCpData));
              
              // Find the customer record for this order
              const { data: customer, error: customerError } = await (supabaseAdmin || supabase)
                .from('customers')
                .select('id, current_credit')
                .eq('user_id', currentOrder.user_id)
                .eq('company_id', req.companyId)
                .single();
                
              if (customerError) {
                console.error('Error finding customer:', customerError);
              } else if (customer && paymentAmountToProcess > 0) {
                // Update customer's current_credit
                const currentCredit = parseFloat(customer.current_credit.toString());
                const newCreditAmount = Math.max(0, currentCredit - paymentAmountToProcess);
                
                const { error: customerUpdateError } = await (supabaseAdmin || supabase)
                  .from('customers')
                  .update({ current_credit: newCreditAmount })
                  .eq('id', customer.id)
                  .eq('company_id', req.companyId);
                  
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
      const { data: creditPeriod, error: creditError } = await (supabaseAdmin || supabase)
        .from('credit_periods')
        .select('*')
        .eq('order_id', id)
        .eq('company_id', req.companyId)
        .single();
        
      if (!creditError && creditPeriod) {
        console.log('Found credit period for cancelled order:', creditPeriod);
        
        // Get the customer record
        const { data: customer, error: customerError } = await (supabaseAdmin || supabase)
          .from('customers')
          .select('id, current_credit')
          .eq('user_id', currentOrder.user_id)
          .eq('company_id', req.companyId)
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
          const { error: updateError } = await (supabaseAdmin || supabase)
            .from('customers')
            .update({ current_credit: newCreditAmount })
            .eq('id', customer.id)
            .eq('company_id', req.companyId);
            
          if (updateError) {
            console.error('Error updating customer credit after cancellation:', updateError);
          } else {
            console.log('Customer credit updated successfully after cancellation');
          }
        }
        
        // Mark credit period as cancelled and append to its description (no status field)
        const existingDescription = creditPeriod.description || '';
        const cancellationEntry = `Order Cancelled on ${new Date().toISOString().split('T')[0]}`;
        const newDescription = existingDescription
          ? `${existingDescription}\n${cancellationEntry}`
          : cancellationEntry;

        const creditUpdateResult = await (supabaseAdmin || supabase)
          .from('credit_periods')
          .update({
            description: newDescription,
            // amount: 0, // Set amount to 0 since the credit is cancelled
            end_date: new Date().toISOString().split('T')[0] // Set end date to current date
          })
          .eq('id', creditPeriod.id)
          .eq('company_id', req.companyId);
        if (creditUpdateResult.error) {
          console.error('Error updating credit period:', creditUpdateResult.error);
        } else {
          console.log('Credit period updated successfully');
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
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }
    const { id } = req.params; // Order ID from URL
    const userId = req.user.id; // Currently logged-in user
    const userRole = req.user.role; // Role from token (e.g., 'user', 'admin', 'sales')

    console.log(`Attempting to cancel order ${id} by user ${userId} with role ${userRole}`);

    // Fetch the order
    let orderQuery = (supabaseAdmin || supabase)
      .from('orders')
      .select('*, order_items(product_id, quantity, warehouse_id), user_id') // Ensure user_id is selected
      .eq('id', id)
      .eq('company_id', req.companyId)
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
      const { data: customer } = await (supabaseAdmin || supabase)
        .from('customers')
        .select('sales_executive_id')
        .eq('user_id', order.user_id)
        .eq('company_id', req.companyId)
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
    
    // Use OrderService to cancel order (handles inventory restoration)
    const orderService = new OrderService(req.companyId!);
    await orderService.cancelOrder(id);
    
    // Fetch updated order
    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();
    
    if (updateError) {
      throw new ApiError(400, updateError.message);
    }
    
    // After updating the order status to cancelled, update the associated credit period if it exists
    const { data: creditPeriod, error: creditError } = await (supabaseAdmin || supabase)
      .from('credit_periods')
      .select('*')
      .eq('order_id', id)
      .eq('company_id', req.companyId)
      .single();
    console.log('[CancelOrder] creditPeriod lookup result:', { creditPeriod, creditError });
    if (!creditError && creditPeriod) {
      console.log('[CancelOrder] Found credit period for cancelled order:', creditPeriod);
      // Get the customer record
      const { data: customer, error: customerError } = await (supabaseAdmin || supabase)
        .from('customers')
        .select('id, current_credit')
        .eq('user_id', order.user_id)
        .eq('company_id', req.companyId)
        .single();
      if (!customerError && customer) {
        // Calculate new current_credit by subtracting the credit amount
        const currentCredit = parseFloat(customer.current_credit.toString());
        const creditAmount = parseFloat(creditPeriod.amount.toString());
        const newCreditAmount = Math.max(0, currentCredit - creditAmount);
        // Update customer's current_credit
        const { error: updateError } = await (supabaseAdmin || supabase)
          .from('customers')
          .update({ current_credit: newCreditAmount })
          .eq('id', customer.id)
          .eq('company_id', req.companyId);
        if (updateError) {
          console.error('[CancelOrder] Error updating customer credit after cancellation:', updateError);
        } else {
          console.log('[CancelOrder] Customer credit updated successfully after cancellation');
        }
      }
      // Mark credit period as cancelled and update its description (no status field)
      const creditUpdateResult = await (supabaseAdmin || supabase)
        .from('credit_periods')
        .update({
          description: 'Order Cancelled',
          amount: 0, // Set amount to 0 since the credit is cancelled
          end_date: new Date().toISOString().split('T')[0] // Set end date to current date
        })
        .eq('id', creditPeriod.id)
        .eq('company_id', req.companyId);
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
    if (!req.companyId) {
      return res.status(400).json({ error: 'Company context is required' });
    }
    
    const userId = req.user?.id;
    const userRoles = req.user?.roles || [];
    const isAdmin = userRoles.includes('admin');
    const isSales = userRoles.includes('sales');
    
    if (!isAdmin && !isSales) {
      return res.status(403).json({ error: 'Admin or Sales access required' });
    }
    
    console.log('Fetching orders for user:', userId, 'isAdmin:', isAdmin, 'isSales:', isSales);

    // Get all customers - filter by sales_executive_id only if user is sales (not admin)
    let customerQuery = (supabaseAdmin || supabase)
      .from('customers')
      .select('id, user_id, name, sales_executive_id')
      .eq('company_id', req.companyId);
    
    if (isSales && !isAdmin) {
      customerQuery = customerQuery.eq('sales_executive_id', userId);
    }
    
    const { data: customers, error: customersError } = await customerQuery;

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

    const { data: orders, error: ordersError } = await (supabaseAdmin || supabase)
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          product:products (*),
          variant:product_variants (
            id,
            name,
            sku,
            price:product_prices!price_id (
              sale_price,
              mrp_price
            ),
            brand:brands (
              id,
              name,
              logo_url
            ),
            tax:taxes (
              id,
              name,
              rate
            )
          )
        ),
        credit_periods (*)
      `)
      .in('user_id', customerUserIds)
      .eq('company_id', req.companyId)
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
    if (!req.companyId) {
      return res.status(400).json({ error: 'Company context is required' });
    }
    
    const userId = req.user?.id;
    const userRoles = req.user?.roles || [];
    const isAdmin = userRoles.includes('admin');
    const isSales = userRoles.includes('sales');
    
    if (!isAdmin && !isSales) {
      return res.status(403).json({ error: 'Admin or Sales access required' });
    }
    
    // Get all customers - filter by sales_executive_id only if user is sales (not admin)
    let customerQuery = (supabaseAdmin || supabase)
      .from('customers')
      .select('id, user_id, name, current_credit')
      .eq('company_id', req.companyId);
    
    if (isSales && !isAdmin) {
      customerQuery = customerQuery.eq('sales_executive_id', userId);
    }
    
    const { data: customers, error: customersError } = await customerQuery;
    if (customersError) {
      console.error('Error fetching customers:', customersError);
      return res.status(500).json({ error: 'Failed to fetch customers' });
    }
    const totalCustomers = customers?.length || 0;
    const customerUserIds = customers.map(c => c.user_id);
    // Get all orders for these customers (filtered by company_id)
    const { data: orders, error: ordersError } = await (supabaseAdmin || supabase)
      .from('orders')
      .select('id, user_id, total_amount, status, created_at, order_type')
      .in('user_id', customerUserIds)
      .eq('company_id', req.companyId)
      .eq('order_type', 'sales');
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

// Get detailed sales analytics for sales executive
export const getSalesAnalytics = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      return res.status(400).json({ error: 'Company context is required' });
    }
    
    const userId = req.user?.id;
    const userRoles = req.user?.roles || [];
    const isAdmin = userRoles.includes('admin');
    const isSales = userRoles.includes('sales');
    
    if (!isAdmin && !isSales) {
      return res.status(403).json({ error: 'Admin or Sales access required' });
    }
    
    const { period = '30' } = req.query; // Default to last 30 days
    const days = parseInt(period as string, 10);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all customers - filter by sales_executive_id only if user is sales (not admin)
    let customerQuery = (supabaseAdmin || supabase)
      .from('customers')
      .select('id, user_id, name, current_credit, credit_limit')
      .eq('company_id', req.companyId);
    
    if (isSales && !isAdmin) {
      customerQuery = customerQuery.eq('sales_executive_id', userId);
    }
    
    const { data: customers, error: customersError } = await customerQuery;

    if (customersError) {
      console.error('Error fetching customers:', customersError);
      return res.status(500).json({ error: 'Failed to fetch customers' });
    }

    const customerUserIds = customers?.map(c => c.user_id) || [];

    if (customerUserIds.length === 0) {
      return res.json({
        revenue: {
          total: 0,
          paid: 0,
          credit: 0,
          daily: [],
          monthly: []
        },
        orders: {
          total: 0,
          byStatus: {},
          byPaymentMethod: {},
          daily: []
        },
        customers: {
          total: customers?.length || 0,
          topCustomers: [],
          creditSummary: {
            totalCredit: 0,
            totalLimit: 0,
            utilizationRate: 0
          }
        },
        products: {
          topProducts: []
        },
        trends: {
          revenueGrowth: 0,
          orderGrowth: 0
        }
      });
    }

    // Get all orders for these customers within the date range (filtered by company_id)
    const { data: orders, error: ordersError } = await (supabaseAdmin || supabase)
      .from('orders')
      .select(
        'id, user_id, total_amount, status, payment_status, payment_method, created_at, order_type'
      )
      .in('user_id', customerUserIds)
      .eq('company_id', req.companyId)
      .eq('order_type', 'sales')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return res.status(500).json({ error: 'Failed to fetch orders' });
    }

    const filteredOrders = orders?.filter(order => order.status !== 'cancelled') || [];

    // Get credit periods for orders with partial or credit payments to calculate actual amounts (filtered by company_id)
    const orderIds = filteredOrders.map(o => o.id);
    const { data: creditPeriods, error: creditError } = await (supabaseAdmin || supabase)
      .from('credit_periods')
      .select('order_id, amount')
      .in('order_id', orderIds)
      .eq('company_id', req.companyId);

    // Create a map of order_id to credit amount (unpaid amount)
    const creditAmountMap = new Map<string, number>();
    if (creditPeriods && !creditError) {
      creditPeriods.forEach(cp => {
        creditAmountMap.set(cp.order_id, parseFloat(cp.amount?.toString() || '0'));
      });
    }

    // Calculate revenue metrics
    const totalRevenue = filteredOrders.reduce((sum, order) => sum + parseFloat(order.total_amount || '0'), 0);
    
    // Paid Revenue: Full payment orders (full amount) + Partial payment orders (only the paid portion)
    const paidRevenue = filteredOrders.reduce((sum, order) => {
      if (order.payment_status === 'full_payment' || order.payment_status === 'paid') {
        // Full payment - count entire amount
        return sum + parseFloat(order.total_amount || '0');
      } else if (order.payment_status === 'partial_payment' || order.payment_status === 'partial') {
        // Partial payment - calculate paid amount: total_amount - unpaid_amount (from credit_periods)
        const totalAmount = parseFloat(order.total_amount || '0');
        const unpaidAmount = creditAmountMap.get(order.id) || 0;
        const paidAmount = totalAmount - unpaidAmount;
        return sum + Math.max(0, paidAmount); // Ensure non-negative
      }
      return sum;
    }, 0);
    
    // Credit Revenue: Full credit orders (full amount) + Partial payment orders (unpaid portion)
    const creditRevenue = filteredOrders.reduce((sum, order) => {
      if (order.payment_status === 'credit' || order.payment_status === 'full_credit') {
        // Full credit - count entire amount
        return sum + parseFloat(order.total_amount || '0');
      } else if (order.payment_status === 'partial_payment' || order.payment_status === 'partial') {
        // Partial payment - count only the unpaid portion (from credit_periods)
        const unpaidAmount = creditAmountMap.get(order.id) || 0;
        return sum + unpaidAmount;
      }
      return sum;
    }, 0);

    // Daily revenue breakdown
    const dailyRevenue: { [key: string]: number } = {};
    filteredOrders.forEach(order => {
      const date = new Date(order.created_at).toISOString().split('T')[0];
      dailyRevenue[date] = (dailyRevenue[date] || 0) + parseFloat(order.total_amount || '0');
    });

    const dailyRevenueArray = Object.entries(dailyRevenue)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Monthly revenue breakdown
    const monthlyRevenue: { [key: string]: number } = {};
    filteredOrders.forEach(order => {
      const date = new Date(order.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + parseFloat(order.total_amount || '0');
    });

    const monthlyRevenueArray = Object.entries(monthlyRevenue)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Orders by status
    const ordersByStatus: { [key: string]: number } = {};
    filteredOrders.forEach(order => {
      ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1;
    });

    // Orders by payment method
    const ordersByPaymentMethod: { [key: string]: number } = {};
    filteredOrders.forEach(order => {
      const method = order.payment_method || 'unknown';
      ordersByPaymentMethod[method] = (ordersByPaymentMethod[method] || 0) + 1;
    });

    // Daily orders count
    const dailyOrders: { [key: string]: number } = {};
    filteredOrders.forEach(order => {
      const date = new Date(order.created_at).toISOString().split('T')[0];
      dailyOrders[date] = (dailyOrders[date] || 0) + 1;
    });

    const dailyOrdersArray = Object.entries(dailyOrders)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Top customers by revenue
    const customerRevenue: { [key: string]: { name: string; revenue: number; orderCount: number } } = {};
    filteredOrders.forEach(order => {
      const customer = customers?.find(c => c.user_id === order.user_id);
      if (customer) {
        if (!customerRevenue[customer.id]) {
          customerRevenue[customer.id] = {
            name: customer.name,
            revenue: 0,
            orderCount: 0
          };
        }
        customerRevenue[customer.id].revenue += parseFloat(order.total_amount || '0');
        customerRevenue[customer.id].orderCount += 1;
      }
    });

    const topCustomers = Object.entries(customerRevenue)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Credit summary
    const totalCredit = customers?.reduce((sum, c) => sum + parseFloat(c.current_credit || '0'), 0) || 0;
    const totalLimit = customers?.reduce((sum, c) => sum + parseFloat(c.credit_limit || '0'), 0) || 0;
    const utilizationRate = totalLimit > 0 ? (totalCredit / totalLimit) * 100 : 0;

    // Get top products (need to fetch order items with variant pricing) (filtered by company_id)
    const productOrderIds = filteredOrders.map(o => o.id);
    const { data: orderItems, error: itemsError } = await (supabaseAdmin || supabase)
      .from('order_items')
      .select(`
        product_id,
        variant_id,
        quantity,
        unit_price,
        product:products(name),
        variant:product_variants (
          id,
          name,
          price:product_prices!price_id (
            sale_price,
            mrp_price
          )
        )
      `)
      .in('order_id', productOrderIds)
      .eq('company_id', req.companyId);

    const productSales: { [key: string]: { name: string; quantity: number; revenue: number } } = {};
    if (orderItems && !itemsError) {
      orderItems.forEach(item => {
        const productId = item.product_id;
        const productName = (item.product as any)?.name || 'Unknown Product';
        
        // Use variant pricing if available, otherwise fallback to unit_price
        let itemPrice = item.unit_price || 0;
        const variant = Array.isArray(item.variant) ? item.variant[0] : item.variant;
        if (variant?.price) {
          const price = Array.isArray(variant.price) ? variant.price[0] : variant.price;
          if (price) {
            itemPrice = parseFloat(price.sale_price?.toString() || price.mrp_price?.toString() || '0');
          }
        }
        
        if (!productSales[productId]) {
          productSales[productId] = {
            name: productName,
            quantity: 0,
            revenue: 0
          };
        }
        productSales[productId].quantity += item.quantity || 0;
        productSales[productId].revenue += (item.quantity || 0) * itemPrice;
      });
    }

    const topProducts = Object.entries(productSales)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Calculate growth trends (compare first half vs second half of period)
    const midpoint = new Date(startDate.getTime() + (endDate.getTime() - startDate.getTime()) / 2);
    const firstHalfOrders = filteredOrders.filter(o => new Date(o.created_at) < midpoint);
    const secondHalfOrders = filteredOrders.filter(o => new Date(o.created_at) >= midpoint);

    const firstHalfRevenue = firstHalfOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || '0'), 0);
    const secondHalfRevenue = secondHalfOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || '0'), 0);
    const revenueGrowth = firstHalfRevenue > 0 ? ((secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue) * 100 : 0;

    const orderGrowth = firstHalfOrders.length > 0 
      ? ((secondHalfOrders.length - firstHalfOrders.length) / firstHalfOrders.length) * 100 
      : 0;

    // Get current active sales target (filtered by company_id)
    const today = new Date().toISOString().split('T')[0];
    let targetQuery = (supabaseAdmin || supabase)
      .from('sales_targets')
      .select('*')
      .eq('company_id', req.companyId)
      .eq('is_active', true)
      .lte('period_start', today)
      .gte('period_end', today)
      .order('period_start', { ascending: false })
      .limit(1);
    
    // Filter by sales_executive_id only if user is sales (not admin)
    if (isSales && !isAdmin && userId) {
      targetQuery = targetQuery.eq('sales_executive_id', userId);
    }
    
    const { data: currentTarget } = await targetQuery.single();

    let targetProgress = null;
    if (currentTarget) {
      const targetAmount = parseFloat(currentTarget.target_amount?.toString() || '0');
      const progressPercentage = targetAmount > 0 ? (totalRevenue / targetAmount) * 100 : 0;
      const remaining = Math.max(0, targetAmount - totalRevenue);
      
      targetProgress = {
        targetAmount,
        currentRevenue: totalRevenue,
        progressPercentage: Math.round(progressPercentage * 100) / 100,
        remaining,
        periodType: currentTarget.period_type,
        periodStart: currentTarget.period_start,
        periodEnd: currentTarget.period_end
      };
    }

    res.json({
      revenue: {
        total: totalRevenue,
        paid: paidRevenue,
        credit: creditRevenue,
        daily: dailyRevenueArray,
        monthly: monthlyRevenueArray
      },
      orders: {
        total: filteredOrders.length,
        byStatus: ordersByStatus,
        byPaymentMethod: ordersByPaymentMethod,
        daily: dailyOrdersArray
      },
      customers: {
        total: customers?.length || 0,
        topCustomers,
        creditSummary: {
          totalCredit,
          totalLimit,
          utilizationRate: Math.round(utilizationRate * 100) / 100
        }
      },
      products: {
        topProducts
      },
      trends: {
        revenueGrowth: Math.round(revenueGrowth * 100) / 100,
        orderGrowth: Math.round(orderGrowth * 100) / 100
      },
      target: targetProgress
    });
  } catch (error) {
    console.error('Error in getSalesAnalytics:', error);
    res.status(500).json({ error: 'Failed to fetch sales analytics' });
  }
};

// Create return order
export const createReturnOrder = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }

    const { original_order_id, items, reason } = req.body;

    if (!original_order_id) {
      throw new ApiError(400, 'original_order_id is required');
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ApiError(400, 'At least one return item is required');
    }

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const userId = req.user.id;
    const userRoles = req.user?.roles || [];
    const isAdmin = userRoles.includes('admin');
    const isSales = userRoles.includes('sales');

    // Fetch original order with order_items
    const { data: originalOrder, error: orderError } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          product_id,
          variant_id,
          quantity,
          unit_price,
          warehouse_id
        )
      `)
      .eq('id', original_order_id)
      .eq('company_id', req.companyId)
      .single();

    if (orderError || !originalOrder) {
      throw new ApiError(404, 'Original order not found');
    }

    // Validate original order
    if (originalOrder.order_type !== 'sales') {
      throw new ApiError(400, 'Can only return sales orders');
    }

    if (originalOrder.status === 'cancelled') {
      throw new ApiError(400, 'Cannot return a cancelled order');
    }

    // Permission check
    let hasPermission = false;
    if (isAdmin || isSales) {
      // Admin/sales can return any order
      hasPermission = true;
    } else {
      // Customer can only return their own orders
      if (originalOrder.user_id === userId) {
        hasPermission = true;
      }
    }

    if (!hasPermission) {
      throw new ApiError(403, 'You do not have permission to return this order');
    }

    // Validate return items
    const originalItemsMap = new Map();
    (originalOrder.order_items || []).forEach((item: any) => {
      const key = `${item.product_id}_${item.variant_id || 'default'}`;
      if (!originalItemsMap.has(key)) {
        originalItemsMap.set(key, []);
      }
      originalItemsMap.get(key).push(item);
    });

    // Track quantities returned per item (for partial returns)
    const returnedQuantities = new Map<string, number>();

    // Check for existing returns for this order
    const { data: existingReturns } = await supabaseAdmin
      .from('orders')
      .select('id, order_items(product_id, variant_id, quantity)')
      .eq('original_order_id', original_order_id)
      .eq('company_id', req.companyId)
      .eq('order_type', 'return')
      .neq('status', 'cancelled');

    // Calculate already returned quantities
    existingReturns?.forEach((returnOrder: any) => {
      (returnOrder.order_items || []).forEach((item: any) => {
        const key = `${item.product_id}_${item.variant_id || 'default'}`;
        const current = returnedQuantities.get(key) || 0;
        returnedQuantities.set(key, current + (item.quantity || 0));
      });
    });

    // Validate each return item
    const validatedItems: Array<{
      productId: string;
      variantId: string;
      quantity: number;
      unitPrice: number;
      outletId: string | null;
    }> = [];

    for (const returnItem of items) {
      if (!returnItem.product_id) {
        throw new ApiError(400, 'Each return item must have product_id');
      }

      if (!returnItem.quantity || returnItem.quantity <= 0) {
        throw new ApiError(400, 'Each return item must have a positive quantity');
      }

      // Find matching original item
      const variantId = returnItem.variant_id || null;
      const key = `${returnItem.product_id}_${variantId || 'default'}`;
      const matchingOriginalItems = originalItemsMap.get(key) || [];

      if (matchingOriginalItems.length === 0) {
        throw new ApiError(400, `Item with product_id ${returnItem.product_id} and variant_id ${variantId || 'default'} not found in original order`);
      }

      // Calculate total original quantity for this product+variant
      const totalOriginalQuantity = matchingOriginalItems.reduce(
        (sum: number, item: any) => sum + (item.quantity || 0),
        0
      );

      // Calculate already returned quantity
      const alreadyReturned = returnedQuantities.get(key) || 0;

      // Calculate available quantity for return
      const availableForReturn = totalOriginalQuantity - alreadyReturned;

      if (returnItem.quantity > availableForReturn) {
        throw new ApiError(409, `Return quantity ${returnItem.quantity} exceeds available quantity ${availableForReturn} for product ${returnItem.product_id}`);
      }

      // Get variant ID (use provided or get default)
      let finalVariantId: string;
      if (variantId) {
        finalVariantId = variantId;
      } else {
        // Get default variant
        const productService = new ProductService(req.companyId);
        const defaultVariant = await productService.getDefaultVariant(returnItem.product_id);
        finalVariantId = defaultVariant.id;
      }

      // Use first matching original item's price and warehouse
      const originalItem = matchingOriginalItems[0];
      validatedItems.push({
        productId: returnItem.product_id,
        variantId: finalVariantId,
        quantity: returnItem.quantity,
        unitPrice: originalItem.unit_price,
        outletId: originalItem.warehouse_id || originalOrder.outlet_id,
      });

      // Update returned quantities map
      const currentReturned = returnedQuantities.get(key) || 0;
      returnedQuantities.set(key, currentReturned + returnItem.quantity);
    }

    // Check for duplicate items (same product_id + variant_id)
    const itemKeys = new Set();
    for (const item of validatedItems) {
      const key = `${item.productId}_${item.variantId}`;
      if (itemKeys.has(key)) {
        throw new ApiError(400, `Duplicate return item: product_id ${item.productId}, variant_id ${item.variantId}`);
      }
      itemKeys.add(key);
    }

    // Calculate return amount
    const returnAmount = validatedItems.reduce(
      (sum, item) => sum + (item.quantity * item.unitPrice),
      0
    );

    // Create return order using OrderService
    const orderService = new OrderService(req.companyId);

    const returnOrderItems = validatedItems.map(item => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      outletId: item.outletId || undefined,
    }));

    const returnNotes = reason
      ? `Return for order ${original_order_id}. Reason: ${reason}`
      : `Return for order ${original_order_id}`;

    const result = await orderService.createOrder(
      {
        items: returnOrderItems,
        shippingAddressId: originalOrder.shipping_address_id,
        billingAddressId: originalOrder.billing_address_id,
        paymentMethod: originalOrder.payment_method,
        paymentStatus: 'pending',
        totalAmount: returnAmount,
        notes: returnNotes,
      },
      {
        userId: originalOrder.user_id, // Keep same user as original order
        outletId: originalOrder.outlet_id,
        industryContext: originalOrder.industry_context || 'retail',
        orderType: 'return',
        orderSource: originalOrder.order_source || 'ecommerce',
        fulfillmentType: originalOrder.fulfillment_type || 'delivery',
        originalOrderId: original_order_id,
      }
    );

    // Fetch complete return order
    const returnOrder = await orderService.getOrderById(result.id);

    res.status(201).json({
      success: true,
      data: {
        ...returnOrder,
        original_order: {
          id: originalOrder.id,
          order_number: originalOrder.order_number,
          total_amount: originalOrder.total_amount,
          status: originalOrder.status,
        },
      },
    });
  } catch (error) {
    console.error('Error in createReturnOrder:', error);
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Error creating return order',
      });
    }
  }
}; 