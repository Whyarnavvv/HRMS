const mongoose = require('mongoose');

const assetAssignmentSchema = new mongoose.Schema({
  asset: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Asset',
    required: true
  },
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  quantity: { type: Number, required: true, min: 1, default: 1 },

  assignedDate: { type: Date, required: true, default: Date.now },
  expectedReturnDate: { type: Date },
  returnedDate: { type: Date },

  status: {
    type: String,
    enum: ['Active', 'Returned', 'Overdue'],
    default: 'Active'
  },

  // Condition recorded at the time of return
  // 'Good'    → normal return, quantity restored to available
  // 'Damaged' → asset marked Under Repair, quantity NOT restored to available
  // 'Lost'    → asset quantity reduced permanently, totalQuantity decremented
  returnCondition: {
    type: String,
    enum: ['Good', 'Damaged', 'Lost'],
    default: null
  },

  remarks: { type: String, trim: true },

  // Tracks the return action — who returned it and any return-time notes
  returnedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  returnRemarks: { type: String, trim: true }
}, { timestamps: true });

// Compound index: one employee should not have the same asset assigned twice simultaneously
assetAssignmentSchema.index({ asset: 1, employee: 1, status: 1 });
assetAssignmentSchema.index({ employee: 1, status: 1 });
assetAssignmentSchema.index({ asset: 1, status: 1 });
assetAssignmentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AssetAssignment', assetAssignmentSchema);
