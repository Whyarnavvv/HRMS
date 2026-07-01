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

// ── Uniqueness index for auto-KPI records ────────────────────────────────────
// Enforces at the DB level that each employee gets at most one auto-KPI record
// per kpiType per date.  This is a hard backstop behind the application-level
// upsert guard in autoCalculateKpi.
//
// IMPORTANT — partial index: the unique constraint applies ONLY to auto-KPI
// documents (autoKpi: true).  Manual KPI entries (autoKpi: false / default)
// are deliberately excluded so admins can award multiple manual bonuses on the
// same day without hitting a duplicate-key error.
//
// MongoDB will create this index lazily on first server start if it does not
// yet exist.  If existing duplicate auto-KPI records are present the index
// creation will fail with E11000.  Run cleanupDuplicateKpis.js first to remove
// the duplicates, then restart the server.
kpiRecordSchema.index(
  { employeeId: 1, kpiType: 1, date: 1 },
  {
    unique: true,
    partialFilterExpression: { autoKpi: true },
    name: 'auto_kpi_unique_per_employee_type_date'
  }
);

module.exports = mongoose.model('KpiRecord', kpiRecordSchema);
