import express from 'express';
import {
  getPOSInvoice,
  getCustomerBill,
  getQuotationDocument,
  getKitchenKOT,
  getKitchenKOTByTicket,
  getCustomerKOT,
  getThermalReport,
  getPartyLedgerPrint
} from '../controllers/invoices';
import { protect } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Report printing routes
router.get('/reports/thermal', getThermalReport);

// Invoice routes
router.get('/pos/:orderId', getPOSInvoice);
router.get('/customer/:orderId', getCustomerBill);
router.get('/quotations/:quotationId', getQuotationDocument);
router.get('/kot/ticket/:ticketId/kitchen', getKitchenKOTByTicket);
router.get('/kot/kitchen/:orderId', getKitchenKOT);
router.get('/kot/customer/:orderId', getCustomerKOT);
router.get('/party/:partyId/ledger/print', getPartyLedgerPrint);

export default router;
