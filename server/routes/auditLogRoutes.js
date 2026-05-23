const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { getAuditLogs, getAuditDepartments, getUsersByDepartment } = require('../controllers/auditLogController');

router.get('/departments', protect, authorize('SuperAdmin'), getAuditDepartments);
router.get('/users-by-department', protect, authorize('SuperAdmin'), getUsersByDepartment);
router.get('/', protect, authorize('SuperAdmin'), getAuditLogs);

module.exports = router;
