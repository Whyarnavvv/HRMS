const mongoose = require('mongoose');

// Immutable append-only log of every significant event on an Asset record.
// Controllers write to this table directly — it is never mutated after insert.

const assetHistorySchema = new mongoose.Schema({
  asset: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Asset',
    required: true
  },

  // The assignment record this event is linked to, when applicable
  assignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AssetAssignment'
  },

  action: {
    type: String,
    required: true,
    enum: [
      'CREATED',
      'UPDATED',
      'ASSIGNED',
      'RETURNED',
      'DAMAGED',       // returned with Damaged condition
      'LOST',          // reported lost
      'STATUS_CHANGED',
      'RETIRED',
      'DELETED'
    ]
  },

  // Snapshot of changed fields: { field: { from, to } }
  changes: { type: mongoose.Schema.Types.Mixed },

  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  remarks: { type: String, trim: true }
}, {
  timestamps: true
});

assetHistorySchema.index({ asset: 1, createdAt: -1 });
assetHistorySchema.index({ performedBy: 1, createdAt: -1 });
assetHistorySchema.index({ action: 1, createdAt: -1 });
assetHistorySchema.index({ createdAt: -1 });

module.exports = mongoose.model('AssetHistory', assetHistorySchema);
