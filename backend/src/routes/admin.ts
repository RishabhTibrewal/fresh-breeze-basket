import express from 'express';
import { protect, adminOnly } from '../middleware/auth';
import { getAllUsers, getDashboardStats } from '../controllers/admin';

const router = express.Router();

// Apply authentication middleware to all admin routes
router.use(protect);
router.use(adminOnly);

// Get all users (admin only)
router.get('/users', getAllUsers);

// Get dashboard statistics (admin only)
router.get('/dashboard-stats', getDashboardStats);

export default router; 