import express from 'express';
import { protect } from '../middleware/auth';
import { partyController } from '../controllers/partyController';

const router = express.Router();

// All party routes are protected and tenant-scoped
router.use(protect);

router.get('/', partyController.list);
router.get('/:id', partyController.getById);
router.post('/', partyController.create);
router.patch('/:id/link-customer', partyController.linkCustomer);
router.patch('/:id/link-supplier', partyController.linkSupplier);
router.get('/:id/ledger', partyController.getLedger);

export default router;

