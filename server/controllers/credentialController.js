const EmployeeCredential = require('../models/EmployeeCredential');
const CredentialAuditLog = require('../models/CredentialAuditLog');
const User = require('../models/User');

// ─── Access guard ─────────────────────────────────────────────────────────────
// Only SuperAdmin, Admin, and HR may manage/view credentials.
// This is enforced at the route level via authorize(), but we double-check here
// as a defence-in-depth measure.
const ALLOWED_ROLES = ['SuperAdmin', 'Admin', 'HR'];

const assertAccess = (user) => {
  if (!ALLOWED_ROLES.includes(user.role)) {
    const err = new Error('Access denied. Only Super Admin, Admin, and HR may manage credentials.');
    err.status = 403;
    throw err;
  }
};

// ─── Helper: write credential audit log ──────────────────────────────────────
const writeAuditLog = async ({ actorUser, targetEmployeeId, credentialId, action, affectedFields = [], req }) => {
  try {
    await CredentialAuditLog.create({
      actorUserId:     actorUser._id,
      actorRole:       actorUser.role,
      targetEmployee:  targetEmployeeId,
      credential:      credentialId,
      action,
      affectedFields,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown'
    });
  } catch (err) {
    // Audit log failure must never block the main response
    console.error('CredentialAuditLog write failed:', err.message);
  }
};

// ─── Whitelist of fields that can be set/updated ─────────────────────────────
const ALLOWED_FIELDS = [
  'email1', 'email1Password',
  'email2', 'email2Password',
  'crmUserId', 'crmPassword',
  'laptopUsername', 'laptopPassword',
  'desktopUsername', 'desktopPassword',
  'phonePassword', 'simNumber'
];

// Password-bearing fields (require encryption via pre-save hook)
const PASSWORD_FIELDS = [
  'email1Password', 'email2Password',
  'crmPassword', 'laptopPassword',
  'desktopPassword', 'phonePassword'
];

// ─── GET /api/credentials/:employeeId ────────────────────────────────────────
// Returns the credential record for the employee WITHOUT decrypting passwords.
// Encrypted fields are returned as a placeholder string so the UI knows a
// value is set without ever exposing the ciphertext.
const getCredentials = async (req, res) => {
  try {
    assertAccess(req.user);

    const employee = await User.findById(req.params.employeeId).select('name employeeId role');
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const cred = await EmployeeCredential.findOne({ employee: req.params.employeeId })
      .populate('createdBy',     'name role')
      .populate('lastUpdatedBy', 'name role');

    if (!cred) {
      // Return empty structure so the frontend can render empty fields
      return res.status(200).json({ credential: null, employee });
    }

    // Build a safe response: replace encrypted password fields with a boolean
    // flag so the UI knows "a value is stored" without leaking ciphertext.
    const safe = {
      _id:             cred._id,
      employee:        cred.employee,
      createdBy:       cred.createdBy,
      lastUpdatedBy:   cred.lastUpdatedBy,
      createdAt:       cred.createdAt,
      updatedAt:       cred.updatedAt,
      // Non-secret fields passed through
      email1:          cred.email1       || null,
      email2:          cred.email2       || null,
      crmUserId:       cred.crmUserId    || null,
      laptopUsername:  cred.laptopUsername  || null,
      desktopUsername: cred.desktopUsername || null,
      simNumber:       cred.simNumber    || null,
      // Password fields: return true if set, false if not — never the ciphertext
      email1Password:    !!cred.email1Password,
      email2Password:    !!cred.email2Password,
      crmPassword:       !!cred.crmPassword,
      laptopPassword:    !!cred.laptopPassword,
      desktopPassword:   !!cred.desktopPassword,
      phonePassword:     !!cred.phonePassword,
    };

    res.status(200).json({ credential: safe, employee });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    res.status(500).json({ message: err.message });
  }
};

// ─── POST /api/credentials/:employeeId/reveal ─────────────────────────────────
// Decrypts and returns a single password field.
// Every call writes a FIELD_REVEALED audit log entry.
// Body: { field: 'email1Password' | 'laptopPassword' | ... }
const revealField = async (req, res) => {
  try {
    assertAccess(req.user);

    const { field } = req.body;
    if (!field) return res.status(400).json({ message: 'field is required' });
    if (!PASSWORD_FIELDS.includes(field)) {
      return res.status(400).json({ message: `'${field}' is not a valid password field` });
    }

    const cred = await EmployeeCredential.findOne({ employee: req.params.employeeId });
    if (!cred) return res.status(404).json({ message: 'No credentials found for this employee' });
    if (!cred[field]) return res.status(404).json({ message: 'No value stored for this field' });

    let plaintext;
    try {
      plaintext = cred.decryptField(field);
    } catch {
      return res.status(500).json({ message: 'Decryption failed. The stored value may be corrupted or the encryption key has changed.' });
    }

    // Log every reveal — this is the security audit trail
    await writeAuditLog({
      actorUser:        req.user,
      targetEmployeeId: req.params.employeeId,
      credentialId:     cred._id,
      action:           'FIELD_REVEALED',
      affectedFields:   [field],
      req
    });

    res.status(200).json({ field, value: plaintext });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    res.status(500).json({ message: err.message });
  }
};

// ─── PUT /api/credentials/:employeeId ────────────────────────────────────────
// Creates or fully replaces the credential record for an employee.
// All password fields in the body are plain text — the pre-save hook encrypts them.
const upsertCredentials = async (req, res) => {
  try {
    assertAccess(req.user);

    const employee = await User.findById(req.params.employeeId).select('name employeeId');
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    // Build a clean payload from whitelisted fields only
    const payload = {};
    const changedFields = [];
    for (const field of ALLOWED_FIELDS) {
      if (req.body[field] !== undefined) {
        // For password fields: only include if a non-empty string is provided.
        // An empty string means "leave unchanged" — do not overwrite with blank.
        if (PASSWORD_FIELDS.includes(field)) {
          if (req.body[field] && req.body[field].trim() !== '') {
            payload[field] = req.body[field].trim();
            changedFields.push(field);
          }
        } else {
          payload[field] = req.body[field]?.trim?.() ?? req.body[field];
          changedFields.push(field);
        }
      }
    }

    let cred = await EmployeeCredential.findOne({ employee: req.params.employeeId });
    let action;

    if (!cred) {
      // Create new
      cred = new EmployeeCredential({
        employee:   req.params.employeeId,
        createdBy:  req.user._id,
        lastUpdatedBy: req.user._id,
        ...payload
      });
      action = 'CREATED';
    } else {
      // Update existing — apply payload fields
      for (const [key, val] of Object.entries(payload)) {
        cred[key] = val;
      }
      cred.lastUpdatedBy = req.user._id;
      action = 'UPDATED';
    }

    await cred.save(); // pre-save hook encrypts modified password fields

    await writeAuditLog({
      actorUser:        req.user,
      targetEmployeeId: req.params.employeeId,
      credentialId:     cred._id,
      action,
      affectedFields:   changedFields,
      req
    });

    // Return safe shape (no ciphertext, just presence booleans)
    const safe = {
      _id:             cred._id,
      employee:        cred.employee,
      email1:          cred.email1       || null,
      email2:          cred.email2       || null,
      crmUserId:       cred.crmUserId    || null,
      laptopUsername:  cred.laptopUsername  || null,
      desktopUsername: cred.desktopUsername || null,
      simNumber:       cred.simNumber    || null,
      email1Password:    !!cred.email1Password,
      email2Password:    !!cred.email2Password,
      crmPassword:       !!cred.crmPassword,
      laptopPassword:    !!cred.laptopPassword,
      desktopPassword:   !!cred.desktopPassword,
      phonePassword:     !!cred.phonePassword,
      createdAt:       cred.createdAt,
      updatedAt:       cred.updatedAt,
    };

    res.status(200).json({
      message: action === 'CREATED' ? 'Credentials created' : 'Credentials updated',
      credential: safe
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    res.status(500).json({ message: err.message });
  }
};

// ─── DELETE /api/credentials/:employeeId ─────────────────────────────────────
// Hard-deletes the entire credential record.
// Restricted to SuperAdmin only.
const deleteCredentials = async (req, res) => {
  try {
    // SuperAdmin-only for deletion
    if (req.user.role !== 'SuperAdmin') {
      return res.status(403).json({ message: 'Only Super Admin can delete credential records' });
    }

    const cred = await EmployeeCredential.findOne({ employee: req.params.employeeId });
    if (!cred) return res.status(404).json({ message: 'No credentials found for this employee' });

    await writeAuditLog({
      actorUser:        req.user,
      targetEmployeeId: req.params.employeeId,
      credentialId:     cred._id,
      action:           'DELETED',
      affectedFields:   ALLOWED_FIELDS,
      req
    });

    await cred.deleteOne();
    res.status(200).json({ message: 'Credentials deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── GET /api/credentials/:employeeId/audit-log ──────────────────────────────
// Returns the credential audit history for a specific employee.
const getCredentialAuditLog = async (req, res) => {
  try {
    assertAccess(req.user);

    const logs = await CredentialAuditLog.find({ targetEmployee: req.params.employeeId })
      .populate('actorUserId', 'name employeeId role')
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({ logs });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    res.status(500).json({ message: err.message });
  }
};

// ─── GET /api/credentials/audit-log (global, all employees) ─────────────────
// Returns credential audit events across all employees with search/filter/pagination.
// SuperAdmin, Admin, HR only.
const getGlobalCredentialAuditLog = async (req, res) => {
  try {
    assertAccess(req.user);

    const {
      action      = '',
      employeeId  = '',
      actorId     = '',
      search      = '',
      dateFrom    = '',
      dateTo      = '',
      page        = 1,
      limit       = 20
    } = req.query;

    const VALID_ACTIONS = ['CREATED', 'UPDATED', 'FIELD_REVEALED', 'DELETED'];

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    const query = {};

    if (action) {
      if (!VALID_ACTIONS.includes(action)) {
        return res.status(400).json({ message: `Invalid action. Valid values: ${VALID_ACTIONS.join(', ')}` });
      }
      query.action = action;
    }
    if (employeeId) query.targetEmployee = employeeId;
    if (actorId)    query.actorUserId    = actorId;

    // Date range
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // Text search: match by actor name/ID or target employee name/ID
    if (search.trim()) {
      const matchingUsers = await User.find({
        $or: [
          { name:       { $regex: search.trim(), $options: 'i' } },
          { employeeId: { $regex: search.trim(), $options: 'i' } }
        ]
      }).select('_id');
      const ids = matchingUsers.map(u => u._id);
      query.$or = [
        { actorUserId:    { $in: ids } },
        { targetEmployee: { $in: ids } },
        { affectedFields: { $elemMatch: { $regex: search.trim(), $options: 'i' } } }
      ];
    }

    const [logs, total] = await Promise.all([
      CredentialAuditLog.find(query)
        .populate('actorUserId',    'name employeeId role')
        .populate('targetEmployee', 'name employeeId department')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      CredentialAuditLog.countDocuments(query)
    ]);

    res.status(200).json({
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      logs
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    res.status(500).json({ message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE SELF-SERVICE — employees manage their own credentials
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /api/credentials/me ──────────────────────────────────────────────────
// Returns the current employee's own credential record (safe shape — no plaintext).
const getMyCredentials = async (req, res) => {
  try {
    // Guard: verify the encryption key is configured before touching credential data
    const credKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
    if (!credKey || credKey.length !== 64) {
      return res.status(503).json({
        message: 'Credential service unavailable. Contact your administrator to configure the encryption key.'
      });
    }

    const cred = await EmployeeCredential.findOne({ employee: req.user._id })
      .populate('lastUpdatedBy', 'name role');

    if (!cred) return res.status(200).json({ credential: null });

    const safe = {
      _id:             cred._id,
      createdAt:       cred.createdAt,
      updatedAt:       cred.updatedAt,
      lastUpdatedBy:   cred.lastUpdatedBy,
      email1:          cred.email1       || null,
      email2:          cred.email2       || null,
      crmUserId:       cred.crmUserId    || null,
      laptopUsername:  cred.laptopUsername  || null,
      desktopUsername: cred.desktopUsername || null,
      simNumber:       cred.simNumber    || null,
      // Password presence flags only — never return ciphertext
      email1Password:    !!cred.email1Password,
      email2Password:    !!cred.email2Password,
      crmPassword:       !!cred.crmPassword,
      laptopPassword:    !!cred.laptopPassword,
      desktopPassword:   !!cred.desktopPassword,
      phonePassword:     !!cred.phonePassword,
    };

    res.status(200).json({ credential: safe });
  } catch (err) {
    console.error('[getMyCredentials]', err.message);
    res.status(500).json({ message: err.message });
  }
};

// ─── PUT /api/credentials/me ──────────────────────────────────────────────────
// Employee creates or updates their own credential record.
// Password fields are encrypted by the pre-save hook. Empty string = skip (no overwrite).
const upsertMyCredentials = async (req, res) => {
  try {
    // Guard: verify the encryption key is configured before writing encrypted data
    const credKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
    if (!credKey || credKey.length !== 64) {
      return res.status(503).json({
        message: 'Credential service unavailable. Contact your administrator to configure the encryption key.'
      });
    }

    const payload = {};
    const changedFields = [];

    for (const field of ALLOWED_FIELDS) {
      if (req.body[field] !== undefined) {
        if (PASSWORD_FIELDS.includes(field)) {
          if (req.body[field] && req.body[field].trim() !== '') {
            payload[field] = req.body[field].trim();
            changedFields.push(field);
          }
        } else {
          payload[field] = req.body[field]?.trim?.() ?? req.body[field];
          changedFields.push(field);
        }
      }
    }

    let cred = await EmployeeCredential.findOne({ employee: req.user._id });
    let action;

    if (!cred) {
      cred = new EmployeeCredential({
        employee:      req.user._id,
        createdBy:     req.user._id,
        lastUpdatedBy: req.user._id,
        ...payload
      });
      action = 'CREATED';
    } else {
      for (const [key, val] of Object.entries(payload)) cred[key] = val;
      cred.lastUpdatedBy = req.user._id;
      action = 'UPDATED';
    }

    await cred.save();

    await writeAuditLog({
      actorUser:        req.user,
      targetEmployeeId: req.user._id,
      credentialId:     cred._id,
      action,
      affectedFields:   changedFields,
      req
    });

    const safe = {
      _id:             cred._id,
      email1:          cred.email1       || null,
      email2:          cred.email2       || null,
      crmUserId:       cred.crmUserId    || null,
      laptopUsername:  cred.laptopUsername  || null,
      desktopUsername: cred.desktopUsername || null,
      simNumber:       cred.simNumber    || null,
      email1Password:    !!cred.email1Password,
      email2Password:    !!cred.email2Password,
      crmPassword:       !!cred.crmPassword,
      laptopPassword:    !!cred.laptopPassword,
      desktopPassword:   !!cred.desktopPassword,
      phonePassword:     !!cred.phonePassword,
      updatedAt:       cred.updatedAt,
    };

    res.status(200).json({
      message: action === 'CREATED' ? 'Credentials saved' : 'Credentials updated',
      credential: safe
    });
  } catch (err) {
    console.error('[upsertMyCredentials] ERROR:', err.message, err.stack?.split('\n')[1]);
    res.status(500).json({ message: err.message });
  }
};

// ─── POST /api/credentials/me/reveal ─────────────────────────────────────────
// Employee reveals one of their own password fields. Audit-logged.
const revealMyField = async (req, res) => {
  try {
    const { field } = req.body;
    if (!field) return res.status(400).json({ message: 'field is required' });
    if (!PASSWORD_FIELDS.includes(field)) {
      return res.status(400).json({ message: `'${field}' is not a valid password field` });
    }

    const cred = await EmployeeCredential.findOne({ employee: req.user._id });
    if (!cred) return res.status(404).json({ message: 'No credentials found' });
    if (!cred[field]) return res.status(404).json({ message: 'No value stored for this field' });

    let plaintext;
    try {
      plaintext = cred.decryptField(field);
    } catch {
      return res.status(500).json({ message: 'Decryption failed.' });
    }

    await writeAuditLog({
      actorUser:        req.user,
      targetEmployeeId: req.user._id,
      credentialId:     cred._id,
      action:           'FIELD_REVEALED',
      affectedFields:   [field],
      req
    });

    res.status(200).json({ field, value: plaintext });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getCredentials,
  revealField,
  upsertCredentials,
  deleteCredentials,
  getCredentialAuditLog,
  getGlobalCredentialAuditLog,
  // Employee self-service
  getMyCredentials,
  upsertMyCredentials,
  revealMyField,
};
