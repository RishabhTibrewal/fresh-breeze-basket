import express from 'express';
import { getInventory, getInventoryByProductId, updateInventory } from '../controllers/inventory';
import { protect, adminOnly } from '../middleware/auth';

const router = express.Router();

// Public routes
router.get('/', getInventory);
router.get('/:product_id', getInventoryByProductId);

// Admin-only routes
router.put('/:product_id', protect, adminOnly, updateInventory);

export default router; 