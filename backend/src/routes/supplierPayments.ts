import express from 'express';
import {
  createSupplierPayment,
  getSupplierPayments,
  getSupplierPaymentById,
  updateSupplierPayment
} from '../controllers/supplierPayments';
import { protect, requireAccounts, adminOnly } from '../middleware/auth';
import {
  validatePaymentAmount,
  validatePaymentAmountUpdate,
  validatePaymentStatusTransition
} from '../middleware/procurementValidation';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Accounts or admin can create/update payments
router.post('/', requireAccounts, validatePaymentAmount, createSupplierPayment);
router.get('/', getSupplierPayments);
router.get('/:id', getSupplierPaymentById);
router.put('/:id', requireAccounts, validatePaymentAmountUpdate, validatePaymentStatusTransition, updateSupplierPayment);

export default router;
