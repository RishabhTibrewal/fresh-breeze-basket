import express from 'express';
import {
  createSupplier,
  getSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
  createLinkedCustomerFromSupplier
} from '../controllers/suppliers';
import { protect, adminOnly } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Admin only routes
router.post('/', adminOnly, createSupplier);
router.post('/:id/create-linked-customer', adminOnly, createLinkedCustomerFromSupplier);
router.get('/', getSuppliers);
router.get('/:id', getSupplierById);
router.put('/:id', adminOnly, updateSupplier);
router.delete('/:id', adminOnly, deleteSupplier);

export default router;
