import express from 'express';
import {
  createGoodsReceipt,
  getGoodsReceipts,
  getGoodsReceiptById,
  updateGoodsReceipt,
  receiveGoods,
  completeGoodsReceipt,
  deleteGoodsReceipt
} from '../controllers/goodsReceipts';
import { protect, requireWarehouseManager, requireAccountsOrAdmin, adminOnly } from '../middleware/auth';
import {
  validateGRNCreation,
  validateGRNStatusTransition,
  validateGRNQuantities
} from '../middleware/procurementValidation';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Warehouse manager or admin can create GRN
router.post('/', requireWarehouseManager, validateGRNCreation, validateGRNQuantities, createGoodsReceipt);
router.get('/', getGoodsReceipts);
router.get('/:id', getGoodsReceiptById);
// Only admin can update
router.put('/:id', adminOnly, validateGRNStatusTransition, updateGoodsReceipt);
router.post('/:id/receive', adminOnly, validateGRNStatusTransition, receiveGoods);
// Accounts or admin can complete/approve GRN
router.post('/:id/complete', requireAccountsOrAdmin, validateGRNStatusTransition, completeGoodsReceipt);
// Delete GRN - authorization handled in controller based on status
router.delete('/:id', deleteGoodsReceipt);

export default router;
