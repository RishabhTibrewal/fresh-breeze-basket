import express from 'express';
import { protect } from '../middleware/auth';
import {
  listKotTickets,
  getKotTicket,
  patchKotTicketStatus,
  reprintKotTicket,
  getKotSettings,
  upsertKotSettings,
  listFoodCounters,
  createFoodCounter,
  patchFoodCounter,
  listProductMappingsForOutlet,
  upsertProductMapping,
  deleteProductMapping,
} from '../controllers/kotController';

const router = express.Router();
router.use(protect);

router.get('/settings', getKotSettings);
router.put('/settings', upsertKotSettings);

router.get('/counters', listFoodCounters);
router.post('/counters', createFoodCounter);
router.patch('/counters/:id', patchFoodCounter);

router.get('/product-mappings', listProductMappingsForOutlet);
router.post('/product-mappings', upsertProductMapping);
router.delete('/product-mappings/:productId', deleteProductMapping);

router.get('/tickets', listKotTickets);
router.get('/tickets/:ticketId', getKotTicket);
router.patch('/tickets/:ticketId/status', patchKotTicketStatus);
router.post('/tickets/:ticketId/reprint', reprintKotTicket);

export default router;
