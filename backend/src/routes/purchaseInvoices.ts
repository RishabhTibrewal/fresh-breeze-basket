import express from 'express';
import {
  createPurchaseInvoice,
  createInvoiceFromGRN,
  getPurchaseInvoices,
  getPurchaseInvoiceById,
  updatePurchaseInvoice,
  uploadInvoiceFile
} from '../controllers/purchaseInvoices';
import { protect, requireAccounts, adminOnly } from '../middleware/auth';
import {
  validateInvoiceCreation,
  validateInvoiceStatusTransition,
  validateInvoiceAmounts
} from '../middleware/procurementValidation';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Accounts or admin can create invoices
router.post('/', requireAccounts, validateInvoiceCreation, validateInvoiceAmounts, createPurchaseInvoice);
router.post('/from-grn', requireAccounts, validateInvoiceCreation, validateInvoiceAmounts, createInvoiceFromGRN);
router.get('/', getPurchaseInvoices);
router.get('/:id', getPurchaseInvoiceById);
// Accounts or admin can update invoices
router.put('/:id', requireAccounts, validateInvoiceStatusTransition, updatePurchaseInvoice);
router.post('/:id/upload', requireAccounts, uploadInvoiceFile);

export default router;
