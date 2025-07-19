import { Request, Response } from 'express';
import { stripe } from '../config/stripe';

export const createPaymentIntent = async (req: Request, res: Response) => {
  try {
    const { amount, currency = 'usd' } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    // Validate amount is a positive number
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    console.log('Creating payment intent for amount:', numericAmount, 'currency:', currency);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(numericAmount * 100), // Convert to cents
      currency,
      automatic_payment_methods: {
        enabled: true,
      },
      // Add metadata for tracking (optional)
      metadata: {
        user_id: req.user?.id || 'anonymous',
        source: 'web_checkout'
      }
    });

    console.log('Payment intent created successfully:', paymentIntent.id);

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    console.error('Error details:', {
      message: error.message,
      type: error.type,
      code: error.code,
      statusCode: error.statusCode
    });
    
    // Return more specific error information
    res.status(500).json({ 
      error: 'Error creating payment intent',
      details: error.message || 'Unknown error'
    });
  }
}; 