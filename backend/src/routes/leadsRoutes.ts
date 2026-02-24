import express from 'express';
import {
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  getLeadStats,
  logCall,
  rescheduleFollowUp,
  markAsWon,
  getFollowUpReminders,
  getAgingLeads
} from '../controllers/leadsController';
import { protect, requireRole } from '../middleware/auth';

const router = express.Router();

// All routes require authentication and admin or sales role
router.use(protect);
router.use(requireRole(['admin', 'sales']));

// Lead statistics
router.get('/stats', getLeadStats);

// Alerts and reminders
router.get('/reminders/follow-up', getFollowUpReminders);
router.get('/reminders/aging', getAgingLeads);

// Quick actions
router.post('/:id/log-call', logCall);
router.post('/:id/reschedule', rescheduleFollowUp);
router.post('/:id/mark-won', markAsWon);

// CRUD operations
router.get('/', getLeads);
router.get('/:id', getLeadById);
router.post('/', createLead);
router.put('/:id', updateLead);
router.delete('/:id', deleteLead);

export default router;
