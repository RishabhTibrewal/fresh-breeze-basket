import express from 'express';
import { protect, adminOnly } from '../middleware/auth';
import {
  getAllWarehouses,
  getWarehouseById,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  getWarehouseInventory,
  getProductStockAcrossWarehouses,
  getBulkProductStock
} from '../controllers/warehouses';

const router = express.Router();

// Public routes (for sales executives to view active warehouses)
router.get('/', protect, getAllWarehouses);
router.get('/:warehouseId', protect, getWarehouseById);
router.get('/:warehouseId/inventory', protect, getWarehouseInventory);
router.get('/products/:productId/stock', protect, getProductStockAcrossWarehouses);
router.post('/products/bulk-stock', protect, getBulkProductStock);

// Admin only routes
router.post('/', protect, adminOnly, createWarehouse);
router.put('/:id', protect, adminOnly, updateWarehouse);
router.delete('/:id', protect, adminOnly, deleteWarehouse);

export default router;
