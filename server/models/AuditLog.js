const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  actorRole: { type: String },
  action: { type: String, required: true },
  module: { type: String, required: true },
  targetEntity: { type: String },
  targetId: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actorUserId: 1, createdAt: -1 });
auditLogSchema.index({ module: 1, action: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
