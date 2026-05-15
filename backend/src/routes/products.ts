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
import { protect, adminOnly, requireRole } from '../middleware/auth';
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
// Sales can add variants; only admin can edit/delete
router.post('/:id/variants', protect, requireRole(['admin', 'accounts', 'sales']), createVariant);
router.put('/variants/:variantId', protect, adminOnly, updateVariant);
router.delete('/variants/:variantId', protect, adminOnly, deleteVariant);

// Products: sales can add; only admin can edit/delete
router.post('/', protect, requireRole(['admin', 'accounts', 'sales']), createProduct);
router.put('/:id', protect, adminOnly, updateProduct);
router.delete('/:id', protect, adminOnly, deleteProduct);

export default router; 