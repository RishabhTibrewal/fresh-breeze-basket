import express from 'express';
import { protect } from '../middleware/auth';
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  createCustomerWithUser,
  updateCustomer,
  deleteCustomer,
  addAddressForCustomer,
  getCustomersWithCredit
} from '../controllers/customerController';
import { getCustomerAddresses } from '../controllers/auth';
import { orderController } from '../controllers/orderController';

const router = express.Router();

// All routes are protected
router.use(protect);

// Get all customers
router.get('/', getCustomers);

// Get all customers with credit information
router.get('/credit', getCustomersWithCredit);

// Get customer by ID
router.get('/:id', getCustomerById);

// Get customer addresses
router.get('/:id/addresses', getCustomerAddresses);

// Get customer orders
router.get('/:id/orders', orderController.getCustomerOrders);

// Get specific customer order
router.get('/:id/orders/:order_id', orderController.getOrder);

// Create order for customer
router.post('/:id/orders', orderController.createOrder);

// Add address for a customer
router.post('/:id/address', addAddressForCustomer);

// Create new customer
router.post('/', createCustomer);

// Create new customer with user account
router.post('/with-user', createCustomerWithUser);

// Update customer
router.put('/:id', updateCustomer);

// Delete customer
router.delete('/:id', deleteCustomer);

export default router; 