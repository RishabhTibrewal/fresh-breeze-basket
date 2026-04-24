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
  hourlyHeatmap,
  paymentMix,
  fulfillmentMix,
  discountImpact,
  cashierPerformance,
  categoryBrandSales,
  basketMetrics,
  modifierRevenue,
  trendComparison,
  topBottomMovers,
  outletLeaderboard,
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

// High-impact POS analytics reports
router.get('/hourly-heatmap',          protect, validateReportQuery, requireReportPermission('sales.hourly_heatmap.view'),        hourlyHeatmap);
router.get('/payment-mix',             protect, validateReportQuery, requireReportPermission('sales.payment_mix.view'),           paymentMix);
router.get('/fulfillment-mix',         protect, validateReportQuery, requireReportPermission('sales.fulfillment_mix.view'),       fulfillmentMix);
router.get('/discount-impact',         protect, validateReportQuery, requireReportPermission('sales.discount_impact.view'),       discountImpact);
router.get('/cashier-performance',     protect, validateReportQuery, requireReportPermission('pos.cashier_performance.view'),     cashierPerformance);

// Medium-effort insight reports (Batch B)
router.get('/category-brand',          protect, validateReportQuery, requireReportPermission('sales.category_brand.view'),        categoryBrandSales);
router.get('/basket-metrics',          protect, validateReportQuery, requireReportPermission('sales.basket_metrics.view'),        basketMetrics);
router.get('/modifier-revenue',        protect, validateReportQuery, requireReportPermission('sales.modifier_revenue.view'),      modifierRevenue);
router.get('/trend-comparison',        protect, validateReportQuery, requireReportPermission('sales.trend_comparison.view'),      trendComparison);
router.get('/movers',                  protect, validateReportQuery, requireReportPermission('sales.movers.view'),                topBottomMovers);
router.get('/outlet-leaderboard',      protect, validateReportQuery, requireReportPermission('sales.outlet_leaderboard.view'),    outletLeaderboard);

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
