import express from 'express';
import { 
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  getUserOrders,
  cancelOrder
} from '../controllers';
import { protect, adminOnly } from '../middleware/auth';

const router = express.Router();

// Protected routes (logged in users)
router.get('/my-orders', protect, getUserOrders);
router.get('/:id', protect, getOrderById);
router.post('/', protect, createOrder);
router.put('/:id/cancel', protect, cancelOrder);

// Admin only routes
router.get('/', protect, adminOnly, getOrders);
router.put('/:id/status', protect, adminOnly, updateOrderStatus);

export default router; 