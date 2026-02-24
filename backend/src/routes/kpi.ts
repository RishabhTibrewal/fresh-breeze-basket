import express from 'express';
import { getModuleKPIs } from '../controllers/kpiController';
import { protect } from '../middleware/auth';

const router = express.Router();

// All KPI routes require authentication
router.use(protect);

// Get KPIs for a specific module
router.get('/:moduleKey', getModuleKPIs);

export default router;
