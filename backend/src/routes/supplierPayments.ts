import express from 'express';
import {
  createSupplierPayment,
  getSupplierPayments,
  getSupplierPaymentById,
  updateSupplierPayment
} from '../controllers/supplierPayments';
import { protect, adminOnly } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Admin only routes
router.post('/', adminOnly, createSupplierPayment);
router.get('/', getSupplierPayments);
router.get('/:id', getSupplierPaymentById);
router.put('/:id', adminOnly, updateSupplierPayment);

export default router;
