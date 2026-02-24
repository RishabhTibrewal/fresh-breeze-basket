import express from 'express';
import { 
  getOrders,
  getOrderById,
  createOrder,
  createReturnOrder,
  updateOrderStatus,
  getUserOrders,
  cancelOrder,
  getSalesOrders,
  getSalesDashboardStats,
  getSalesAnalytics
} from '../controllers';
import { getCurrentSalesTarget } from '../controllers/admin';
import { protect, requireRole } from '../middleware/auth';

const router = express.Router();

// Protected routes (logged in users)
router.get('/my-orders', protect, getUserOrders);

// Sales executive routes - must be before /:id route
router.get('/sales', protect, getSalesOrders);
router.get('/sales/dashboard-stats', protect, getSalesDashboardStats);
router.get('/sales/analytics', protect, getSalesAnalytics);
router.get('/sales/current-target', protect, getCurrentSalesTarget);

// Return orders route - must be before /:id route to avoid route conflicts
router.post('/returns', protect, createReturnOrder);

// Admin or Sales routes - controller will filter data based on role
router.get('/', protect, requireRole(['admin', 'sales']), getOrders);

// Allow any authenticated user to get order by ID - controller will handle permissions
router.get('/:id', protect, getOrderById);
router.post('/', protect, createOrder);
router.put('/:id/cancel', protect, cancelOrder);
router.put('/:id/status', protect, updateOrderStatus);

export default router; 