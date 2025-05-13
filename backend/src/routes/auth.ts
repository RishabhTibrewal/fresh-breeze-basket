import express from 'express';
import { 
  register,
  login,
  logout,
  getCurrentUser,
  updateProfile,
  addAddress,
  getAddresses,
  deleteAddress,
  updateAddress,
  checkAdminStatus,
  updateRole,
  syncSession
} from '../controllers/auth';
import { protect } from '../middleware/auth';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.post('/logout', protect, logout);
router.get('/me', protect, getCurrentUser);
router.put('/profile', protect, updateProfile);
router.post('/addresses', protect, addAddress);
router.get('/addresses', protect, getAddresses);
router.put('/addresses/:id', protect, updateAddress);
router.delete('/addresses/:id', protect, deleteAddress);
router.get('/check-admin', protect, checkAdminStatus);

// Sync session with backend
router.post('/sync-session', protect, syncSession);

// Update role route
router.put('/role', protect, updateRole);

export default router; 