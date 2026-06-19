const express = require('express');
const router  = express.Router();
const {
  getCredentials,
  revealField,
  upsertCredentials,
  deleteCredentials,
  getCredentialAuditLog,
  getGlobalCredentialAuditLog,
  getMyCredentials,
  upsertMyCredentials,
  revealMyField,
} = require('../controllers/credentialController');
const { protect, authorize } = require('../middleware/authMiddleware');

const CRED_ROLES = ['SuperAdmin', 'Admin', 'HR'];

// GET /api/credentials/audit-log  — global audit log (must be before /:employeeId)
router.get('/audit-log', protect, authorize(...CRED_ROLES), getGlobalCredentialAuditLog);

// ── Employee self-service (must be before /:employeeId) ──────────────────────
// Any authenticated employee can manage their own credentials
router.get(  '/me',        protect, getMyCredentials);
router.put(  '/me',        protect, upsertMyCredentials);
router.post( '/me/reveal', protect, revealMyField);

// GET  /api/credentials/:employeeId          — fetch safe (no plaintext) record
router.get(
  '/:employeeId',
  protect,
  authorize(...CRED_ROLES),
  getCredentials
);

// POST /api/credentials/:employeeId/reveal   — decrypt one password field
router.post(
  '/:employeeId/reveal',
  protect,
  authorize(...CRED_ROLES),
  revealField
);

// PUT  /api/credentials/:employeeId          — create or update record
router.put(
  '/:employeeId',
  protect,
  authorize(...CRED_ROLES),
  upsertCredentials
);

// DELETE /api/credentials/:employeeId        — SuperAdmin only
router.delete(
  '/:employeeId',
  protect,
  authorize('SuperAdmin'),
  deleteCredentials
);

// GET  /api/credentials/:employeeId/audit-log
router.get(
  '/:employeeId/audit-log',
  protect,
  authorize(...CRED_ROLES),
  getCredentialAuditLog
);

module.exports = router;
