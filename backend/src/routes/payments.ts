import express from 'express';
import { 
  handleStripeWebhook,
  getPaymentById, 
  createPaymentIntent,
  getPaymentHistory,
  linkPaymentToOrder,
  createPaymentRecord,
  createMissingPaymentRecords
} from '../controllers';
import { protect } from '../middleware/auth';

const router = express.Router();

// Public webhook route (must be raw body for Stripe signature verification)
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

// Public route for creating payment intents (no authentication required for checkout)
router.post('/create-payment-intent', createPaymentIntent);

// Protected routes
router.get('/history', protect, getPaymentHistory);
router.post('/link-to-order', protect, linkPaymentToOrder);
router.post('/create-record', protect, createPaymentRecord);
router.post('/create-missing-records', protect, createMissingPaymentRecords);
router.get('/:id', protect, getPaymentById);

export default router; 