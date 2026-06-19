const express = require('express');
const router  = express.Router();
const {
  assetInventoryReport,
  employeeAssetReport,
  damagedAssetReport,
  lostAssetReport,
  credentialAuditReport,
  getReportFilters,
} = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All report routes require authentication and management-level roles.
// Credential audit is restricted to SuperAdmin / Admin / HR only.
const REPORT_ROLES = ['Admin', 'HR', 'AGM', 'Manager', 'SuperAdmin'];
const CRED_ROLES   = ['Admin', 'HR', 'SuperAdmin'];

// GET /api/reports/filters — dropdown data for the report builder UI
router.get('/filters',
  protect, authorize(...REPORT_ROLES),
  getReportFilters
);

// GET /api/reports/asset-inventory?format=excel|csv|pdf&category=&status=&dateFrom=&dateTo=
router.get('/asset-inventory',
  protect, authorize(...REPORT_ROLES),
  assetInventoryReport
);

// GET /api/reports/employee-asset?format=&employeeId=&department=&category=&dateFrom=&dateTo=
router.get('/employee-asset',
  protect, authorize(...REPORT_ROLES),
  employeeAssetReport
);

// GET /api/reports/damaged?format=&employeeId=&department=&category=&dateFrom=&dateTo=
router.get('/damaged',
  protect, authorize(...REPORT_ROLES),
  damagedAssetReport
);

// GET /api/reports/lost?format=&employeeId=&department=&category=&dateFrom=&dateTo=
router.get('/lost',
  protect, authorize(...REPORT_ROLES),
  lostAssetReport
);

// GET /api/reports/credential-audit?format=&employeeId=&department=&action=&dateFrom=&dateTo=
router.get('/credential-audit',
  protect, authorize(...CRED_ROLES),
  credentialAuditReport
);

module.exports = router;
