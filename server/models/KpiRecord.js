const mongoose = require('mongoose');

const kpiRecordSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  points: { type: Number, required: true },
  reason: { type: String, required: true, trim: true },
  autoKpi: { type: Boolean, default: false },
  kpiType: { type: String, enum: ['manual', 'punctuality', 'working_hours'], default: 'manual' }
}, { timestamps: true });

module.exports = mongoose.model('KpiRecord', kpiRecordSchema);
