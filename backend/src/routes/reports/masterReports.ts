import express from 'express';
import { protect } from '../../middleware/auth';
import { validateReportQuery } from '../../middleware/reportValidator';
import { requireReportPermission } from '../../middleware/reportPermission';
import {
  productMaster,
  customerMaster,
  supplierMaster,
  userMaster,
  activitySummary,
  masterDashboard,
} from '../../controllers/reports/masterReportController';

const router = express.Router();

// Dashboard KPIs (counts only — no permission guard)
router.get('/dashboard',   protect,                                                                    masterDashboard);

// Master list reports
router.get('/products',    protect, validateReportQuery, requireReportPermission('master.products.view'),  productMaster);
router.get('/customers',   protect, validateReportQuery, requireReportPermission('master.customers.view'), customerMaster);
router.get('/suppliers',   protect, validateReportQuery, requireReportPermission('master.suppliers.view'), supplierMaster);
router.get('/users',       protect, validateReportQuery, requireReportPermission('master.users.view'),     userMaster);
router.get('/activity',    protect, validateReportQuery, requireReportPermission('master.activity.view'),  activitySummary);

export default router;
