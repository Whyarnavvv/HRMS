const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // Format: YYYY-MM-DD
  checkIn: { type: Date },
  checkOut: { type: Date },
  totalHours: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['Present', 'Absent', 'Late', 'Half-day', 'Paid Leave', 'Unpaid Leave'],
    default: 'Absent'
  },
  note: { type: String }
}, { timestamps: true });

// Ensure one attendance record per user per day
attendanceSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
