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
    // ── Legacy field — kept for backward compat with existing calendar-year entries ──
    year:      { type: Number },          // e.g. 2025 (calendar year). Optional on new fiscal entries.

    // ── Fiscal year fields (April–March) ─────────────────────────────────────
    // label     : human-readable, e.g. "April 2026 to March 2027"
    // startDate : Apr 1 of the fiscal year start (Date)
    // endDate   : Apr 1 of the fiscal year end, i.e. first day NOT in this FY (Date)
    // workingDays: number of working days in this fiscal year (e.g. 310)
    label:        { type: String },       // e.g. "April 2026 to March 2027"
    startDate:    { type: Date },         // 2026-04-01T00:00:00.000Z
    endDate:      { type: Date },         // 2027-04-01T00:00:00.000Z
    workingDays:  { type: Number, min: 1 }, // e.g. 310

    maxPoints: { type: Number, required: true, min: 1 }  // e.g. 4960
  }],
  screenshotsPerDay: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
