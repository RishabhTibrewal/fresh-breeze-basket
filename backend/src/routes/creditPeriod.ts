import express from 'express';
import { creditPeriodController } from '../controllers/creditPeriodController';
import { protect } from '../middleware/auth';

const router = express.Router();

// Get credit period by order ID
router.get('/order/:orderId', protect, creditPeriodController.getCreditPeriodByOrderId);

// Get all credit periods for a customer
router.get('/customer/:customerId', protect, creditPeriodController.getCustomerCreditPeriods);

// Update credit period status
router.put('/:creditPeriodId/status', protect, creditPeriodController.updateCreditPeriodStatus);

export default router; 