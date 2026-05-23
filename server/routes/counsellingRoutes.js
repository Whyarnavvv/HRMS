const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { createLog, getLogs, getMyLogs } = require('../controllers/counsellingController');

router.post('/', protect, authorize('Counselling Team'), upload.single('screenshot'), createLog);
router.get('/', protect, authorize('SuperAdmin'), getLogs);
router.get('/my', protect, authorize('Counselling Team'), getMyLogs);

module.exports = router;
