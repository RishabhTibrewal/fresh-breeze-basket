import express from 'express';
import { 
  addProductImage,
  getProductImages,
  updateProductImage,
  deleteProductImage,
  bulkAddProductImages
} from '../controllers/productImages';
import { protect, adminOnly } from '../middleware/auth';

const router = express.Router();

// Public routes
router.get('/:product_id', getProductImages);

// Admin only routes
router.post('/:product_id', protect, adminOnly, addProductImage);
router.post('/:product_id/bulk', protect, adminOnly, bulkAddProductImages);
router.put('/:id', protect, adminOnly, updateProductImage);
router.delete('/:id', protect, adminOnly, deleteProductImage);

export default router; 