import express from 'express';
import { protect, adminOnly } from '../middleware/auth';
import {
  getCollections,
  getCollection,
  createCollection,
  updateCollection,
  deleteCollection,
  assignVariantsToCollection
} from '../controllers/collectionController';

const router = express.Router();

// Apply protect middleware to all routes -> req.user and req.companyId
router.use(protect);

// Public/Customer Routes
router.get('/', getCollections);
router.get('/:idOrSlug', getCollection);

// Admin Routes
router.post('/', adminOnly, createCollection);
router.put('/:id', adminOnly, updateCollection);
router.delete('/:id', adminOnly, deleteCollection);
router.post('/:id/assignments', adminOnly, assignVariantsToCollection);

export default router;
