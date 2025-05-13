import express from 'express';
import { protect } from '../middleware/auth';
import { getCustomerDetails } from '../controllers/customer';

const router = express.Router();

// Get customer details
router.get('/me', protect, getCustomerDetails);

export default router; 