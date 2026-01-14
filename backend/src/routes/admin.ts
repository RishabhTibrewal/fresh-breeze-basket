import express from 'express';
import { protect, adminOnly } from '../middleware/auth';
import {
  getAllUsers,
  getDashboardStats,
  updateUserRole,
  getSalesExecutives,
  getSalesTargets,
  getSalesTargetById,
  createSalesTarget,
  updateSalesTarget,
  deleteSalesTarget,
  getAllLeads,
  getLeadByIdAdmin,
  createLeadAdmin,
  updateLeadAdmin,
  deleteLeadAdmin
} from '../controllers/admin';

const router = express.Router();

// Apply authentication middleware to all admin routes
router.use(protect);
router.use(adminOnly);

// Get all users (admin only)
router.get('/users', getAllUsers);

// Get dashboard statistics (admin only)
router.get('/dashboard-stats', getDashboardStats);

// Update user role (admin only)
router.put('/users/:userId/role', updateUserRole);

// Get sales executives (admin only)
router.get('/sales-executives', getSalesExecutives);

// Sales Targets Management (admin only)
router.get('/sales-targets', getSalesTargets);
router.get('/sales-targets/:id', getSalesTargetById);
router.post('/sales-targets', createSalesTarget);
router.put('/sales-targets/:id', updateSalesTarget);
router.delete('/sales-targets/:id', deleteSalesTarget);

// Leads Management (admin only)
router.get('/leads', getAllLeads);
router.get('/leads/:id', getLeadByIdAdmin);
router.post('/leads', createLeadAdmin);
router.put('/leads/:id', updateLeadAdmin);
router.delete('/leads/:id', deleteLeadAdmin);

export default router; 