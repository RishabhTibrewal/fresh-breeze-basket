import express from 'express';
import { createPOSOrder } from '../controllers/pos';
import { protect } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(protect);

// POS routes
router.post('/orders', createPOSOrder);

export default router;
