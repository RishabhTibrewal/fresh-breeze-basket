import express from 'express';
import {
    getInventory,
    getInventoryByProductId,
    updateInventory,
    recordStockMovement,
    adjustStock,
    transferStock,
    getStockMovements,
    getPackagingRecipes,
    createPackagingRecipe,
    updatePackagingRecipe,
    deletePackagingRecipe,
    getRepackOrders,
    getRepackOrderById,
    createRepackOrder,
    updateRepackOrder,
    processRepackOrder,
    deleteRepackOrder,
} from '../controllers/inventory';
import { protect, adminOnly } from '../middleware/auth';

const router = express.Router();

// Public routes
router.get('/', getInventory);
// Specific routes must come before parameterized routes
router.get('/movements', protect, getStockMovements);

// Packaging recipes (literal path – before /:product_id)
router.get('/packaging-recipes', protect, getPackagingRecipes);
router.post('/packaging-recipes', protect, adminOnly, createPackagingRecipe);
router.put('/packaging-recipes/:id', protect, adminOnly, updatePackagingRecipe);
router.delete('/packaging-recipes/:id', protect, adminOnly, deletePackagingRecipe);

// Repack orders (literal path – before /:product_id)
router.get('/repack-orders', protect, getRepackOrders);
router.get('/repack-orders/:id', protect, getRepackOrderById);
router.post('/repack-orders', protect, adminOnly, createRepackOrder);
router.put('/repack-orders/:id', protect, adminOnly, updateRepackOrder);
router.post('/repack-orders/:id/process', protect, adminOnly, processRepackOrder);
router.delete('/repack-orders/:id', protect, adminOnly, deleteRepackOrder);

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