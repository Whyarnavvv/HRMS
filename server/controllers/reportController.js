const Asset           = require('../models/Asset');
const AssetAssignment = require('../models/AssetAssignment');
const CredentialAuditLog = require('../models/CredentialAuditLog');
const User            = require('../models/User');
const { generateReport } = require('../utils/reportGenerator');

// ─── Shared filter builder ────────────────────────────────────────────────────

/**
 * Builds a Mongoose query object for assets from common query params.
 * Supported: category, status, dateFrom, dateTo
 */
const buildAssetQuery = (q) => {
  const query = {};
  if (q.category) query.category = q.category;
  if (q.status)   query.status   = q.status;
  if (q.dateFrom || q.dateTo) {
    query.createdAt = {};
    if (q.dateFrom) query.createdAt.$gte = new Date(q.dateFrom);
    if (q.dateTo) {
      const end = new Date(q.dateTo); end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }
  return query;
};

/**
 * Builds a Mongoose query for assignment records from common query params.
 * Supports: employeeId, department (resolved via User lookup), dateFrom, dateTo
 */
const buildAssignmentQuery = async (q) => {
  const query = {};

  if (q.employeeId) {
    query.employee = q.employeeId;
  } else if (q.department) {
    const emps = await User.find({ department: q.department }).select('_id');
    query.employee = { $in: emps.map(e => e._id) };
  }

  if (q.dateFrom || q.dateTo) {
    query.createdAt = {};
    if (q.dateFrom) query.createdAt.$gte = new Date(q.dateFrom);
    if (q.dateTo) {
      const end = new Date(q.dateTo); end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }
  return query;
};

/**
 * Builds a Mongoose query for credential audit logs.
 * Supports: employeeId, department, action, dateFrom, dateTo
 */
const buildCredentialQuery = async (q) => {
  const query = {};
  if (q.action)     query.action = q.action;
  if (q.employeeId) {
    query.targetEmployee = q.employeeId;
  } else if (q.department) {
    const emps = await User.find({ department: q.department }).select('_id');
    query.targetEmployee = { $in: emps.map(e => e._id) };
  }
  if (q.dateFrom || q.dateTo) {
    query.createdAt = {};
    if (q.dateFrom) query.createdAt.$gte = new Date(q.dateFrom);
    if (q.dateTo) {
      const end = new Date(q.dateTo); end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }
  return query;
};

// ─── Helper: send report response ────────────────────────────────────────────

const sendReport = (res, { buffer, contentType, filename }) => {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
};

// ─── Validate format ─────────────────────────────────────────────────────────

const VALID_FORMATS = ['excel', 'csv', 'pdf'];

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT 1 — Asset Inventory Report
// GET /api/reports/asset-inventory?format=excel&category=&status=&dateFrom=&dateTo=
// ═══════════════════════════════════════════════════════════════════════════════
const assetInventoryReport = async (req, res) => {
  try {
    const { format = 'excel' } = req.query;
    if (!VALID_FORMATS.includes(format)) {
      return res.status(400).json({ message: `Invalid format. Use: ${VALID_FORMATS.join(', ')}` });
    }

    const assetQuery = buildAssetQuery(req.query);
    const assets = await Asset.find(assetQuery)
      .populate('createdBy', 'name employeeId')
      .sort({ createdAt: -1 });

    const result = await generateReport('assetInventory', format, assets);
    sendReport(res, result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT 2 — Employee Asset Report
// GET /api/reports/employee-asset?format=excel&employeeId=&department=&dateFrom=&dateTo=
// ═══════════════════════════════════════════════════════════════════════════════
const employeeAssetReport = async (req, res) => {
  try {
    const { format = 'excel' } = req.query;
    if (!VALID_FORMATS.includes(format)) {
      return res.status(400).json({ message: `Invalid format. Use: ${VALID_FORMATS.join(', ')}` });
    }

    const assignQuery = await buildAssignmentQuery(req.query);
    // Optionally filter by asset category
    if (req.query.category) {
      const matchingAssets = await Asset.find({ category: req.query.category }).select('_id');
      assignQuery.asset = { $in: matchingAssets.map(a => a._id) };
    }

    const assignments = await AssetAssignment.find(assignQuery)
      .populate('asset',      'assetName assetNumber category modelName')
      .populate('employee',   'name employeeId department')
      .populate('assignedBy', 'name role')
      .populate('returnedBy', 'name role')
      .sort({ createdAt: -1 });

    const result = await generateReport('employeeAsset', format, assignments);
    sendReport(res, result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT 3 — Damaged Asset Report
// GET /api/reports/damaged?format=excel&employeeId=&department=&category=&dateFrom=&dateTo=
// ═══════════════════════════════════════════════════════════════════════════════
const damagedAssetReport = async (req, res) => {
  try {
    const { format = 'excel' } = req.query;
    if (!VALID_FORMATS.includes(format)) {
      return res.status(400).json({ message: `Invalid format. Use: ${VALID_FORMATS.join(', ')}` });
    }

    const assignQuery = await buildAssignmentQuery(req.query);
    assignQuery.status          = 'Returned';
    assignQuery.returnCondition = 'Damaged';

    // Filter by return date if provided (returnedDate, not createdAt)
    if (req.query.dateFrom || req.query.dateTo) {
      assignQuery.returnedDate = {};
      if (req.query.dateFrom) assignQuery.returnedDate.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo) {
        const end = new Date(req.query.dateTo); end.setHours(23, 59, 59, 999);
        assignQuery.returnedDate.$lte = end;
      }
      delete assignQuery.createdAt; // use returnedDate range instead
    }

    if (req.query.category) {
      const matchingAssets = await Asset.find({ category: req.query.category }).select('_id');
      assignQuery.asset = { $in: matchingAssets.map(a => a._id) };
    }

    const assignments = await AssetAssignment.find(assignQuery)
      .populate('asset',      'assetName assetNumber category')
      .populate('employee',   'name employeeId department')
      .populate('returnedBy', 'name role')
      .sort({ returnedDate: -1 });

    const result = await generateReport('damaged', format, assignments);
    sendReport(res, result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT 4 — Lost Asset Report
// GET /api/reports/lost?format=excel&employeeId=&department=&category=&dateFrom=&dateTo=
// ═══════════════════════════════════════════════════════════════════════════════
const lostAssetReport = async (req, res) => {
  try {
    const { format = 'excel' } = req.query;
    if (!VALID_FORMATS.includes(format)) {
      return res.status(400).json({ message: `Invalid format. Use: ${VALID_FORMATS.join(', ')}` });
    }

    const assignQuery = await buildAssignmentQuery(req.query);
    assignQuery.status          = 'Returned';
    assignQuery.returnCondition = 'Lost';

    if (req.query.dateFrom || req.query.dateTo) {
      assignQuery.returnedDate = {};
      if (req.query.dateFrom) assignQuery.returnedDate.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo) {
        const end = new Date(req.query.dateTo); end.setHours(23, 59, 59, 999);
        assignQuery.returnedDate.$lte = end;
      }
      delete assignQuery.createdAt;
    }

    if (req.query.category) {
      const matchingAssets = await Asset.find({ category: req.query.category }).select('_id');
      assignQuery.asset = { $in: matchingAssets.map(a => a._id) };
    }

    const assignments = await AssetAssignment.find(assignQuery)
      .populate('asset',      'assetName assetNumber category')
      .populate('employee',   'name employeeId department')
      .populate('returnedBy', 'name role')
      .sort({ returnedDate: -1 });

    const result = await generateReport('lost', format, assignments);
    sendReport(res, result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT 5 — Credential Audit Report
// GET /api/reports/credential-audit?format=excel&employeeId=&department=&action=&dateFrom=&dateTo=
// ═══════════════════════════════════════════════════════════════════════════════
const credentialAuditReport = async (req, res) => {
  try {
    const { format = 'excel' } = req.query;
    if (!VALID_FORMATS.includes(format)) {
      return res.status(400).json({ message: `Invalid format. Use: ${VALID_FORMATS.join(', ')}` });
    }

    const credQuery = await buildCredentialQuery(req.query);
    const logs = await CredentialAuditLog.find(credQuery)
      .populate('actorUserId',    'name employeeId role')
      .populate('targetEmployee', 'name employeeId department')
      .sort({ createdAt: -1 });

    const result = await generateReport('credentialAudit', format, logs);
    sendReport(res, result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Available filters for the frontend to render ────────────────────────────
// GET /api/reports/filters
// Returns employees list + departments + categories for filter dropdowns
const getReportFilters = async (req, res) => {
  try {
    const [employees, assets] = await Promise.all([
      User.find({ isActive: 'Active', role: { $ne: 'SuperAdmin' } })
          .select('name employeeId department')
          .sort({ name: 1 }),
      Asset.find({}).select('category').lean()
    ]);

    const departments = [...new Set(
      employees.map(e => e.department).filter(Boolean)
    )].sort();

    const categories = [...new Set(
      assets.map(a => a.category).filter(Boolean)
    )].sort();

    res.status(200).json({ employees, departments, categories });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  assetInventoryReport,
  employeeAssetReport,
  damagedAssetReport,
  lostAssetReport,
  credentialAuditReport,
  getReportFilters,
};
