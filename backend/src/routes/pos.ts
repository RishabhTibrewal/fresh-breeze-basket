import express from 'express';
import { createPOSOrder, getActiveSession, startSession, closeSession } from '../controllers/pos';
import { protect } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(protect);

// POS routes
router.post('/orders', createPOSOrder);
router.get('/sessions/active', getActiveSession);
router.post('/sessions', startSession);
router.post('/sessions/:id/close', closeSession);

export default router;
