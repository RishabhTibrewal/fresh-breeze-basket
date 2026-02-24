import express from 'express';
import {
  getBrands,
  getActiveBrands,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand,
  getBrandProducts,
} from '../controllers/brands';
import { protect, adminOnly } from '../middleware/auth';
import { hasAnyRole } from '../utils/roles';

const router = express.Router();

// Public routes
router.get('/', getBrands);
router.get('/active', getActiveBrands);
router.get('/:id', getBrandById);
router.get('/:id/products', getBrandProducts);

// Admin and sales routes (create/update)
router.post(
  '/',
  protect,
  async (req, res, next) => {
    try {
      if (!req.user?.id || !req.companyId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const isAdminOrSales = await hasAnyRole(req.user.id, req.companyId, ['admin', 'sales']);
      if (!isAdminOrSales) {
        return res.status(403).json({ error: 'Admin or sales access required' });
      }
      next();
    } catch (error) {
      next(error);
    }
  },
  createBrand
);

router.put(
  '/:id',
  protect,
  async (req, res, next) => {
    try {
      if (!req.user?.id || !req.companyId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const isAdminOrSales = await hasAnyRole(req.user.id, req.companyId, ['admin', 'sales']);
      if (!isAdminOrSales) {
        return res.status(403).json({ error: 'Admin or sales access required' });
      }
      next();
    } catch (error) {
      next(error);
    }
  },
  updateBrand
);

// Admin only routes (delete)
router.delete('/:id', protect, adminOnly, deleteBrand);

export default router;

