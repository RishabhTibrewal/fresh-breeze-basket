import express from 'express';
import {
  assignPosManager,
  removePosManager,
  getPosManagers,
  getUserPosOutlets,
  getAllPosManagers
} from '../controllers/posManagers';
import { protect, adminOnly } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Admin/Accounts only routes
router.post('/', adminOnly, assignPosManager);
router.get('/', adminOnly, getAllPosManagers);
router.get('/warehouse/:warehouseId', adminOnly, getPosManagers);
router.get('/user/:userId', getUserPosOutlets);
router.delete('/:userId/:warehouseId', adminOnly, removePosManager);

export default router;
