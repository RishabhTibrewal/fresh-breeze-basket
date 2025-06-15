import express from 'express';
import { 
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  getUserOrders,
  cancelOrder,
  getSalesOrders,
  getSalesDashboardStats
} from '../controllers';
import { protect, adminOnly } from '../middleware/auth';

const router = express.Router();

// Protected routes (logged in users)
router.get('/my-orders', protect, getUserOrders);

// Sales executive routes - must be before /:id route
router.get('/sales', protect, getSalesOrders);
router.get('/sales/dashboard-stats', protect, getSalesDashboardStats);

// Admin only routes
router.get('/', protect, adminOnly, getOrders);

// Allow any authenticated user to get order by ID - controller will handle permissions
router.get('/:id', protect, getOrderById);
router.post('/', protect, createOrder);
router.put('/:id/cancel', protect, cancelOrder);
router.put('/:id/status', protect, updateOrderStatus);

export default router; 