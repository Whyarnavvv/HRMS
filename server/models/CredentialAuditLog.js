const mongoose = require('mongoose');

// Immutable append-only log for every sensitive credential action.
// Mirrors the shape of the existing AuditLog model for consistency.
// Written by controllers — never mutated after insert.

const credentialAuditLogSchema = new mongoose.Schema({
  // Who triggered the action
  actorUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  actorRole: { type: String, required: true },

  // Whose credential record was accessed / modified
  targetEmployee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // The credential document that was touched
  credential: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EmployeeCredential',
    required: true
  },

  action: {
    type: String,
    required: true,
    enum: [
      'CREATED',
      'UPDATED',
      'FIELD_REVEALED',   // a password/secret was decrypted and viewed
      'DELETED'
    ]
  },

  // For FIELD_REVEALED: which field was revealed. For UPDATED: list of changed fields.
  // Never store plaintext passwords here.
  affectedFields: [{ type: String }],

  // Request metadata for forensic traceability
  ipAddress: { type: String },
  userAgent: { type: String }
}, {
  timestamps: true
});

credentialAuditLogSchema.index({ targetEmployee: 1, createdAt: -1 });
credentialAuditLogSchema.index({ actorUserId: 1, createdAt: -1 });
credentialAuditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('CredentialAuditLog', credentialAuditLogSchema);
