import { Router } from 'express';
import { getQuotations, getQuotationById, createQuotation, acceptQuotation, updateQuotationStatus } from '../controllers/quotationController';
import { protect, requireRole } from '../middleware/auth';

const router = Router();

// Apply middleware to all routes
router.use(protect);
router.use(requireRole(['admin', 'sales']));

router.get('/', getQuotations);
router.get('/:id', getQuotationById);
router.post('/', createQuotation);
router.post('/:id/accept', acceptQuotation);
router.patch('/:id/status', updateQuotationStatus);

export default router;
