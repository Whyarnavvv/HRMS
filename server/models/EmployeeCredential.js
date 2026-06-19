const mongoose = require('mongoose');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Encryption helpers — AES-256-GCM
// Key must be exactly 32 bytes. Store CREDENTIAL_ENCRYPTION_KEY in .env as a
// 64-character hex string (32 bytes). Generate with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// ---------------------------------------------------------------------------

const ALGORITHM = 'aes-256-gcm';

const getKey = () => {
  const hex = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY must be a 64-character hex string in .env');
  }
  return Buffer.from(hex, 'hex');
};

const encrypt = (plaintext) => {
  if (!plaintext) return null;
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Pack iv:authTag:ciphertext as a single base64 string
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
};

const decrypt = (ciphertext) => {
  if (!ciphertext) return null;
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
};

// ---------------------------------------------------------------------------
// Schema — one credential document per employee
// All *Password / *Pin fields are stored encrypted.
// Plain accessor virtuals are intentionally NOT added here — decryption must
// be done explicitly in the controller so it can be audit-logged.
// ---------------------------------------------------------------------------

const employeeCredentialSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true   // one credential record per employee
  },

  // Email accounts
  email1: { type: String, trim: true, lowercase: true },
  email1Password: { type: String },   // stored encrypted

  email2: { type: String, trim: true, lowercase: true },
  email2Password: { type: String },   // stored encrypted

  // CRM
  crmUserId: { type: String, trim: true },
  crmPassword: { type: String },      // stored encrypted

  // Laptop
  laptopUsername: { type: String, trim: true },
  laptopPassword: { type: String },   // stored encrypted

  // Desktop
  desktopUsername: { type: String, trim: true },
  desktopPassword: { type: String },  // stored encrypted

  // Phone & SIM
  phonePassword: { type: String },    // stored encrypted
  simNumber: { type: String, trim: true },

  // Meta
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// ---------------------------------------------------------------------------
// Pre-save: encrypt all password fields that have been modified
// ---------------------------------------------------------------------------

const PASSWORD_FIELDS = [
  'email1Password',
  'email2Password',
  'crmPassword',
  'laptopPassword',
  'desktopPassword',
  'phonePassword'
];

employeeCredentialSchema.pre('save', async function () {
  for (const field of PASSWORD_FIELDS) {
    // Only re-encrypt if the field value was actually changed
    if (this.isModified(field) && this[field]) {
      this[field] = encrypt(this[field]);
    }
  }
});

// ---------------------------------------------------------------------------
// Instance method — decrypt a single named field and return the plaintext.
// Controllers must call this explicitly so callers can audit-log the action.
// ---------------------------------------------------------------------------

employeeCredentialSchema.methods.decryptField = function (fieldName) {
  if (!PASSWORD_FIELDS.includes(fieldName)) {
    throw new Error(`'${fieldName}' is not an encrypted credential field`);
  }
  return decrypt(this[fieldName]);
};

// ---------------------------------------------------------------------------
// Static helper — called by controllers to safely encrypt a value before
// an update operation (findByIdAndUpdate bypasses pre-save hooks).
// ---------------------------------------------------------------------------

employeeCredentialSchema.statics.encryptField = function (plaintext) {
  return encrypt(plaintext);
};

// employee field already has unique: true in the schema definition above
// — separate index removed to avoid Mongoose duplicate-index warning
employeeCredentialSchema.index({ createdAt: -1 });

module.exports = mongoose.model('EmployeeCredential', employeeCredentialSchema);
