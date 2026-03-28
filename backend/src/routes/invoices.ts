import express from 'express';
import {
  getPOSInvoice,
  getCustomerBill,
  getQuotationDocument,
  getKitchenKOT,
  getCustomerKOT
} from '../controllers/invoices';
import { protect } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Invoice routes
router.get('/pos/:orderId', getPOSInvoice);
router.get('/customer/:orderId', getCustomerBill);
router.get('/quotations/:quotationId', getQuotationDocument);
router.get('/kot/kitchen/:orderId', getKitchenKOT);
router.get('/kot/customer/:orderId', getCustomerKOT);

export default router;
