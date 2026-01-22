import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { supabaseAdmin } from '../lib/supabase';
import { ApiError } from '../middleware/error';
import { stripe } from '../config/stripe';

// Create a payment intent
export const createPaymentIntent = async (req: Request, res: Response) => {
  try {
    const { amount, order_id, currency = 'usd' } = req.body;
    const userId = req.user?.id || 'anonymous';

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }
    
    if (!amount) {
      throw new ApiError(400, 'Please provide amount');
    }
    
    // Validate amount is a positive number
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      throw new ApiError(400, 'Amount must be a positive number');
    }
    
    console.log('Creating payment intent for amount:', numericAmount, 'currency:', currency, 'order_id:', order_id);
    
    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(numericAmount * 100), // Convert to cents
      currency,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        user_id: userId,
        order_id: order_id || 'pending_order',
        source: 'web_checkout'
      }
    });
    
    console.log('Payment intent created successfully:', paymentIntent.id);
    
    // If order_id is provided, update the order
    if (order_id && req.user?.id) {
      try {
        await supabase
          .from('orders')
          .update({
            payment_intent_id: paymentIntent.id
          })
          .eq('id', order_id)
          .eq('user_id', req.user.id)
          .eq('company_id', req.companyId);
      } catch (orderError) {
        console.warn('Could not update order with payment intent ID:', orderError);
      }
    }
    
    res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error creating payment intent');
  }
};

// Get payment by ID
export const getPaymentById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }
    
    // Get payment from database
    const { data: payment, error: dbError } = await supabase
      .from('payments')
      .select('*')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();
    
    if (dbError || !payment) {
      throw new ApiError(404, 'Payment not found');
    }
    
    // Verify payment belongs to user by checking the order
    if (payment.order_id) {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('user_id')
        .eq('id', payment.order_id)
        .eq('company_id', req.companyId)
        .single();
      
      if (orderError || !order || order.user_id !== userId) {
        throw new ApiError(403, 'Not authorized to view this payment');
      }
    }
    
    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error retrieving payment');
  }
};

// Get payment history for user
export const getPaymentHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }
    
    // Get user's orders first
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id')
      .eq('user_id', userId)
      .eq('company_id', req.companyId);
    
    if (ordersError) {
      throw new ApiError(500, 'Error fetching user orders');
    }
    
    const orderIds = orders?.map(order => order.id) || [];
    
    // Get payments for user's orders
    const { data: payments, error: paymentsError, count } = await supabase
      .from('payments')
      .select('*', { count: 'exact' })
      .in('order_id', orderIds)
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    
    if (paymentsError) {
      throw new ApiError(500, 'Error fetching payment history');
    }
    
    res.status(200).json({
      success: true,
      data: payments || [],
      count: count || 0,
      page,
      limit
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error retrieving payment history');
  }
};

// Handle Stripe webhook events
export const handleStripeWebhook = async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'] as string;
  
  if (!signature) {
    return res.status(400).json({ success: false, message: 'Missing Stripe signature' });
  }
  
  try {
    // Verify webhook signature
    const event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
    
    console.log('Webhook event received:', event.type);
    
    // Handle specific events
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailure(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ success: false, message: 'Webhook signature verification failed' });
  }
};

// Helper to handle successful payments
const handlePaymentSuccess = async (paymentIntent: any) => {
  const { order_id, user_id } = paymentIntent.metadata;
  
  console.log('Payment succeeded:', {
    paymentIntentId: paymentIntent.id,
    orderId: order_id,
    userId: user_id,
    amount: paymentIntent.amount / 100
  });
  
  try {
    let companyId: string | null = null;
    if (order_id && order_id !== 'pending_order') {
      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .select('company_id')
        .eq('id', order_id)
        .single();

      if (orderError) {
        console.error('Error fetching order company_id:', orderError);
      } else {
        companyId = order?.company_id || null;
      }
    }

    if (!companyId) {
      console.warn('Skipping payment success handling due to missing company_id', {
        paymentIntentId: paymentIntent.id,
        orderId: order_id
      });
      return;
    }

    // Check if a payment record already exists for this payment intent
    let existingPaymentQuery = supabaseAdmin
      .from('payments')
      .select('id, order_id')
      .eq('stripe_payment_intent_id', paymentIntent.id);

    if (companyId) {
      existingPaymentQuery = existingPaymentQuery.eq('company_id', companyId);
    }

    const { data: existingPayment, error: checkError } = await existingPaymentQuery.single();

    if (existingPayment) {
      console.log('Payment record already exists for payment intent:', paymentIntent.id);
      
      // If we have an order_id and the existing payment doesn't have one, update it
      if (order_id && order_id !== 'pending_order' && !existingPayment.order_id) {
        console.log('Updating existing payment record with order_id:', order_id);
        
        let updatePaymentQuery = supabaseAdmin
          .from('payments')
          .update({
            order_id: order_id,
            updated_at: new Date()
          })
          .eq('id', existingPayment.id);

        if (companyId) {
          updatePaymentQuery = updatePaymentQuery.eq('company_id', companyId);
        }

        const { error: updateError } = await updatePaymentQuery;

        if (updateError) {
          console.error('Error updating payment record with order_id:', updateError);
        } else {
          console.log('Successfully updated payment record with order_id');
        }
      }
      
      // Update order if we have a valid order_id
      if (order_id && order_id !== 'pending_order') {
        let orderUpdateQuery = supabaseAdmin
          .from('orders')
          .update({
            payment_status: 'paid',
            payment_intent_id: paymentIntent.id,
            updated_at: new Date()
          })
          .eq('id', order_id);

        if (companyId) {
          orderUpdateQuery = orderUpdateQuery.eq('company_id', companyId);
        }

        const { error: orderUpdateError } = await orderUpdateQuery;

        if (orderUpdateError) {
          console.error('Error updating order payment status:', orderUpdateError);
        } else {
          console.log('Successfully updated order payment status');
        }
      }
      
      return; // Exit early since we already have a payment record
    }

    // Create new payment record only if one doesn't exist
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert({
        order_id: order_id !== 'pending_order' ? order_id : null,
        amount: paymentIntent.amount / 100,
        status: 'completed',
        payment_method: paymentIntent.payment_method_types[0] || 'card',
        stripe_payment_intent_id: paymentIntent.id,
        company_id: companyId,
        payment_gateway_response: {
          source: 'stripe_webhook',
          payment_intent_id: paymentIntent.id,
          created_at: new Date().toISOString()
        },
        transaction_references: {
          stripe_payment_intent_id: paymentIntent.id,
          webhook_processed: true
        }
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Error creating payment record:', paymentError);
      return;
    }

    console.log('Payment record created successfully:', payment.id);

    // Update order if we have a valid order_id (not pending_order)
    if (order_id && order_id !== 'pending_order') {
      let orderUpdateQuery = supabaseAdmin
        .from('orders')
        .update({
          payment_status: 'paid',
          payment_intent_id: paymentIntent.id,
          updated_at: new Date()
        })
        .eq('id', order_id);

      if (companyId) {
        orderUpdateQuery = orderUpdateQuery.eq('company_id', companyId);
      }

      const { error: orderUpdateError } = await orderUpdateQuery;

      if (orderUpdateError) {
        console.error('Error updating order payment status:', orderUpdateError);
      } else {
        console.log('Successfully updated order payment status');
      }
    } else {
      console.log('Payment succeeded for pending order - order will be updated when created');
    }
  } catch (error) {
    console.error('Error in handlePaymentSuccess:', error);
  }
};

// Helper to handle failed payments
const handlePaymentFailure = async (paymentIntent: any) => {
  const { order_id, user_id } = paymentIntent.metadata;
  
  console.log('Payment failed:', {
    paymentIntentId: paymentIntent.id,
    orderId: order_id,
    userId: user_id,
    amount: paymentIntent.amount / 100
  });
  
  try {
    let companyId: string | null = null;
    if (order_id && order_id !== 'pending_order') {
      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .select('company_id')
        .eq('id', order_id)
        .single();

      if (orderError) {
        console.error('Error fetching order company_id:', orderError);
      } else {
        companyId = order?.company_id || null;
      }
    }

    if (!companyId) {
      console.warn('Skipping payment failure handling due to missing company_id', {
        paymentIntentId: paymentIntent.id,
        orderId: order_id
      });
      return;
    }

    // Create payment record in database using admin client
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert({
        order_id: order_id !== 'pending_order' ? order_id : null,
        amount: paymentIntent.amount / 100,
        status: 'failed',
        payment_method: paymentIntent.payment_method_types[0] || 'card',
        stripe_payment_intent_id: paymentIntent.id,
        company_id: companyId,
        payment_gateway_response: {
          stripe_payment_intent: paymentIntent,
          event_type: 'payment_intent.payment_failed',
          failure_reason: paymentIntent.last_payment_error?.message || 'Payment failed'
        },
        transaction_references: {
          stripe_payment_intent_id: paymentIntent.id
        }
      })
      .select()
      .single();
    
    if (paymentError) {
      console.error('Error creating payment record:', paymentError);
      return;
    }
    
    console.log('Failed payment record created:', payment.id);
    
    // Update order if order_id exists and is not pending
    if (order_id && order_id !== 'pending_order') {
      let orderUpdateQuery = supabaseAdmin
        .from('orders')
        .update({
          payment_status: 'failed',
          updated_at: new Date()
        })
        .eq('id', order_id);

      if (companyId) {
        orderUpdateQuery = orderUpdateQuery.eq('company_id', companyId);
      }

      const { error: orderError } = await orderUpdateQuery;
        
      if (orderError) {
        console.error('Error updating order:', orderError);
      } else {
        console.log('Order updated with failed status');
      }
    } else {
      console.log('Payment failed for pending order - no order to update');
    }
    
  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
};

// Link payment to order after order creation
export const linkPaymentToOrder = async (req: Request, res: Response) => {
  try {
    const { payment_intent_id, order_id } = req.body;
    const userId = req.user.id;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }
    
    if (!payment_intent_id || !order_id) {
      throw new ApiError(400, 'Payment intent ID and order ID are required');
    }
    
    // Verify the order belongs to the user
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id, total_amount')
      .eq('id', order_id)
      .eq('user_id', userId)
      .eq('company_id', req.companyId)
      .single();
    
    if (orderError || !order) {
      throw new ApiError(404, 'Order not found or not authorized');
    }
    
    // First, try to find an existing payment record for this payment intent
    const { data: existingPayment, error: findError } = await supabase
      .from('payments')
      .select('id, order_id, amount')
      .eq('stripe_payment_intent_id', payment_intent_id)
      .eq('company_id', req.companyId)
      .single();

    if (existingPayment) {
      console.log('Found existing payment record for payment intent:', payment_intent_id);
      
      // If the payment record doesn't have an order_id, update it
      if (!existingPayment.order_id) {
        console.log('Updating payment record with order_id:', order_id);
        
        const { data: updatedPayment, error: updateError } = await supabase
          .from('payments')
          .update({ 
            order_id,
            updated_at: new Date()
          })
          .eq('id', existingPayment.id)
          .eq('company_id', req.companyId)
          .select()
          .single();
        
        if (updateError) {
          console.error('Error updating payment record:', updateError);
          throw new ApiError(500, 'Error updating payment record');
        }
        
        console.log('Successfully updated payment record with order_id');
      } else if (existingPayment.order_id !== order_id) {
        console.warn('Payment record already linked to different order:', existingPayment.order_id);
        throw new ApiError(400, 'Payment already linked to a different order');
      }
    } else {
      console.log('No existing payment record found for payment intent:', payment_intent_id);
      console.log('Payment record will be created by webhook or already exists');
    }
    
    // Update the order with payment intent ID and status
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({ 
        payment_intent_id,
        payment_status: 'paid',
        status: 'processing',
        updated_at: new Date()
      })
      .eq('id', order_id)
      .eq('company_id', req.companyId);
    
    if (orderUpdateError) {
      console.error('Error updating order:', orderUpdateError);
      throw new ApiError(500, 'Error updating order');
    }
    
    console.log('Successfully linked payment to order:', order_id);
    
    res.status(200).json({
      success: true,
      message: 'Payment linked to order successfully',
      order_id,
      payment_intent_id
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error linking payment to order');
  }
};

// Create payment record for successful payment
export const createPaymentRecord = async (req: Request, res: Response) => {
  try {
    const { 
      order_id, 
      amount, 
      payment_method, 
      stripe_payment_intent_id,
      status = 'completed'
    } = req.body;
    const userId = req.user?.id;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    if (!order_id || !amount || !payment_method) {
      throw new ApiError(400, 'Order ID, amount, and payment method are required');
    }

    // Verify the order belongs to the user
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id, total_amount')
      .eq('id', order_id)
      .eq('user_id', userId)
      .eq('company_id', req.companyId)
      .single();

    if (orderError || !order) {
      throw new ApiError(404, 'Order not found or not authorized');
    }

    // Validate amount matches order total (with some tolerance for rounding)
    const orderAmount = parseFloat(order.total_amount.toString());
    const paymentAmount = parseFloat(amount.toString());
    if (Math.abs(orderAmount - paymentAmount) > 0.01) {
      throw new ApiError(400, 'Payment amount does not match order total');
    }

    // Check if a payment record already exists for this order
    const { data: existingPayment, error: checkError } = await supabase
      .from('payments')
      .select('id, stripe_payment_intent_id')
      .eq('order_id', order_id)
      .eq('company_id', req.companyId)
      .single();

    if (existingPayment) {
      console.log('Payment record already exists for order:', order_id);
      
      // If we have a stripe_payment_intent_id and the existing payment doesn't have one, update it
      if (stripe_payment_intent_id && !existingPayment.stripe_payment_intent_id) {
        console.log('Updating existing payment record with stripe_payment_intent_id:', stripe_payment_intent_id);
        
        const { error: updateError } = await supabase
          .from('payments')
          .update({
            stripe_payment_intent_id: stripe_payment_intent_id,
            updated_at: new Date()
          })
          .eq('id', existingPayment.id)
          .eq('company_id', req.companyId);

        if (updateError) {
          console.error('Error updating payment record with stripe_payment_intent_id:', updateError);
          throw new ApiError(500, 'Error updating payment record');
        } else {
          console.log('Successfully updated payment record with stripe_payment_intent_id');
        }
      }
      
      // Update order payment status
      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          payment_intent_id: stripe_payment_intent_id || existingPayment.stripe_payment_intent_id,
          updated_at: new Date()
        })
        .eq('id', order_id)
        .eq('company_id', req.companyId);

      if (orderUpdateError) {
        console.error('Error updating order payment status:', orderUpdateError);
        // Don't fail the request if order update fails, but log it
      }

      console.log('Payment record updated successfully:', existingPayment.id);

      return res.status(200).json({
        success: true,
        data: existingPayment,
        message: 'Payment record updated'
      });
    }

    // Create new payment record only if one doesn't exist
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        order_id,
        amount: paymentAmount,
        status,
        payment_method,
        stripe_payment_intent_id: stripe_payment_intent_id || null,
        company_id: req.companyId,
        payment_gateway_response: {
          source: 'manual_creation',
          created_by: userId,
          created_at: new Date().toISOString()
        },
        transaction_references: {
          stripe_payment_intent_id: stripe_payment_intent_id || null,
          manual_creation: true
        }
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Error creating payment record:', paymentError);
      throw new ApiError(500, 'Error creating payment record');
    }

    // Update order payment status
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({
        payment_status: 'paid',
        payment_intent_id: stripe_payment_intent_id,
        updated_at: new Date()
      })
      .eq('id', order_id)
      .eq('company_id', req.companyId);

    if (orderUpdateError) {
      console.error('Error updating order payment status:', orderUpdateError);
      // Don't fail the request if order update fails, but log it
    }

    console.log('Payment record created successfully:', payment.id);

    res.status(201).json({
      success: true,
      data: payment
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error creating payment record');
  }
};

// Create payment records for existing paid orders that don't have payment records
export const createMissingPaymentRecords = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }
    
    // Only allow admins to run this
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    
    if (profileError || !profile || profile.role !== 'admin') {
      throw new ApiError(403, 'Admin access required');
    }

    // Find orders that are marked as paid but don't have payment records
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        user_id,
        total_amount,
        payment_status,
        payment_intent_id,
        created_at
      `)
      .eq('payment_status', 'paid')
      .eq('company_id', req.companyId)
      .is('payment_intent_id', null);

    if (ordersError) {
      throw new ApiError(500, 'Error fetching orders');
    }

    if (!orders || orders.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No orders found that need payment records',
        count: 0
      });
    }

    console.log(`Found ${orders.length} orders that need payment records`);

    let createdCount = 0;
    const errors: string[] = [];

    for (const order of orders) {
      try {
        // Check if payment record already exists
        const { data: existingPayment, error: checkError } = await supabase
          .from('payments')
          .select('id')
          .eq('order_id', order.id)
          .eq('company_id', req.companyId)
          .single();

        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found"
          console.error('Error checking existing payment:', checkError);
          continue;
        }

        if (existingPayment) {
          console.log(`Payment record already exists for order ${order.id}`);
          continue;
        }

        // Create payment record
        const { data: payment, error: paymentError } = await supabase
          .from('payments')
          .insert({
            order_id: order.id,
            amount: order.total_amount,
            status: 'completed',
            payment_method: 'card', // Default assumption
            stripe_payment_intent_id: null,
            company_id: req.companyId,
            payment_gateway_response: {
              source: 'retroactive_creation',
              created_by: userId,
              created_at: new Date().toISOString(),
              note: 'Created retroactively for existing paid order'
            },
            transaction_references: {
              retroactive_creation: true,
              order_created_at: order.created_at
            }
          })
          .select()
          .single();

        if (paymentError) {
          console.error(`Error creating payment record for order ${order.id}:`, paymentError);
          errors.push(`Order ${order.id}: ${paymentError.message}`);
        } else {
          console.log(`Created payment record ${payment.id} for order ${order.id}`);
          createdCount++;
        }
      } catch (error) {
        console.error(`Error processing order ${order.id}:`, error);
        errors.push(`Order ${order.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    res.status(200).json({
      success: true,
      message: `Created ${createdCount} payment records`,
      created_count: createdCount,
      total_orders: orders.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error creating missing payment records');
  }
}; 