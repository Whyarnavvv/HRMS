const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  createRequest,
  getMyRequests,
  getAllRequests,
  fulfillByEmail,
  fulfillByPlatform
} = require('../controllers/salarySlipRequestController');

router.post('/', protect, createRequest);
router.get('/my', protect, getMyRequests);
router.get('/', protect, authorize('HR', 'Admin', 'AGM'), getAllRequests);
router.post('/:id/fulfill-email', protect, authorize('HR', 'Admin', 'AGM'), fulfillByEmail);
router.post('/:id/fulfill-platform', protect, authorize('HR', 'Admin', 'AGM'), fulfillByPlatform);

module.exports = router;
