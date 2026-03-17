import express from 'express';
import { protect } from '../../middleware/auth';
import { validateReportQuery } from '../../middleware/reportValidator';
import { requireReportPermission } from '../../middleware/reportPermission';
import {
  revenueExpenseSummary,
  paymentCollections,
  taxCollectionReport,
  cashFlowSummary,
  accountingDashboard,
} from '../../controllers/reports/accountingReportController';

const router = express.Router();

// Dashboard KPIs
router.get('/dashboard',         protect, validateReportQuery, accountingDashboard);

// Implemented reports
router.get('/revenue-expense',   protect, validateReportQuery, requireReportPermission('accounting.rev_exp.view'),  revenueExpenseSummary);
router.get('/payment-collections',protect, validateReportQuery, requireReportPermission('accounting.payments.view'), paymentCollections);
router.get('/tax-collection',    protect, validateReportQuery, requireReportPermission('accounting.tax.view'),       taxCollectionReport);
router.get('/cash-flow',         protect, validateReportQuery, requireReportPermission('accounting.cash_flow.view'), cashFlowSummary);

export default router;
