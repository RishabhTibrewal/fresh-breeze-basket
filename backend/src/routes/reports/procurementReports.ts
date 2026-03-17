import express from 'express';
import { protect } from '../../middleware/auth';
import { validateReportQuery } from '../../middleware/reportValidator';
import { requireReportPermission } from '../../middleware/reportPermission';
import {
  invoiceRegister,
  grnReport,
  vendorWisePurchase,
  supplierPaymentRegister,
  procurementDashboard,
} from '../../controllers/reports/procurementReportController';

const router = express.Router();

// Dashboard KPIs
router.get('/dashboard',         protect, validateReportQuery, procurementDashboard);

// Implemented reports
router.get('/invoice-register',  protect, validateReportQuery, requireReportPermission('procurement.invoice_register.view'), invoiceRegister);
router.get('/grn-report',        protect, validateReportQuery, requireReportPermission('procurement.grn_report.view'),       grnReport);
router.get('/vendor-wise',       protect, validateReportQuery, requireReportPermission('procurement.vendor_wise.view'),      vendorWisePurchase);
router.get('/payment-register',  protect, validateReportQuery, requireReportPermission('procurement.payment_register.view'),supplierPaymentRegister);

// Stubs for future reports
const stub = (key: string, title: string) => async (req: express.Request, res: express.Response) => {
  const { buildReportResponse } = await import('../../middleware/reportValidator');
  res.json(buildReportResponse({ reportKey: key, reportTitle: title, filters: req.reportQuery!, data: [], total: 0, page: req.reportQuery!.page, pageSize: req.reportQuery!.page_size }));
};

router.get('/pending-receipts',  protect, validateReportQuery, stub('procurement.pending_receipts', 'Pending Receipts'));
router.get('/rate-comparison',   protect, validateReportQuery, stub('procurement.rate_comparison',  'Rate Comparison'));

export default router;
