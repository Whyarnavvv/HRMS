const express = require('express');
const router = express.Router();
const {
  getSettings,
  updateSettings,
  getGeofenceZones,
  createGeofenceZone,
  updateGeofenceZone,
  deleteGeofenceZone,
  setDefaultGeofenceZone
} = require('../controllers/settingsController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { auditLogger } = require('../middleware/auditLogger');

router.get('/', protect, getSettings);
router.put('/', protect, authorize('Admin', 'AGM'), auditLogger({ action: 'UPDATE_SETTINGS', module: 'SETTINGS', targetEntity: 'Settings' }), updateSettings);

router.get('/geofences', protect, getGeofenceZones);
router.post('/geofences', protect, authorize('Admin', 'AGM'), auditLogger({ action: 'CREATE_GEOFENCE', module: 'GEOFENCE', targetEntity: 'Zone', getTargetId: () => null }), createGeofenceZone);
router.put('/geofences/:zoneId', protect, authorize('Admin', 'AGM'), auditLogger({ action: 'UPDATE_GEOFENCE', module: 'GEOFENCE', targetEntity: 'Zone', getTargetId: (req) => req.params.zoneId }), updateGeofenceZone);
router.delete('/geofences/:zoneId', protect, authorize('Admin', 'AGM'), auditLogger({ action: 'DELETE_GEOFENCE', module: 'GEOFENCE', targetEntity: 'Zone', getTargetId: (req) => req.params.zoneId }), deleteGeofenceZone);
router.put('/geofences/:zoneId/default', protect, authorize('Admin', 'AGM'), auditLogger({ action: 'SET_DEFAULT_GEOFENCE', module: 'GEOFENCE', targetEntity: 'Zone', getTargetId: (req) => req.params.zoneId }), setDefaultGeofenceZone);

module.exports = router;
