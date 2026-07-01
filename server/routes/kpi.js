const express = require('express');
const router  = express.Router();
const {
  manageKpi,
  getKpiHistory,
  getLeaderboard,
  getMonthlyLeaderboard,
  getYearlyLeaderboard,
  getMyKpiDashboard,
  getEmployeeOfMonth,
  getEmployeeOfYear,
  getYearlyIncrement,
  getYearlyMaxKpi,
  setYearlyMaxKpi,
  getFiscalYears
} = require('../controllers/kpiController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Manual KPI management (privileged roles only)
router.post('/manage', protect, authorize('Admin', 'HR', 'AGM', 'SuperAdmin'), manageKpi);

// KPI history — any authenticated user can view; controller handles visibility
router.get('/history/:employeeId', protect, getKpiHistory);

// Leaderboards
router.get('/leaderboard',          protect, getLeaderboard);          // all-time
router.get('/monthly-leaderboard',  protect, getMonthlyLeaderboard);   // ?month=&year=
router.get('/yearly-leaderboard',   protect, getYearlyLeaderboard);    // ?year=

// Employee KPI dashboard (self-service + admin view)
// Employees: own stats only. Admins/HR/AGM: any employee via ?employeeId=
router.get('/my-dashboard', protect, getMyKpiDashboard);

// Awards
router.get('/employee-of-month', protect, getEmployeeOfMonth);
router.get('/employee-of-year',  protect, getEmployeeOfYear);

// Yearly increment & max-points config (privileged only)
// GET  /api/kpi/yearly-increment          → auto-detect active fiscal year
// GET  /api/kpi/yearly-increment?label=X  → specific fiscal year by label
// GET  /api/kpi/yearly-increment?year=N   → legacy calendar year fallback
router.get('/yearly-increment', protect, authorize('Admin', 'HR', 'AGM', 'SuperAdmin'), getYearlyIncrement);
router.get('/yearly-max',       protect, authorize('Admin', 'HR', 'AGM', 'SuperAdmin'), getYearlyMaxKpi);
router.put('/yearly-max',       protect, authorize('Admin', 'HR', 'AGM', 'SuperAdmin'), setYearlyMaxKpi);

// Fiscal year list — returns only fiscal-year entries (label + startDate + endDate)
// Used by the admin UI to populate the fiscal-year selector dropdown.
router.get('/fiscal-years', protect, authorize('Admin', 'HR', 'AGM', 'SuperAdmin'), getFiscalYears);

module.exports = router;
