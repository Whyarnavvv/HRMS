const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { auditLogger } = require('../middleware/auditLogger');
const {
  createWFHRequest,
  getMyWFHRequests,
  getAllWFHRequests,
  approveWFHRequest,
  rejectWFHRequest,
  getMyActiveWFH,
  getEmployeeLocationForWFH
} = require('../controllers/wfhRequestController');

router.post('/', protect, auditLogger({ action: 'CREATE_WFH_REQUEST', module: 'WFH', targetEntity: 'WFHRequest' }), createWFHRequest);
router.get('/my', protect, getMyWFHRequests);
router.get('/my-active', protect, getMyActiveWFH);
router.get('/', protect, authorize('Admin', 'AGM'), getAllWFHRequests);
router.get('/:id/employee-location', protect, authorize('Admin', 'AGM'), getEmployeeLocationForWFH);
router.patch('/:id/approve', protect, authorize('Admin', 'AGM'), auditLogger({ action: 'APPROVE_WFH_REQUEST', module: 'WFH', targetEntity: 'WFHRequest', getTargetId: (req) => req.params.id }), approveWFHRequest);
router.patch('/:id/reject', protect, authorize('Admin', 'AGM'), auditLogger({ action: 'REJECT_WFH_REQUEST', module: 'WFH', targetEntity: 'WFHRequest', getTargetId: (req) => req.params.id }), rejectWFHRequest);

module.exports = router;
