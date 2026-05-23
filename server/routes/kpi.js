const express = require('express');
const router = express.Router();
const {
  manageKpi,
  getKpiHistory,
  getLeaderboard,
  getMonthlyLeaderboard,
  getEmployeeOfMonth,
  getEmployeeOfYear,
  getYearlyIncrement,
  getYearlyMaxKpi,
  setYearlyMaxKpi
} = require('../controllers/kpiController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/manage', protect, authorize('Admin', 'HR', 'AGM', 'SuperAdmin'), manageKpi);
router.get('/history/:employeeId', protect, getKpiHistory);
router.get('/leaderboard', protect, getLeaderboard);
router.get('/monthly-leaderboard', protect, getMonthlyLeaderboard);
router.get('/employee-of-month', protect, getEmployeeOfMonth);
router.get('/employee-of-year', protect, getEmployeeOfYear);
router.get('/yearly-increment', protect, authorize('Admin', 'HR', 'AGM', 'SuperAdmin'), getYearlyIncrement);
router.get('/yearly-max', protect, authorize('Admin', 'HR', 'AGM', 'SuperAdmin'), getYearlyMaxKpi);
router.put('/yearly-max', protect, authorize('Admin', 'HR', 'AGM', 'SuperAdmin'), setYearlyMaxKpi);

module.exports = router;
