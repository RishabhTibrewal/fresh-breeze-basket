import express from 'express';
import {
  createPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrder,
  submitPurchaseOrder,
  approvePurchaseOrder,
  cancelPurchaseOrder
} from '../controllers/purchaseOrders';
import { protect, requireWarehouseManager, requireAccountsOrAdmin, adminOnly } from '../middleware/auth';
import {
  validatePOStatusTransition,
  validatePOItemModification
} from '../middleware/procurementValidation';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Warehouse manager or admin can create PO
router.post('/', requireWarehouseManager, createPurchaseOrder);
router.get('/', getPurchaseOrders);
router.get('/:id', getPurchaseOrderById);
// Only admin can update/cancel (warehouse managers can only create)
router.put('/:id', adminOnly, validatePOStatusTransition, validatePOItemModification, updatePurchaseOrder);
// Warehouse manager or admin can submit PO for approval (draft -> pending)
router.post('/:id/submit', requireWarehouseManager, validatePOStatusTransition, submitPurchaseOrder);
// Accounts or admin can approve
router.post('/:id/approve', requireAccountsOrAdmin, validatePOStatusTransition, approvePurchaseOrder);
router.delete('/:id', adminOnly, validatePOStatusTransition, cancelPurchaseOrder);

export default router;
