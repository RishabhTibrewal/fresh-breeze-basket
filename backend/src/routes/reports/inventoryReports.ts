import express from 'express';
import { protect } from '../../middleware/auth';
import { validateReportQuery } from '../../middleware/reportValidator';
import { requireReportPermission } from '../../middleware/reportPermission';
import {
  stockLedger,
  currentStock,
  repackSummary,
  wastageReport,
  inventoryDashboard,
} from '../../controllers/reports/inventoryReportController';

const router = express.Router();

// Dashboard KPIs (no permission gate for internal use)
router.get('/dashboard', protect, validateReportQuery, inventoryDashboard);

// Full reports
router.get('/stock-ledger',  protect, validateReportQuery, requireReportPermission('inventory.stock_ledger.view'), stockLedger);
router.get('/current-stock', protect, validateReportQuery, requireReportPermission('inventory.current_stock.view'), currentStock);
router.get('/repack-summary',protect, validateReportQuery, requireReportPermission('inventory.repack_summary.view'), repackSummary);
router.get('/wastage',       protect, validateReportQuery, requireReportPermission('inventory.wastage.view'),       wastageReport);

// Stubs for future phases
const stub = (key: string, title: string) => async (req: express.Request, res: express.Response) => {
  const { buildReportResponse } = await import('../../middleware/reportValidator');
  res.json(buildReportResponse({ reportKey: key, reportTitle: title, filters: req.reportQuery!, data: [], total: 0, page: req.reportQuery!.page, pageSize: req.reportQuery!.page_size }));
};

router.get('/valuation',         protect, validateReportQuery, requireReportPermission('inventory.valuation.view'), stub('inventory.valuation',   'Stock Valuation'));
router.get('/ageing',            protect, validateReportQuery, requireReportPermission('inventory.ageing.view'),    stub('inventory.ageing',      'Stock Ageing'));
router.get('/reorder',           protect, validateReportQuery, requireReportPermission('inventory.reorder.view'),   stub('inventory.reorder',     'Reorder Levels'));
router.get('/recipe-efficiency', protect, validateReportQuery,                                                      stub('inventory.recipe_eff',  'Recipe Efficiency'));

export default router;
