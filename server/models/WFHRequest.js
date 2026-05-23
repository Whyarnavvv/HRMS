const mongoose = require('mongoose');

const wfhRequestSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  address: { type: String, trim: true },
  reason: { type: String, required: true, trim: true },
  fromDate: { type: String, required: true }, // YYYY-MM-DD (same as toDate — single date only)
  toDate: { type: String, required: true },   // YYYY-MM-DD (same as fromDate)
  approvedDate: { type: String },             // YYYY-MM-DD set on approval, geolocation valid only for this date
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING'
  },
  approvedRadius: { type: Number, default: 100 },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  reviewNote: { type: String, trim: true }
}, { timestamps: true });

wfhRequestSchema.index({ user: 1, fromDate: 1, toDate: 1, status: 1 });

module.exports = mongoose.model('WFHRequest', wfhRequestSchema);
