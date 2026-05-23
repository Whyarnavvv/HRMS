const mongoose = require('mongoose');

const counsellingLogSchema = new mongoose.Schema({
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  phoneNumber: { type: String, required: true, trim: true },
  callSummary: { type: String, required: true, trim: true },
  remarks: { type: String, trim: true },
  screenshotFilename: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('CounsellingLog', counsellingLogSchema);
