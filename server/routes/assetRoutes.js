const express = require('express');
const router = express.Router();
const {
  createAsset,
  getAssets,
  getAssetById,
  updateAsset,
  deleteAsset,
  assignAsset,
  returnAsset,
  getAssignments,
  getAssetAssignments,
  getAssetHistory,
  getAssetHistoryById,
  getAssetDashboardStats,
  getMyAssignments,
} = require('../controllers/assetController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { auditLogger } = require('../middleware/auditLogger');

// ─── Role groups ──────────────────────────────────────────────────────────────
// READ: Anyone who can see asset data (incl. Manager for team oversight)
const READ_ROLES  = ['Admin', 'HR', 'AGM', 'Manager', 'SuperAdmin'];
// WRITE: Only HR/Admin/SuperAdmin can create, update, assign, return
const WRITE_ROLES = ['Admin', 'HR', 'SuperAdmin'];
// DELETE: Admin/SuperAdmin only
const DEL_ROLES   = ['Admin', 'SuperAdmin'];

// ── Employee: view own assigned assets ───────────────────────────────────────
// Must be before /:id to avoid route collision
router.get(
  '/my-assignments',
  protect,
  getMyAssignments
);

// ── Dashboard stats (must be before /:id routes) ─────────────────────────────
router.get(
  '/dashboard-stats',
  protect,
  authorize(...READ_ROLES),
  getAssetDashboardStats
);

// ── Global history list ───────────────────────────────────────────────────────
router.get(
  '/history',
  protect,
  authorize(...READ_ROLES),
  getAssetHistory
);

// ── Global assignments list ───────────────────────────────────────────────────
router.get(
  '/assignments',
  protect,
  authorize(...READ_ROLES),
  getAssignments
);

// ── Asset collection ──────────────────────────────────────────────────────────
router.route('/')
  .get(
    protect,
    authorize(...READ_ROLES),
    getAssets
  )
  .post(
    protect,
    authorize(...WRITE_ROLES),
    auditLogger({ action: 'CREATE_ASSET', module: 'ASSETS', targetEntity: 'Asset' }),
    createAsset
  );

// ── Per-asset sub-resources (before /:id) ────────────────────────────────────
router.post(
  '/:id/assign',
  protect,
  authorize(...WRITE_ROLES),
  auditLogger({ action: 'ASSIGN_ASSET', module: 'ASSETS', targetEntity: 'Asset' }),
  assignAsset
);

router.get(
  '/:id/assignments',
  protect,
  authorize(...READ_ROLES),
  getAssetAssignments
);

router.get(
  '/:id/history',
  protect,
  authorize(...READ_ROLES),
  getAssetHistoryById
);

router.patch(
  '/:id/assignments/:assignmentId/return',
  protect,
  authorize(...WRITE_ROLES),
  auditLogger({ action: 'RETURN_ASSET', module: 'ASSETS', targetEntity: 'AssetAssignment' }),
  returnAsset
);

// ── Single asset document ─────────────────────────────────────────────────────
router.route('/:id')
  .get(
    protect,
    authorize(...READ_ROLES),
    getAssetById
  )
  .patch(
    protect,
    authorize(...WRITE_ROLES),
    auditLogger({ action: 'UPDATE_ASSET', module: 'ASSETS', targetEntity: 'Asset' }),
    updateAsset
  )
  .delete(
    protect,
    authorize(...DEL_ROLES),
    auditLogger({ action: 'DELETE_ASSET', module: 'ASSETS', targetEntity: 'Asset' }),
    deleteAsset
  );

module.exports = router;
