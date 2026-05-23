const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  // Using a single document with a known ID or singleton pattern
  name: { type: String, default: 'GlobalSettings', unique: true },
  officeLocation: {
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 },
    radius: { type: Number, default: 0 } // in meters. 0 means disabled
  },
  geofenceZones: [{
    name: { type: String, required: true, trim: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    radius: { type: Number, required: true, min: 1 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isActive: { type: Boolean, default: true }
  }],
  defaultZoneId: { type: mongoose.Schema.Types.ObjectId },
  yearlyMaxKpi: [{
    year:      { type: Number, required: true },
    maxPoints: { type: Number, required: true, min: 1 }
  }],
  screenshotsPerDay: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
