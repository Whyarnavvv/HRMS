const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { getAuditLogs } = require('../controllers/auditLogController');

router.get('/', protect, authorize('SuperAdmin'), getAuditLogs);

module.exports = router;
