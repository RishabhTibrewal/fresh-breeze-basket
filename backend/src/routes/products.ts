import express from 'express';
import { 
  getProducts, 
  getProductById, 
  createProduct, 
  updateProduct, 
  deleteProduct,
  getProductVariants,
  getVariantById,
  createVariant,
  updateVariant,
  deleteVariant
} from '../controllers';
import { protect, adminOnly } from '../middleware/auth';
import { deprecationWarning } from '../middleware/deprecation';

const router = express.Router();

// Apply deprecation warnings to all routes
router.use(deprecationWarning);

// Public routes
router.get('/', getProducts);
router.get('/:id', getProductById);
router.get('/:id/variants', getProductVariants);

// Variant routes
router.get('/variants/:variantId', getVariantById);
router.post('/:id/variants', protect, adminOnly, createVariant);
router.put('/variants/:variantId', protect, adminOnly, updateVariant);
router.delete('/variants/:variantId', protect, adminOnly, deleteVariant);

// Admin only routes
router.post('/', protect, adminOnly, createProduct);
router.put('/:id', protect, adminOnly, updateProduct);
router.delete('/:id', protect, adminOnly, deleteProduct);

export default router; 