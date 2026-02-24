import express from 'express';
import {
  getVariantPrices,
  getPriceById,
  createPrice,
  updatePrice,
  deletePrice,
} from '../controllers/prices';
import { protect, adminOnly } from '../middleware/auth';
import { hasAnyRole } from '../utils/roles';

const router = express.Router();

// Variant price routes
router.get('/variants/:variantId', getVariantPrices);
router.post(
  '/variants/:variantId',
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
  createPrice
);

// Price CRUD routes
router.get('/:id', getPriceById);
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
  updatePrice
);
router.delete('/:id', protect, adminOnly, deletePrice);

export default router;

