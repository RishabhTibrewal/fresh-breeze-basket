import express from 'express';
import { 
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  getUserOrders
} from '../controllers';
import { protect, adminOnly } from '../middleware/auth';

const router = express.Router();

// Protected routes (logged in users)
router.get('/my-orders', protect, getUserOrders);
router.post('/', protect, createOrder);

// Admin only routes
router.get('/', protect, adminOnly, getOrders);
router.get('/:id', protect, adminOnly, getOrderById);
router.put('/:id/status', protect, adminOnly, updateOrderStatus);

export default router; 