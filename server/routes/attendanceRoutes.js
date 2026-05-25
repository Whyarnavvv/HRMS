const express = require('express');
const router = express.Router();
const { checkIn, checkOut, getMyHistory, getAllAttendance, getMonthlyAttendance, getTodayRecord, updateAttendanceStatus, getTeamAttendanceDashboard } = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { auditLogger } = require('../middleware/auditLogger');

router.post('/check-in', protect, auditLogger({ action: 'CHECK_IN', module: 'ATTENDANCE', targetEntity: 'Attendance' }), checkIn);
router.post('/check-out', protect, auditLogger({ action: 'CHECK_OUT', module: 'ATTENDANCE', targetEntity: 'Attendance' }), checkOut);
router.get('/my-history', protect, getMyHistory);
router.get('/today', protect, getTodayRecord);
router.get('/all', protect, authorize('Admin', 'HR', 'AGM'), getAllAttendance);
router.get('/monthly/:year/:month', protect, getMonthlyAttendance);
router.patch('/status', protect, authorize('Admin', 'AGM', 'SuperAdmin'), auditLogger({ action: 'UPDATE_STATUS', module: 'ATTENDANCE', targetEntity: 'Attendance' }), updateAttendanceStatus);
router.get('/team-dashboard', protect, authorize('HR', 'Admin', 'AGM', 'SuperAdmin'), getTeamAttendanceDashboard);
router.get('/team-today', protect, authorize('Manager', 'HR', 'Admin', 'AGM', 'SuperAdmin'), require('../controllers/attendanceController').getTeamTodayAttendance);

module.exports = router;
