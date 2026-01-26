import express from 'express';
import {
  assignWarehouseManager,
  removeWarehouseManager,
  getWarehouseManagers,
  getUserWarehouses,
  getAllWarehouseManagers
} from '../controllers/warehouseManagers';
import { protect, adminOnly } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Admin only routes
router.post('/', adminOnly, assignWarehouseManager);
router.get('/', adminOnly, getAllWarehouseManagers);
router.get('/warehouse/:warehouseId', adminOnly, getWarehouseManagers);
router.get('/user/:userId', getUserWarehouses);
router.delete('/:userId/:warehouseId', adminOnly, removeWarehouseManager);

export default router;

