const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const {
  trackHeartbeat,
  getMyScreenTime,
  getTeamScreenTime,
  getGlobalAnalytics,
  getAdminScreenTime,
  logIdleEvent,
  uploadScreenshot,
  getScreenshotConfig,
  setScreenshotConfig
} = require('../controllers/screenTimeController');

router.post('/heartbeat', protect, trackHeartbeat);
router.post('/idle-event', protect, logIdleEvent);
router.post('/screenshot', protect, upload.single('screenshot'), uploadScreenshot);

router.get('/my', protect, getMyScreenTime);
router.get('/team', protect, authorize('Admin', 'AGM'), getTeamScreenTime);
router.get('/global', protect, authorize('SuperAdmin'), getGlobalAnalytics);
router.get('/admin', protect, authorize('SuperAdmin'), getAdminScreenTime);

router.get('/screenshot-config', protect, authorize('SuperAdmin'), getScreenshotConfig);
router.put('/screenshot-config', protect, authorize('SuperAdmin'), setScreenshotConfig);

module.exports = router;
