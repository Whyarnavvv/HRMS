const mongoose = require('mongoose');

const screenTimeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  sessionStart: { type: Date },
  sessionEnd: { type: Date },
  activeSeconds: { type: Number, default: 0 },
  idleSeconds: { type: Number, default: 0 },
  totalWorkingSeconds: { type: Number, default: 0 },
  activityEvents: [{
    timestamp: { type: Date, default: Date.now },
    state: { type: String, enum: ['ACTIVE', 'IDLE'], required: true },
    durationSeconds: { type: Number, default: 0 }
  }],
  idleEvents: [{
    startedAt: { type: Date },
    reason: { type: String, enum: ['keyboard_mouse_idle', 'tab_closed'], default: 'keyboard_mouse_idle' }
  }],
  screenshots: [{
    filename: { type: String },
    capturedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

screenTimeSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('ScreenTime', screenTimeSchema);
