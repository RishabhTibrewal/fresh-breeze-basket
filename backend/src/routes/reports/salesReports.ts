import express from 'express';
import { protect } from '../../middleware/auth';
import { validateReportQuery } from '../../middleware/reportValidator';
import { requireReportPermission } from '../../middleware/reportPermission';
import {
  salesOrderSummary,
  salespersonPerformance,
  customerWiseSales,
  productWiseSales,
  targetVsAchievement,
  pendingDeliveries,
  salesReturns,
  salesDashboard,
} from '../../controllers/reports/salesReportController';

const router = express.Router();

// Dashboard KPIs (no export, lighter query)
router.get('/dashboard',               protect, validateReportQuery, salesDashboard);

// Full reports with export support
router.get('/order-summary',           protect, validateReportQuery, requireReportPermission('sales.order_summary.view'),         salesOrderSummary);
router.get('/salesperson-performance', protect, validateReportQuery, requireReportPermission('sales.salesperson.view'),           salespersonPerformance);
router.get('/customer-wise',           protect, validateReportQuery, requireReportPermission('sales.customer_wise.view'),         customerWiseSales);
router.get('/product-wise',            protect, validateReportQuery, requireReportPermission('sales.product_wise.view'),          productWiseSales);
router.get('/target-vs-achievement',   protect, validateReportQuery, requireReportPermission('sales.target_vs_achievement.view'), targetVsAchievement);
router.get('/pending-deliveries',      protect, validateReportQuery, requireReportPermission('sales.pending_deliveries.view'),    pendingDeliveries);
router.get('/returns',                 protect, validateReportQuery, requireReportPermission('sales.returns.view'),               salesReturns);

// Stub endpoints for Phase 3+
router.get('/price-variance',          protect, validateReportQuery, requireReportPermission('sales.price_variance.view'),        async (req, res) => {
  const { buildReportResponse } = await import('../../middleware/reportValidator');
  res.json(buildReportResponse({ reportKey: 'sales.price_variance', reportTitle: 'Price Variance', filters: req.reportQuery!, data: [], total: 0, page: req.reportQuery!.page, pageSize: req.reportQuery!.page_size }));
});
router.get('/region-territory',        protect, validateReportQuery, requireReportPermission('sales.region_territory.view'),      async (req, res) => {
  const { buildReportResponse } = await import('../../middleware/reportValidator');
  res.json(buildReportResponse({ reportKey: 'sales.region_territory', reportTitle: 'Region/Territory Report', filters: req.reportQuery!, data: [], total: 0, page: req.reportQuery!.page, pageSize: req.reportQuery!.page_size }));
});

export default router;
