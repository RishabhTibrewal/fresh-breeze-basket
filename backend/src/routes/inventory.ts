import express from 'express';
import {
    getInventory,
    getInventoryByProductId,
    updateInventory,
    recordStockMovement,
    adjustStock,
    transferStock,
    getStockMovements,
} from '../controllers/inventory';
import { protect, adminOnly } from '../middleware/auth';

const router = express.Router();

// Public routes
router.get('/', getInventory);
// Specific routes must come before parameterized routes
router.get('/movements', protect, getStockMovements);


// Parameterized routes last (so "packaging-recipes" etc. are not captured as product_id)
router.get('/:product_id', getInventoryByProductId);
router.put('/:product_id', protect, adminOnly, updateInventory);
// Industry-agnostic stock movement endpoint
router.post('/move', protect, adminOnly, recordStockMovement);
// Stock adjustment endpoint (physical vs system reconciliation)
router.post('/adjust', protect, adminOnly, adjustStock);
// Stock transfer endpoint (between warehouses)
router.post('/transfer', protect, adminOnly, transferStock);

export default router; 