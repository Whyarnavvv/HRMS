const mongoose = require('mongoose');

const salarySlipRequestSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  status: {
    type: String,
    enum: ['Pending', 'Fulfilled'],
    default: 'Pending'
  },
  fulfilledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  fulfilledAt: { type: Date },
  fulfillMethod: { type: String, enum: ['Email', 'Platform'] }
}, { timestamps: true });

salarySlipRequestSchema.index({ user: 1, month: 1, year: 1 });

module.exports = mongoose.model('SalarySlipRequest', salarySlipRequestSchema);
