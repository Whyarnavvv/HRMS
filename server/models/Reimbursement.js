const mongoose = require('mongoose');

const reimbursementSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  receiptUrl: { type: String }, // Optional path to uploaded receipt image
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewDate: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Reimbursement', reimbursementSchema);
