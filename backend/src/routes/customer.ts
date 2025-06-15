import express from 'express';
import { protect } from '../middleware/auth';
import { getCustomerDetails } from '../controllers/customer';
import { getCustomersWithCredit } from '../controllers/customerController';

const router = express.Router();

// Get customer details
router.get('/me', protect, getCustomerDetails);

// Get all customers with credit information
router.get('/credit', protect, getCustomersWithCredit);

export default router; 