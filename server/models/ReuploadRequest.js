const mongoose = require('mongoose');

const reuploadRequestSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  documentKey: { type: String, required: true },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('ReuploadRequest', reuploadRequestSchema);
