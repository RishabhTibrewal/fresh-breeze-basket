import express from 'express';
import {
  createPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrder,
  approvePurchaseOrder,
  cancelPurchaseOrder
} from '../controllers/purchaseOrders';
import { protect, adminOnly } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Admin only routes
router.post('/', adminOnly, createPurchaseOrder);
router.get('/', getPurchaseOrders);
router.get('/:id', getPurchaseOrderById);
router.put('/:id', adminOnly, updatePurchaseOrder);
router.post('/:id/approve', adminOnly, approvePurchaseOrder);
router.delete('/:id', adminOnly, cancelPurchaseOrder);

export default router;
