import express from 'express';
import { 
  handleStripeWebhook,
  getPaymentById, 
  createPaymentIntent
} from '../controllers';
import { protect } from '../middleware/auth';

const router = express.Router();

// Public webhook route (must be raw body for Stripe signature verification)
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

// Protected routes
router.post('/create-payment-intent', protect, createPaymentIntent);
router.get('/:id', protect, getPaymentById);

export default router; 