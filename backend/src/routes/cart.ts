import express from 'express';
import { protect } from '../middleware/auth';
import {
    getCart,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart
} from '../controllers/cart';

const router = express.Router();

// All cart routes require authentication
router.use(protect);

// Get user's cart
router.get('/', getCart);

// Add item to cart
router.post('/', addToCart);

// Update cart item quantity
router.put('/:id', updateCartItem);

// Remove item from cart
router.delete('/:id', removeFromCart);

// Clear cart
router.delete('/', clearCart);

export default router; 