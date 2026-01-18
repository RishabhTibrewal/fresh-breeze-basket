import express from 'express';
import {
  createPurchaseInvoice,
  getPurchaseInvoices,
  getPurchaseInvoiceById,
  updatePurchaseInvoice,
  uploadInvoiceFile
} from '../controllers/purchaseInvoices';
import { protect, adminOnly } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Admin only routes
router.post('/', adminOnly, createPurchaseInvoice);
router.get('/', getPurchaseInvoices);
router.get('/:id', getPurchaseInvoiceById);
router.put('/:id', adminOnly, updatePurchaseInvoice);
router.post('/:id/upload', adminOnly, uploadInvoiceFile);

export default router;
