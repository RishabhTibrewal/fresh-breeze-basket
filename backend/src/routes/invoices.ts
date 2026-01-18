import express from 'express';
import {
  getPOSInvoice,
  getCustomerBill
} from '../controllers/invoices';
import { protect } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Invoice routes
router.get('/pos/:orderId', getPOSInvoice);
router.get('/customer/:orderId', getCustomerBill);

export default router;
