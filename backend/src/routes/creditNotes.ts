import { Router } from 'express';
import { protect } from '../middleware/auth';
import {
  listCreditNotes,
  createCreditNote,
  createManualCreditNote,
  updateCreditNoteStatus,
  getOrderCreditNote,
} from '../controllers/creditNoteController';

const router = Router();

// All routes require authentication (tenant resolved globally in index.ts)
router.use(protect);

router.get('/', listCreditNotes);
router.post('/', createCreditNote);
router.post('/manual', createManualCreditNote);
router.patch('/:id/status', updateCreditNoteStatus);
router.get('/order/:order_id', getOrderCreditNote);

export default router;
