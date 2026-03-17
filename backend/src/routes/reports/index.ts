import express from 'express';
import salesReportsRouter from './salesReports';
import inventoryReportsRouter from './inventoryReports';
import procurementReportsRouter from './procurementReports';
import accountingReportsRouter from './accountingReports';
import masterReportsRouter from './masterReports';

const router = express.Router();

// Mount all module report routers
router.use('/sales',       salesReportsRouter);
router.use('/inventory',   inventoryReportsRouter);
router.use('/procurement', procurementReportsRouter);
router.use('/accounting',  accountingReportsRouter);
router.use('/master',      masterReportsRouter);

// /api/reports/health
router.get('/health', (_req, res) => {
  res.json({ success: true, module: 'reports', version: '1.0.0' });
});

export default router;
