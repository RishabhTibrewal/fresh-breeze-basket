import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { ApiError } from '../middleware/error';
import { stripeClient } from '../config/stripe';

// Create a payment intent
export const createPaymentIntent = async (req: Request, res: Response) => {
  try {
    const { amount, order_id } = req.body;
    const userId = req.user.id;
    
    if (!amount || !order_id) {
      throw new ApiError(400, 'Please provide amount and order ID');
    }
    
    // Verify order belongs to user
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .eq('user_id', userId)
      .single();
    
    if (orderError || !order) {
      throw new ApiError(404, 'Order not found or does not belong to user');
    }
    
    // Create payment intent
    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'aed',
      metadata: {
        order_id,
        user_id: userId
      }
    });
    
    // Update order with payment intent ID
    await supabase
      .from('orders')
      .update({
        payment_intent_id: paymentIntent.id
      })
      .eq('id', order_id);
    
    res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret
    });
  } catch (error) {
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
    
    // Get payment from Stripe
    const payment = await stripeClient.paymentIntents.retrieve(id);
    
    // Verify payment belongs to user
    if (payment.metadata.user_id !== userId) {
      throw new ApiError(403, 'Not authorized to view this payment');
    }
    
    res.status(200).json({
      success: true,
      data: {
        id: payment.id,
        amount: payment.amount / 100,
        status: payment.status,
        order_id: payment.metadata.order_id
      }
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error retrieving payment');
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
    const event = stripeClient.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
    
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
  const { order_id } = paymentIntent.metadata;
  
  if (!order_id) {
    console.error('No order ID in payment metadata');
    return;
  }
  
  // Update order payment status
  await supabase
    .from('orders')
    .update({
      payment_status: 'paid',
      status: 'processing', // Move from pending to processing
      updated_at: new Date()
    })
    .eq('id', order_id);
    
  // Record the payment
  await supabase
    .from('payments')
    .insert({
      order_id,
      payment_intent_id: paymentIntent.id,
      amount: paymentIntent.amount / 100,
      status: 'completed',
      payment_method: paymentIntent.payment_method_types[0]
    });
};

// Helper to handle failed payments
const handlePaymentFailure = async (paymentIntent: any) => {
  const { order_id } = paymentIntent.metadata;
  
  if (!order_id) {
    console.error('No order ID in payment metadata');
    return;
  }
  
  // Update order payment status
  await supabase
    .from('orders')
    .update({
      payment_status: 'failed',
      updated_at: new Date()
    })
    .eq('id', order_id);
    
  // Record the payment
  await supabase
    .from('payments')
    .insert({
      order_id,
      payment_intent_id: paymentIntent.id,
      amount: paymentIntent.amount / 100,
      status: 'failed',
      payment_method: paymentIntent.payment_method_types[0]
    });
}; 