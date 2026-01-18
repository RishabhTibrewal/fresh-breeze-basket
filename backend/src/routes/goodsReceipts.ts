import express from 'express';
import {
  createGoodsReceipt,
  getGoodsReceipts,
  getGoodsReceiptById,
  updateGoodsReceipt,
  receiveGoods,
  completeGoodsReceipt
} from '../controllers/goodsReceipts';
import { protect, adminOnly } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Admin only routes
router.post('/', adminOnly, createGoodsReceipt);
router.get('/', getGoodsReceipts);
router.get('/:id', getGoodsReceiptById);
router.put('/:id', adminOnly, updateGoodsReceipt);
router.post('/:id/receive', adminOnly, receiveGoods);
router.post('/:id/complete', adminOnly, completeGoodsReceipt);

export default router;
