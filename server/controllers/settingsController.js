const Settings = require('../models/Settings');

const SETTINGS_DOC_NAME = 'GlobalSettings';

const getOrCreateSettings = async () => {
  let settings = await Settings.findOne({ name: SETTINGS_DOC_NAME });
  if (!settings) {
    settings = await Settings.create({ name: SETTINGS_DOC_NAME });
  }
  return settings;
};

// @desc    Get global settings
// @route   GET /api/settings
// @access  Private
exports.getSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    res.status(200).json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update global settings
// @route   PUT /api/settings
// @access  Private (Admin/HR)
exports.updateSettings = async (req, res) => {
  try {
    const { officeLocation } = req.body;
    
    const settings = await getOrCreateSettings();
    
    if (officeLocation) {
      settings.officeLocation = {
        latitude: officeLocation.latitude,
        longitude: officeLocation.longitude,
        radius: officeLocation.radius
      };
    }
    
    await settings.save();
    res.status(200).json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    List geofence zones
// @route   GET /api/settings/geofences
// @access  Private
exports.getGeofenceZones = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    res.status(200).json({
      zones: settings.geofenceZones || [],
      defaultZoneId: settings.defaultZoneId || null
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add geofence zone
// @route   POST /api/settings/geofences
// @access  Private (Admin/AGM/SuperAdmin)
exports.createGeofenceZone = async (req, res) => {
  try {
    const { name, latitude, longitude, radius, isActive = true } = req.body;
    if (!name || latitude === undefined || longitude === undefined || radius === undefined) {
      return res.status(400).json({ message: 'name, latitude, longitude and radius are required' });
    }

    const settings = await getOrCreateSettings();
    settings.geofenceZones.push({
      name,
      latitude,
      longitude,
      radius,
      isActive,
      createdBy: req.user?._id
    });

    if (!settings.defaultZoneId && settings.geofenceZones.length > 0) {
      settings.defaultZoneId = settings.geofenceZones[settings.geofenceZones.length - 1]._id;
      settings.officeLocation = {
        latitude,
        longitude,
        radius
      };
    }

    await settings.save();
    res.status(201).json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update geofence zone
// @route   PUT /api/settings/geofences/:zoneId
// @access  Private (Admin/AGM/SuperAdmin)
exports.updateGeofenceZone = async (req, res) => {
  try {
    const { zoneId } = req.params;
    const settings = await getOrCreateSettings();
    const zone = settings.geofenceZones.id(zoneId);

    if (!zone) {
      return res.status(404).json({ message: 'Geofence zone not found' });
    }

    const allowedFields = ['name', 'latitude', 'longitude', 'radius', 'isActive'];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        zone[field] = req.body[field];
      }
    });

    if (settings.defaultZoneId && settings.defaultZoneId.toString() === zoneId) {
      settings.officeLocation = {
        latitude: zone.latitude,
        longitude: zone.longitude,
        radius: zone.radius
      };
    }

    await settings.save();
    res.status(200).json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete geofence zone
// @route   DELETE /api/settings/geofences/:zoneId
// @access  Private (Admin/AGM/SuperAdmin)
exports.deleteGeofenceZone = async (req, res) => {
  try {
    const { zoneId } = req.params;
    const settings = await getOrCreateSettings();
    const zone = settings.geofenceZones.id(zoneId);

    if (!zone) {
      return res.status(404).json({ message: 'Geofence zone not found' });
    }

    zone.deleteOne();

    if (settings.defaultZoneId && settings.defaultZoneId.toString() === zoneId) {
      settings.defaultZoneId = null;
      settings.officeLocation = { latitude: 0, longitude: 0, radius: 0 };
    }

    await settings.save();
    res.status(200).json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Set default geofence zone
// @route   PUT /api/settings/geofences/:zoneId/default
// @access  Private (Admin/AGM/SuperAdmin)
exports.setDefaultGeofenceZone = async (req, res) => {
  try {
    const { zoneId } = req.params;
    const settings = await getOrCreateSettings();
    const zone = settings.geofenceZones.id(zoneId);
    if (!zone) {
      return res.status(404).json({ message: 'Geofence zone not found' });
    }

    settings.defaultZoneId = zone._id;
    settings.officeLocation = {
      latitude: zone.latitude,
      longitude: zone.longitude,
      radius: zone.radius
    };
    await settings.save();

    res.status(200).json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
