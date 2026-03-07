import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { supabaseAdmin } from '../lib/supabase';
import { ApiError } from '../middleware/error';
import { stripe } from '../config/stripe';
import { PaymentService } from '../services/core/PaymentService';
import { hasAnyRole } from '../utils/roles';

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
        await (supabaseAdmin || supabase)
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
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }
    const { id } = req.params;
    const userId = req.user.id;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }
    
    // Get payment from database
    const { data: payment, error: dbError } = await (supabaseAdmin || supabase)
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
      const { data: order, error: orderError } = await (supabaseAdmin || supabase)
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
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }
    const userId = req.user.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }
    
    // Get user's orders first
    const { data: orders, error: ordersError } = await (supabaseAdmin || supabase)
      .from('orders')
      .select('id')
      .eq('user_id', userId)
      .eq('company_id', req.companyId);
    
    if (ordersError) {
      throw new ApiError(500, 'Error fetching user orders');
    }
    
    const orderIds = orders?.map(order => order.id) || [];
    
    // Get payments for user's orders
    const { data: payments, error: paymentsError, count } = await (supabaseAdmin || supabase)
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

    // Create new payment record using PaymentService
    if (order_id && order_id !== 'pending_order') {
      const paymentService = new PaymentService(companyId);
      const paymentId = await paymentService.processPayment({
        orderId: order_id,
        amount: paymentIntent.amount / 100,
        paymentMethod: paymentIntent.payment_method_types[0] || 'card',
        status: 'completed',
        stripePaymentIntentId: paymentIntent.id,
        paymentGatewayResponse: {
          source: 'stripe_webhook',
          payment_intent_id: paymentIntent.id,
          created_at: new Date().toISOString()
        },
        transactionReferences: {
          stripe_payment_intent_id: paymentIntent.id,
          webhook_processed: true
        }
      });

      if (paymentId) {
        console.log('Payment record created successfully via PaymentService:', paymentId);
      } else {
        console.error('Failed to create payment record via PaymentService');
      }
    } else {
      // For pending orders, create payment record directly (will be linked later)
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert({
          order_id: null,
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
    }

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
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }
    const { payment_intent_id, order_id } = req.body;
    const userId = req.user.id;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }
    
    if (!payment_intent_id || !order_id) {
      throw new ApiError(400, 'Payment intent ID and order ID are required');
    }
    
    // Verify the order belongs to the user
    const { data: order, error: orderError } = await (supabaseAdmin || supabase)
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
    const { data: existingPayment, error: findError } = await (supabaseAdmin || supabase)
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
        
        const { data: updatedPayment, error: updateError } = await (supabaseAdmin || supabase)
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
    const { error: orderUpdateError } = await (supabaseAdmin || supabase)
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
      status = 'completed',
      transaction_id,
      cheque_no,
      payment_date
    } = req.body;
    const userId = req.user?.id;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    if (!order_id || !amount || !payment_method) {
      throw new ApiError(400, 'Order ID, amount, and payment method are required');
    }

    if (!userId) {
      throw new ApiError(401, 'Authentication required');
    }

    // Check roles - admin and sales can create payments
    const isAdmin = await hasAnyRole(userId, req.companyId, ['admin']);
    const isSales = await hasAnyRole(userId, req.companyId, ['sales']);

    if (!isAdmin && !isSales) {
      throw new ApiError(403, 'Admin or Sales access required');
    }

    // Fetch the order
    const { data: order, error: orderError } = await (supabaseAdmin || supabase)
      .from('orders')
      .select('id, user_id, total_amount, payment_status')
      .eq('id', order_id)
      .eq('company_id', req.companyId)
      .single();

    if (orderError || !order) {
      throw new ApiError(404, 'Order not found');
    }

    // Verify authorization: For sales executives, check if order belongs to their customers
    if (!isAdmin && isSales) {
      const { data: customer, error: customerError } = await (supabaseAdmin || supabase)
        .from('customers')
        .select('sales_executive_id')
        .eq('user_id', order.user_id)
        .eq('company_id', req.companyId)
        .single();

      if (customerError) {
        console.error('Error fetching customer for authorization:', customerError);
        throw new ApiError(404, 'Customer not found for this order');
      }

      if (!customer || customer.sales_executive_id !== userId) {
        throw new ApiError(403, 'Not authorized to create payment for this order');
      }
    }

    // Validate amount doesn't exceed order total (allow partial payments)
    const orderAmount = parseFloat(order.total_amount.toString());
    const paymentAmount = parseFloat(amount.toString());
    
    if (paymentAmount <= 0) {
      throw new ApiError(400, 'Payment amount must be greater than 0');
    }
    
    if (paymentAmount > orderAmount) {
      throw new ApiError(400, `Payment amount (${paymentAmount}) cannot exceed order total (${orderAmount})`);
    }

    // Only check for existing payment if we're linking a Stripe payment intent (e-commerce scenario)
    // For manual payments (sales orders), always create a new payment record to allow multiple payments
    if (stripe_payment_intent_id) {
      const { data: existingPayment, error: checkError } = await (supabaseAdmin || supabase)
        .from('payments')
        .select('id, stripe_payment_intent_id')
        .eq('order_id', order_id)
        .eq('company_id', req.companyId)
        .eq('stripe_payment_intent_id', stripe_payment_intent_id)
        .maybeSingle();

      // If payment with this Stripe intent already exists, update it
      if (existingPayment) {
        console.log('Payment record already exists for Stripe payment intent:', stripe_payment_intent_id);
        
        // Recalculate order payment status based on total paid amounts (same logic as below)
        try {
          const { data: allPayments, error: paymentsError } = await (supabaseAdmin || supabase)
            .from('payments')
            .select('amount, status')
            .eq('order_id', order_id)
            .eq('company_id', req.companyId);

          if (!paymentsError && allPayments) {
            // Sum only completed payments
            const totalPaid = allPayments
              .filter(p => p.status === 'completed')
              .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);

            const orderTotal = parseFloat(order.total_amount.toString());
            
            // Determine new payment status based on total paid amount
            let newPaymentStatus = order.payment_status; // Keep existing status by default
            
            if (totalPaid >= orderTotal) {
              // Fully paid
              newPaymentStatus = 'paid';
            } else if (totalPaid > 0) {
              // Partially paid
              newPaymentStatus = 'partial';
            } else {
              // No payments yet - only update if not 'credit'
              if (order.payment_status !== 'credit') {
                newPaymentStatus = 'pending';
              }
            }

            // Update order payment_status if it changed
            if (newPaymentStatus !== order.payment_status) {
              const { error: orderUpdateError } = await (supabaseAdmin || supabase)
                .from('orders')
                .update({
                  payment_status: newPaymentStatus,
                  payment_intent_id: stripe_payment_intent_id,
                  updated_at: new Date()
                })
                .eq('id', order_id)
                .eq('company_id', req.companyId);

              if (orderUpdateError) {
                console.error('Error updating order payment status:', orderUpdateError);
                // Don't fail the request if order update fails, but log it
              }
            } else {
              // Still update payment_intent_id even if status didn't change
              const { error: orderUpdateError } = await (supabaseAdmin || supabase)
                .from('orders')
                .update({
                  payment_intent_id: stripe_payment_intent_id,
                  updated_at: new Date()
                })
                .eq('id', order_id)
                .eq('company_id', req.companyId);

              if (orderUpdateError) {
                console.error('Error updating order payment intent:', orderUpdateError);
              }
            }
          }
        } catch (statusCalcError) {
          console.error('Error recalculating payment status for existing payment:', statusCalcError);
          // Don't fail the request, but log the error
        }

        console.log('Payment record already exists:', existingPayment.id);

        return res.status(200).json({
          success: true,
          data: existingPayment,
          message: 'Payment record already exists'
        });
      }
    }

    // Create new payment record using PaymentService
    const paymentService = new PaymentService(req.companyId);
    const paymentId = await paymentService.processPayment({
      orderId: order_id,
      amount: paymentAmount,
      paymentMethod: payment_method,
      status: status as 'pending' | 'completed' | 'failed',
      stripePaymentIntentId: stripe_payment_intent_id || undefined,
      transactionId: transaction_id || undefined,
      chequeNo: cheque_no || undefined,
      paymentDate: payment_date || undefined,
      preserveOrderPaymentStatus: true, // Don't overwrite order payment_status when creating manually
      paymentGatewayResponse: {
        source: 'manual_creation',
        created_by: userId,
        created_at: new Date().toISOString()
      },
      transactionReferences: {
        stripe_payment_intent_id: stripe_payment_intent_id || null,
        manual_creation: true
      }
    });

    if (!paymentId) {
      throw new ApiError(500, 'Error creating payment record');
    }

    // Fetch the created payment
    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .eq('company_id', req.companyId)
      .single();

    console.log('Payment record created successfully:', payment.id);

    // Update credit_periods table if order has a credit period
    try {
      // Find associated credit period
      const { data: foundCreditPeriod, error: creditError } = await (supabaseAdmin || supabase)
        .from('credit_periods')
        .select('*')
        .eq('order_id', order_id)
        .eq('company_id', req.companyId)
        .maybeSingle();
        
      if (creditError) {
        console.error('[CreatePayment] Error finding credit period for order:', creditError);
      } else if (foundCreditPeriod) {
        console.log('[CreatePayment] Found credit period:', foundCreditPeriod.id);
        
        const currentCreditAmount = parseFloat(foundCreditPeriod.amount.toString());
        const paymentAmountToApply = Math.min(paymentAmount, currentCreditAmount);
        
        if (paymentAmountToApply > 0) {
          // Prepare credit period update data
          const creditUpdateData: any = {};
          
          // Helper to append to existing description instead of overwriting
          const appendDescription = (entry: string) => {
            const existing = foundCreditPeriod.description || '';
            return existing ? `${existing}\n${entry}` : entry;
          };
          
          // Calculate remaining amount
          const remainingAmount = currentCreditAmount - paymentAmountToApply;
          
          if (remainingAmount <= 0) {
            // Full payment - set amount to 0
            creditUpdateData.amount = 0;
            creditUpdateData.description = appendDescription(
              `Fully paid off on ${new Date().toISOString().split('T')[0]} via ${payment_method}`
            );
          } else {
            // Partial payment - reduce the amount
            creditUpdateData.amount = remainingAmount;
            creditUpdateData.description = appendDescription(
              `Partial payment of $${paymentAmountToApply.toFixed(2)} received on ${new Date().toISOString().split('T')[0]} via ${payment_method}. Remaining: $${remainingAmount.toFixed(2)}`
            );
          }
          
          // Update credit period
          const { data: updatedCreditPeriod, error: updateCreditError } = await (supabaseAdmin || supabase)
            .from('credit_periods')
            .update(creditUpdateData)
            .eq('id', foundCreditPeriod.id)
            .eq('company_id', req.companyId)
            .select();
            
          if (updateCreditError) {
            console.error('[CreatePayment] Error updating credit period:', updateCreditError);
          } else {
            console.log('[CreatePayment] Credit period updated successfully:', updatedCreditPeriod);
            
            // Update customer's current_credit
            const { data: customer, error: customerError } = await (supabaseAdmin || supabase)
              .from('customers')
              .select('id, current_credit')
              .eq('user_id', order.user_id)
              .eq('company_id', req.companyId)
              .single();
              
            if (customerError) {
              console.error('[CreatePayment] Error finding customer:', customerError);
            } else if (customer) {
              const currentCredit = parseFloat(customer.current_credit.toString());
              const newCreditAmount = Math.max(0, currentCredit - paymentAmountToApply);
              
              const { error: customerUpdateError } = await (supabaseAdmin || supabase)
                .from('customers')
                .update({ current_credit: newCreditAmount })
                .eq('id', customer.id)
                .eq('company_id', req.companyId);
                
              if (customerUpdateError) {
                console.error('[CreatePayment] Error updating customer credit:', customerUpdateError);
              } else {
                console.log('[CreatePayment] Customer current credit updated successfully:', {
                  previous: currentCredit,
                  paymentProcessed: paymentAmountToApply,
                  new: newCreditAmount
                });
              }
            }
          }
        }
      }
    } catch (creditUpdateError) {
      console.error('[CreatePayment] Error handling credit period update:', creditUpdateError);
      // Don't throw error as payment was created successfully
    }

    // Update order payment_status based on total paid amount
    try {
      // Calculate total paid amount for this order (sum of all completed payments)
      const { data: allPayments, error: paymentsError } = await (supabaseAdmin || supabase)
        .from('payments')
        .select('amount, status')
        .eq('order_id', order_id)
        .eq('company_id', req.companyId);

      if (!paymentsError && allPayments) {
        // Sum only completed payments
        const totalPaid = allPayments
          .filter(p => p.status === 'completed')
          .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);

        const orderTotal = parseFloat(order.total_amount.toString());
        
        // Determine new payment status based on total paid amount
        let newPaymentStatus = order.payment_status; // Keep existing status by default
        
        if (totalPaid >= orderTotal) {
          // Fully paid - always set to 'paid' regardless of previous status
          newPaymentStatus = 'paid';
        } else if (totalPaid > 0) {
          // Partially paid - set to 'partial'
          // This applies even if order was previously 'full_credit' (now it's partially paid, partially on credit)
          newPaymentStatus = 'partial';
        } else {
          // No payments yet - only update if not 'credit'
          // If order is 'credit', keep it as is (no payments made yet)
          if (order.payment_status !== 'credit') {
            newPaymentStatus = 'pending';
          }
        }

        // Update order payment_status if it changed
        if (newPaymentStatus !== order.payment_status) {
          const { error: orderUpdateError } = await (supabaseAdmin || supabase)
            .from('orders')
            .update({
              payment_status: newPaymentStatus,
              updated_at: new Date()
            })
            .eq('id', order_id)
            .eq('company_id', req.companyId);

          if (orderUpdateError) {
            console.error('[CreatePayment] Error updating order payment_status:', orderUpdateError);
          } else {
            console.log('[CreatePayment] Order payment_status updated:', {
              order_id,
              previous: order.payment_status,
              new: newPaymentStatus,
              totalPaid,
              orderTotal
            });
          }
        }
      }
    } catch (orderStatusUpdateError) {
      console.error('[CreatePayment] Error updating order payment_status:', orderStatusUpdateError);
      // Don't throw error as payment was created successfully
    }

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

// Get all payments with optional filters (for sales module)
export const getAllPayments = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }
    const userId = req.user.id;
    const { order_id, status, payment_method, date_from, date_to } = req.query;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    // Check roles - only admin and sales can view all payments
    const isAdmin = await hasAnyRole(userId, req.companyId, ['admin']);
    const isSales = await hasAnyRole(userId, req.companyId, ['sales']);

    if (!isAdmin && !isSales) {
      throw new ApiError(403, 'Admin or Sales access required');
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
          success: true,
          data: []
        });
      }
    }

    // Build query for payments
    let query = (supabaseAdmin || supabase)
      .from('payments')
      .select('*')
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false });

    // If sales executive, filter by their customers' orders
    if (customerUserIds) {
      // Get order IDs for their customers
      const { data: orders } = await (supabaseAdmin || supabase)
        .from('orders')
        .select('id')
        .in('user_id', customerUserIds)
        .eq('company_id', req.companyId);

      const orderIds = orders?.map(o => o.id).filter(Boolean) || [];

      if (orderIds.length === 0) {
        return res.json({
          success: true,
          data: []
        });
      }

      query = query.in('order_id', orderIds);
    }

    // Apply filters
    if (order_id) {
      query = query.eq('order_id', order_id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (payment_method) {
      query = query.eq('payment_method', payment_method);
    }

    if (date_from) {
      query = query.gte('payment_date', date_from);
    }

    if (date_to) {
      query = query.lte('payment_date', date_to);
    }

    const { data: payments, error } = await query;

    if (error) {
      console.error('Error fetching payments:', error);
      throw new ApiError(500, 'Failed to fetch payments');
    }

    // Fetch related orders
    const paymentOrderIds = [...new Set((payments || []).map((p: any) => p.order_id).filter(Boolean))];
    const ordersMap = new Map();
    const orderUserIds: string[] = [];

    if (paymentOrderIds.length > 0) {
      // Fetch orders
      const { data: orders, error: ordersError } = await (supabaseAdmin || supabase)
        .from('orders')
        .select('id, total_amount, payment_status, user_id, created_at')
        .in('id', paymentOrderIds)
        .eq('company_id', req.companyId);

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
        // Continue without orders if there's an error
      } else {
        orders?.forEach((order: any) => {
          ordersMap.set(order.id, order);
          if (order.user_id) {
            orderUserIds.push(order.user_id);
          }
        });
      }
    }

    // Fetch customers for the user_ids
    const customersMap = new Map();
    if (orderUserIds.length > 0) {
      const { data: customers, error: customersError } = await (supabaseAdmin || supabase)
        .from('customers')
        .select('id, user_id, name, email, phone')
        .in('user_id', [...new Set(orderUserIds)])
        .eq('company_id', req.companyId);

      if (customersError) {
        console.error('Error fetching customers:', customersError);
        // Continue without customers if there's an error
      } else {
        customers?.forEach((customer: any) => {
          customersMap.set(customer.user_id, customer);
        });
      }
    }

    // Enrich payments with related data
    const enrichedPayments = (payments || []).map((payment: any) => {
      const order = payment.order_id ? ordersMap.get(payment.order_id) : null;
      const customer = order?.user_id ? customersMap.get(order.user_id) : null;

      // Generate order_number similar to orders controller
      const orderNumber = order ? `ORD-${order.id.substring(0, 8).toUpperCase()}` : null;

      return {
        ...payment,
        order: order ? {
          id: order.id,
          order_number: orderNumber,
          total_amount: order.total_amount,
          payment_status: order.payment_status
        } : null,
        customer: customer || null
      };
    });

    res.json({
      success: true,
      data: enrichedPayments
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error retrieving payments');
  }
};

// Create payment records for existing paid orders that don't have payment records
export const createMissingPaymentRecords = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }
    
    // Only allow admins to run this (use RPC function which checks memberships)
    const { data: isAdmin, error: rpcError } = await (supabaseAdmin || supabase).rpc('is_admin', { user_id: userId });
    
    if (rpcError || !isAdmin) {
      throw new ApiError(403, 'Admin access required');
    }

    // Find orders that are marked as paid but don't have payment records
    const { data: orders, error: ordersError } = await (supabaseAdmin || supabase)
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
        const { data: existingPayment, error: checkError } = await (supabaseAdmin || supabase)
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
        const { data: payment, error: paymentError } = await (supabaseAdmin || supabase)
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