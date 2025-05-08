import express from 'express';
import { orderController } from '../controllers/orderController';
import { isSalesExecutive } from '../middleware/auth';

const router = express.Router();

// Sales executive routes
router.post('/customer/:customer_id', isSalesExecutive, orderController.createOrder);
router.get('/customer/:customer_id', isSalesExecutive, orderController.getCustomerOrders);
router.get('/:order_id', isSalesExecutive, orderController.getOrder);
router.patch('/:order_id/status', isSalesExecutive, orderController.updateOrderStatus);

export default router; 