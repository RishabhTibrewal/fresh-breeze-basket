import express from 'express';
import { getTaxes, getActiveTaxes, getTaxById, createTax, updateTax, deleteTax } from '../controllers/taxes';
import { protect, adminOnly } from '../middleware/auth';

const router = express.Router();

// Public routes (require company context)
router.get('/', getTaxes);
router.get('/active', getActiveTaxes);
router.get('/:id', getTaxById);

// Protected admin routes
router.post('/', protect, adminOnly, createTax);
router.put('/:id', protect, adminOnly, updateTax);
router.delete('/:id', protect, adminOnly, deleteTax);

export default router;

