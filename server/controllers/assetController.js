const Asset = require('../models/Asset');
const AssetHistory = require('../models/AssetHistory');
const AssetAssignment = require('../models/AssetAssignment');
const User = require('../models/User');

// ─── Validation Helpers ───────────────────────────────────────────────────────

const VALID_CATEGORIES = ['Laptop', 'Desktop', 'Phone', 'SIM Card', 'ID Card', 'Access Card', 'Furniture', 'Other'];
const VALID_STATUSES = ['Available', 'Fully Assigned', 'Under Repair', 'Retired'];
const VALID_SORT_FIELDS = ['assetName', 'assetNumber', 'category', 'status', 'purchaseDate', 'warrantyExpiry', 'createdAt'];

// ─── Blocked asset statuses that prevent new assignments ─────────────────────
// Under Repair and Retired assets must not be assigned out.
const UNASSIGNABLE_STATUSES = ['Under Repair', 'Retired'];

// Returns a plain object with only the changed fields between old and new asset docs.
const buildChanges = (oldDoc, newData) => {
  const tracked = ['assetName', 'category', 'brand', 'modelName', 'imeiNumber', 'totalQuantity', 'status', 'vendorName', 'purchaseDate', 'warrantyExpiry', 'purchasePrice', 'notes'];
  const changes = {};
  for (const field of tracked) {
    const oldVal = oldDoc[field] instanceof Date ? oldDoc[field].toISOString() : oldDoc[field];
    const newVal = newData[field] !== undefined
      ? (newData[field] instanceof Date ? newData[field].toISOString() : newData[field])
      : undefined;
    if (newVal !== undefined && String(oldVal) !== String(newVal)) {
      changes[field] = { from: oldVal ?? null, to: newVal };
    }
  }
  return changes;
};

// ─── Controllers ─────────────────────────────────────────────────────────────

// @desc    Create a new asset
// @route   POST /api/assets
// @access  Private (Admin, HR, SuperAdmin)
const createAsset = async (req, res) => {
  try {
    const {
      assetNumber, assetName, category, brand, modelName,
      totalQuantity, status, purchaseDate, vendorName,
      warrantyExpiry, purchasePrice, notes
    } = req.body;

    // ── Required field validation ──
    if (!assetNumber || !assetNumber.trim()) {
      return res.status(400).json({ message: 'Asset number is required' });
    }
    if (!assetName || !assetName.trim()) {
      return res.status(400).json({ message: 'Asset name is required' });
    }
    if (!category) {
      return res.status(400).json({ message: 'Category is required' });
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ message: `Category must be one of: ${VALID_CATEGORIES.join(', ')}` });
    }
    if (totalQuantity !== undefined && (isNaN(Number(totalQuantity)) || Number(totalQuantity) < 1)) {
      return res.status(400).json({ message: 'Total quantity must be a positive number' });
    }
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    // ── Uniqueness check ──
    const existing = await Asset.findOne({ assetNumber: assetNumber.trim().toUpperCase() });
    if (existing) {
      return res.status(400).json({ message: `Asset number '${assetNumber.toUpperCase()}' already exists` });
    }

    // ── IMEI uniqueness check (only for device assets that have an IMEI) ──
    const imeiNumber = req.body.imeiNumber?.trim() || null;
    if (imeiNumber) {
      const existingImei = await Asset.findOne({ imeiNumber });
      if (existingImei) {
        return res.status(400).json({ message: `IMEI number '${imeiNumber}' is already registered to another asset` });
      }
    }

    const asset = await Asset.create({
      assetNumber: assetNumber.trim(),
      assetName: assetName.trim(),
      category,
      brand: brand?.trim(),
      modelName: modelName?.trim(),
      imeiNumber: req.body.imeiNumber?.trim() || null,
      totalQuantity: totalQuantity ? Number(totalQuantity) : 1,
      status: status || 'Available',
      purchaseDate: purchaseDate || null,
      vendorName: vendorName?.trim(),
      warrantyExpiry: warrantyExpiry || null,
      purchasePrice: purchasePrice !== undefined ? Number(purchasePrice) : undefined,
      notes: notes?.trim(),
      createdBy: req.user._id
    });

    await AssetHistory.create({
      asset: asset._id,
      action: 'CREATED',
      changes: {},
      performedBy: req.user._id,
      remarks: `Asset created by ${req.user.name}`
    });

    res.status(201).json(asset);
  } catch (error) {
    // Mongoose duplicate key
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Asset number already exists' });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all assets with pagination, sorting, search, category & status filters
// @route   GET /api/assets
// @access  Private (Admin, HR, AGM, SuperAdmin)
//
// Query params:
//   search   — matches assetName, assetNumber, brand, modelName, vendorName (case-insensitive)
//   category — exact enum match
//   status   — exact enum match
//   sort     — field name (prefix with '-' for descending, e.g. '-createdAt')
//   page     — page number (default 1)
//   limit    — results per page (default 20, max 100)
const getAssets = async (req, res) => {
  try {
    const {
      search = '',
      category = '',
      status = '',
      sort = '-createdAt',
      page = 1,
      limit = 20
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    // ── Build filter query ──
    const query = {};

    if (category) {
      if (!VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({ message: `Invalid category filter. Valid values: ${VALID_CATEGORIES.join(', ')}` });
      }
      query.category = category;
    }

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ message: `Invalid status filter. Valid values: ${VALID_STATUSES.join(', ')}` });
      }
      query.status = status;
    }

    if (search.trim()) {
      query.$or = [
        { assetName: { $regex: search.trim(), $options: 'i' } },
        { assetNumber: { $regex: search.trim(), $options: 'i' } },
        { brand: { $regex: search.trim(), $options: 'i' } },
        { modelName: { $regex: search.trim(), $options: 'i' } },
        { vendorName: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    // ── Build sort object ──
    const sortDescending = sort.startsWith('-');
    const sortField = sortDescending ? sort.slice(1) : sort;

    if (!VALID_SORT_FIELDS.includes(sortField)) {
      return res.status(400).json({ message: `Invalid sort field. Valid fields: ${VALID_SORT_FIELDS.join(', ')}` });
    }

    const sortObj = { [sortField]: sortDescending ? -1 : 1 };

    const [assets, total] = await Promise.all([
      Asset.find(query)
        .populate('createdBy', 'name employeeId')
        .sort(sortObj)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Asset.countDocuments(query)
    ]);

    res.status(200).json({
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      assets
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single asset by ID, including full history
// @route   GET /api/assets/:id
// @access  Private (Admin, HR, AGM, SuperAdmin)
const getAssetById = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id)
      .populate('createdBy', 'name employeeId role');

    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    const history = await AssetHistory.find({ asset: asset._id })
      .populate('performedBy', 'name employeeId role')
      .sort({ createdAt: -1 });

    res.status(200).json({ asset, history });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update asset details
// @route   PATCH /api/assets/:id
// @access  Private (Admin, HR, SuperAdmin)
const updateAsset = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    // ── Field-level validation on provided values ──
    if (req.body.category && !VALID_CATEGORIES.includes(req.body.category)) {
      return res.status(400).json({ message: `Category must be one of: ${VALID_CATEGORIES.join(', ')}` });
    }
    if (req.body.status && !VALID_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
    if (req.body.totalQuantity !== undefined) {
      const qty = Number(req.body.totalQuantity);
      if (isNaN(qty) || qty < 1) {
        return res.status(400).json({ message: 'Total quantity must be a positive number' });
      }
      if (qty < asset.assignedQuantity) {
        return res.status(400).json({
          message: `Total quantity cannot be less than currently assigned quantity (${asset.assignedQuantity})`
        });
      }
    }

    // ── Asset number uniqueness check if it is being changed ──
    if (req.body.assetNumber) {
      const normalized = req.body.assetNumber.trim().toUpperCase();
      if (normalized !== asset.assetNumber) {
        const conflict = await Asset.findOne({ assetNumber: normalized });
        if (conflict) {
          return res.status(400).json({ message: `Asset number '${normalized}' is already in use` });
        }
      }
    }

    // ── IMEI uniqueness check if being set or changed ──
    if (req.body.imeiNumber !== undefined) {
      const newImei = req.body.imeiNumber?.trim() || null;
      if (newImei && newImei !== asset.imeiNumber) {
        const imeiConflict = await Asset.findOne({ imeiNumber: newImei, _id: { $ne: asset._id } });
        if (imeiConflict) {
          return res.status(400).json({ message: `IMEI number '${newImei}' is already registered to another asset` });
        }
      }
    }

    // ── Build diff for history before mutating ──
    const changes = buildChanges(asset, req.body);

    // ── Apply whitelisted updates ──
    const ALLOWED = [
      'assetName', 'assetNumber', 'category', 'brand', 'modelName', 'imeiNumber',
      'totalQuantity', 'status', 'purchaseDate', 'vendorName',
      'warrantyExpiry', 'purchasePrice', 'notes'
    ];
    ALLOWED.forEach(field => {
      if (req.body[field] !== undefined) {
        asset[field] = req.body[field];
      }
    });

    await asset.save(); // triggers pre('save') to recalc availableQuantity & auto-status

    if (Object.keys(changes).length > 0) {
      await AssetHistory.create({
        asset: asset._id,
        action: 'UPDATED',
        changes,
        performedBy: req.user._id,
        remarks: req.body.remarks?.trim() || null
      });
    }

    res.status(200).json(asset);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Asset number already exists' });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete asset (only if no active assignments exist)
// @route   DELETE /api/assets/:id
// @access  Private (Admin, SuperAdmin)
const deleteAsset = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    // Block deletion if units are still assigned out
    if (asset.assignedQuantity > 0) {
      return res.status(400).json({
        message: `Cannot delete asset — ${asset.assignedQuantity} unit(s) are currently assigned. Return all units before deleting.`
      });
    }

    await AssetHistory.create({
      asset: asset._id,
      action: 'DELETED',
      changes: {},
      performedBy: req.user._id,
      remarks: `Deleted by ${req.user.name} (${req.user.role})`
    });

    await asset.deleteOne();

    res.status(200).json({ message: 'Asset deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Assign asset to an employee
// @route   POST /api/assets/:id/assign
// @access  Private (Admin, HR, SuperAdmin)
const assignAsset = async (req, res) => {
  try {
    const { employeeId, quantity, expectedReturnDate, remarks, assignedDate } = req.body;

    // ── Required fields ──
    if (!employeeId) return res.status(400).json({ message: 'Employee is required' });
    const qty = Number(quantity) || 1;
    if (!Number.isFinite(qty) || qty < 1) {
      return res.status(400).json({ message: 'Quantity must be at least 1' });
    }

    const [asset, employee] = await Promise.all([
      Asset.findById(req.params.id),
      User.findById(employeeId).select('name employeeId department isActive')
    ]);

    // ── Existence checks ──
    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    // ── Business rule: employee must be active ──
    if (employee.isActive !== 'Active') {
      return res.status(400).json({ message: `Cannot assign asset to an inactive employee (${employee.name})` });
    }

    // ── Business rule: block damaged / under-repair / retired assets ──
    if (UNASSIGNABLE_STATUSES.includes(asset.status)) {
      return res.status(400).json({
        message: `Cannot assign an asset with status "${asset.status}". Only Available assets can be assigned.`
      });
    }

    // ── Business rule: quantity check ──
    if (asset.availableQuantity < qty) {
      return res.status(400).json({
        message: `Only ${asset.availableQuantity} unit(s) available for assignment`
      });
    }

    // ── Business rule: prevent duplicate active assignment of the same asset to the same employee ──
    // (Relevant for unique/serial assets where qty=1 per employee makes sense)
    const existingActive = await AssetAssignment.findOne({
      asset: asset._id,
      employee: employeeId,
      status: 'Active'
    });
    if (existingActive) {
      return res.status(400).json({
        message: `${employee.name} already has an active assignment for this asset. Return the existing assignment before creating a new one.`
      });
    }

    const resolvedAssignedDate = assignedDate ? new Date(assignedDate) : new Date();
    if (expectedReturnDate && new Date(expectedReturnDate) <= resolvedAssignedDate) {
      return res.status(400).json({ message: 'Expected return date must be after the assigned date' });
    }

    const assignment = await AssetAssignment.create({
      asset: asset._id,
      employee: employeeId,
      assignedBy: req.user._id,
      quantity: qty,
      assignedDate: resolvedAssignedDate,
      expectedReturnDate: expectedReturnDate || null,
      remarks: remarks?.trim() || null,
      status: 'Active'
    });

    // Update asset counters — pre('save') hook recalculates availableQuantity & auto-status
    asset.assignedQuantity += qty;
    await asset.save();

    await AssetHistory.create({
      asset: asset._id,
      assignment: assignment._id,
      action: 'ASSIGNED',
      changes: {
        assignedTo: { from: null, to: employee.name },
        quantity:   { from: 0, to: qty }
      },
      performedBy: req.user._id,
      remarks: `Assigned ${qty} unit(s) to ${employee.name} (${employee.employeeId || employee.department || 'N/A'})`
    });

    // Return the populated assignment so the frontend can render immediately
    const populated = await AssetAssignment.findById(assignment._id)
      .populate('employee', 'name employeeId department')
      .populate('assignedBy', 'name role');

    res.status(201).json({ message: 'Asset assigned successfully', assignment: populated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Return an assigned asset
// @route   PATCH /api/assets/:id/assignments/:assignmentId/return
// @access  Private (Admin, HR, SuperAdmin)
//
// Body: { returnDate, condition, returnRemarks }
//   condition — 'Good' | 'Damaged' | 'Lost'
//
// System actions by condition:
//   Good    → assignedQty--, availableQty++ (pre-save auto-recalculates)
//   Damaged → assignedQty--, asset status forced to 'Under Repair'
//             (availableQty stays reduced — unit is out of circulation)
//   Lost    → assignedQty--, totalQty-- (unit is gone permanently)
//             (availableQty re-derived by pre-save from new totals)
const returnAsset = async (req, res) => {
  try {
    const { returnDate, condition, returnRemarks } = req.body;

    // ── Validate condition ──
    const VALID_CONDITIONS = ['Good', 'Damaged', 'Lost'];
    if (!condition) {
      return res.status(400).json({ message: 'Asset condition is required (Good, Damaged, or Lost)' });
    }
    if (!VALID_CONDITIONS.includes(condition)) {
      return res.status(400).json({ message: `Condition must be one of: ${VALID_CONDITIONS.join(', ')}` });
    }

    // ── Validate return date ──
    let resolvedReturnDate = new Date();
    if (returnDate) {
      resolvedReturnDate = new Date(returnDate);
      if (isNaN(resolvedReturnDate.getTime())) {
        return res.status(400).json({ message: 'Invalid return date' });
      }
    }

    // ── Load assignment — must belong to the asset in the URL ──
    const assignment = await AssetAssignment.findOne({
      _id: req.params.assignmentId,
      asset: req.params.id
    }).populate('employee', 'name employeeId department');

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    // ── Prevent duplicate return (idempotency guard) ──
    if (assignment.status === 'Returned') {
      return res.status(400).json({
        message: 'This assignment has already been returned on ' +
          new Date(assignment.returnedDate).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric'
          })
      });
    }

    // ── Validate return date is not before assigned date ──
    if (resolvedReturnDate < new Date(assignment.assignedDate)) {
      return res.status(400).json({
        message: 'Return date cannot be before the assignment date (' +
          new Date(assignment.assignedDate).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric'
          }) + ')'
      });
    }

    const asset = await Asset.findById(req.params.id);
    if (!asset) return res.status(404).json({ message: 'Asset not found' });

    // ── System action 3: Update assignment record ──
    assignment.status          = 'Returned';
    assignment.returnedDate    = resolvedReturnDate;
    assignment.returnedBy      = req.user._id;
    assignment.returnCondition = condition;
    assignment.returnRemarks   = returnRemarks?.trim() || null;
    await assignment.save();

    // ── System actions 1 & 2: Adjust asset quantities based on condition ──
    // Action 2: always decrease assignedQuantity
    asset.assignedQuantity = Math.max(0, asset.assignedQuantity - assignment.quantity);

    if (condition === 'Good') {
      // Action 1: restore to available — pre-save auto-recalculates availableQuantity
      // No extra step needed; asset.save() will recalc availableQuantity = total - assigned
      // Status auto-returns to 'Available' if it was 'Fully Assigned'
      await asset.save();

    } else if (condition === 'Damaged') {
      // Unit is back but not serviceable — keep out of available pool
      // Force status to Under Repair so pre-save auto-status logic is bypassed
      asset.status = 'Under Repair';
      await asset.save();

    } else if (condition === 'Lost') {
      // Unit is gone permanently — reduce totalQuantity
      // availableQuantity = totalQuantity - assignedQuantity (recalced by pre-save)
      // Guard: totalQuantity must not go below assignedQuantity after reduction
      const newTotal = asset.totalQuantity - assignment.quantity;
      if (newTotal < 0) {
        // Edge case: shouldn't happen, but protect against negative inventory
        asset.totalQuantity = 0;
      } else {
        asset.totalQuantity = newTotal;
      }
      // Clamp assignedQuantity too, in case of any prior data inconsistency
      asset.assignedQuantity = Math.min(asset.assignedQuantity, asset.totalQuantity);
      await asset.save();
    }

    // ── System action 4: Create asset history record ──
    const conditionLabels = {
      Good:    'returned in good condition',
      Damaged: 'returned damaged — asset marked Under Repair',
      Lost:    'reported lost — inventory reduced'
    };

    // Use specific action codes for Damaged/Lost so history filters work cleanly
    const historyAction = condition === 'Damaged' ? 'DAMAGED'
                        : condition === 'Lost'    ? 'LOST'
                        : 'RETURNED';

    await AssetHistory.create({
      asset:      asset._id,
      assignment: assignment._id,
      action:     historyAction,
      changes: {
        returnedBy: { from: null, to: assignment.employee?.name },
        quantity:   { from: assignment.quantity, to: 0 },
        condition:  { from: null, to: condition }
      },
      performedBy: req.user._id,
      remarks: `${assignment.quantity} unit(s) ${conditionLabels[condition]}` +
               (returnRemarks?.trim() ? ` — ${returnRemarks.trim()}` : '')
    });

    // ── System action 5: return updated assignment for frontend to refresh employee asset list ──
    const populated = await AssetAssignment.findById(assignment._id)
      .populate('employee',   'name employeeId department')
      .populate('returnedBy', 'name role')
      .populate('assignedBy', 'name role');

    res.status(200).json({
      message: condition === 'Good'
        ? 'Asset returned successfully'
        : condition === 'Damaged'
          ? 'Asset returned — marked as Under Repair'
          : 'Asset reported as lost — inventory updated',
      assignment: populated,
      asset: {
        _id:               asset._id,
        status:            asset.status,
        totalQuantity:     asset.totalQuantity,
        assignedQuantity:  asset.assignedQuantity,
        availableQuantity: asset.availableQuantity
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all assignments across all assets (global view) with filters & pagination
// @route   GET /api/assets/assignments
// @access  Private (Admin, HR, AGM, SuperAdmin)
//
// Query params:
//   status     — Active | Returned | Overdue
//   employeeId — filter by employee ObjectId
//   assetId    — filter by asset ObjectId
//   search     — fuzzy match on employee name / employeeId / asset name
//   page, limit
const getAssignments = async (req, res) => {
  try {
    const {
      status = '',
      employeeId = '',
      assetId = '',
      search = '',
      page = 1,
      limit = 20
    } = req.query;

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    // Build base query
    const query = {};
    if (status && ['Active', 'Returned', 'Overdue'].includes(status)) query.status = status;
    if (employeeId) query.employee = employeeId;
    if (assetId)    query.asset    = assetId;

    // For text search we do a two-step: find matching employee/asset IDs first
    if (search.trim()) {
      const [matchingEmployees, matchingAssets] = await Promise.all([
        User.find({
          $or: [
            { name:       { $regex: search.trim(), $options: 'i' } },
            { employeeId: { $regex: search.trim(), $options: 'i' } },
            { department: { $regex: search.trim(), $options: 'i' } }
          ]
        }).select('_id'),
        Asset.find({
          $or: [
            { assetName:   { $regex: search.trim(), $options: 'i' } },
            { assetNumber: { $regex: search.trim(), $options: 'i' } }
          ]
        }).select('_id')
      ]);

      const empIds   = matchingEmployees.map(e => e._id);
      const assetIds = matchingAssets.map(a => a._id);

      query.$or = [
        { employee: { $in: empIds } },
        { asset:    { $in: assetIds } }
      ];
    }

    // Auto-flag overdue assignments on the fly before returning
    const now = new Date();
    await AssetAssignment.updateMany(
      { status: 'Active', expectedReturnDate: { $lt: now, $exists: true, $ne: null } },
      { $set: { status: 'Overdue' } }
    );

    const [assignments, total] = await Promise.all([
      AssetAssignment.find(query)
        .populate('asset',      'assetName assetNumber category modelName')
        .populate('employee',   'name employeeId department')
        .populate('assignedBy', 'name role')
        .populate('returnedBy', 'name role')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      AssetAssignment.countDocuments(query)
    ]);

    res.status(200).json({
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      assignments
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all assignments for a specific asset (used in AssetDetail page)
// @route   GET /api/assets/:id/assignments
// @access  Private (Admin, HR, AGM, SuperAdmin)
const getAssetAssignments = async (req, res) => {
  try {
    const { status = '' } = req.query;

    const query = { asset: req.params.id };
    if (status && ['Active', 'Returned', 'Overdue'].includes(status)) query.status = status;

    // Auto-flag overdue
    const now = new Date();
    await AssetAssignment.updateMany(
      { asset: req.params.id, status: 'Active', expectedReturnDate: { $lt: now, $exists: true, $ne: null } },
      { $set: { status: 'Overdue' } }
    );

    const assignments = await AssetAssignment.find(query)
      .populate('employee',   'name employeeId department')
      .populate('assignedBy', 'name role')
      .populate('returnedBy', 'name role')
      .sort({ createdAt: -1 });

    res.status(200).json({ assignments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Global asset history list — all events across all assets
// @route   GET /api/assets/history
// @access  Private (Admin, HR, AGM, SuperAdmin)
//
// Query params:
//   action     — filter by action enum (CREATED|UPDATED|ASSIGNED|RETURNED|DAMAGED|LOST|DELETED etc.)
//   assetId    — filter by specific asset
//   performedBy— filter by user who performed the action
//   search     — text search against asset name, asset number, performer name
//   dateFrom   — ISO date string, inclusive start
//   dateTo     — ISO date string, inclusive end
//   page, limit
const getAssetHistory = async (req, res) => {
  try {
    const {
      action   = '',
      assetId  = '',
      performedBy = '',
      search   = '',
      dateFrom = '',
      dateTo   = '',
      page     = 1,
      limit    = 20
    } = req.query;

    const VALID_ACTIONS = ['CREATED','UPDATED','ASSIGNED','RETURNED','DAMAGED','LOST','STATUS_CHANGED','RETIRED','DELETED'];

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    const query = {};

    if (action) {
      if (!VALID_ACTIONS.includes(action)) {
        return res.status(400).json({ message: `Invalid action. Valid values: ${VALID_ACTIONS.join(', ')}` });
      }
      query.action = action;
    }
    if (assetId) query.asset = assetId;
    if (performedBy) query.performedBy = performedBy;

    // Date range filter
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // Text search: match against asset name/number or performer name
    if (search.trim()) {
      const [matchingAssets, matchingUsers] = await Promise.all([
        Asset.find({
          $or: [
            { assetName:   { $regex: search.trim(), $options: 'i' } },
            { assetNumber: { $regex: search.trim(), $options: 'i' } },
            { category:    { $regex: search.trim(), $options: 'i' } },
          ]
        }).select('_id'),
        User.find({
          $or: [
            { name:       { $regex: search.trim(), $options: 'i' } },
            { employeeId: { $regex: search.trim(), $options: 'i' } }
          ]
        }).select('_id')
      ]);

      const assetIds = matchingAssets.map(a => a._id);
      const userIds  = matchingUsers.map(u => u._id);

      // Also match remarks text
      query.$or = [
        { asset:       { $in: assetIds } },
        { performedBy: { $in: userIds } },
        { remarks:     { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const [history, total] = await Promise.all([
      AssetHistory.find(query)
        .populate('asset',       'assetName assetNumber category')
        .populate('performedBy', 'name employeeId role')
        .populate('assignment',  'quantity')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      AssetHistory.countDocuments(query)
    ]);

    res.status(200).json({
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      history
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get history for a single asset (existing behaviour, explicit route)
// @route   GET /api/assets/:id/history
// @access  Private (Admin, HR, AGM, SuperAdmin)
const getAssetHistoryById = async (req, res) => {
  try {
    const { action = '', page = 1, limit = 50 } = req.query;
    const VALID_ACTIONS = ['CREATED','UPDATED','ASSIGNED','RETURNED','DAMAGED','LOST','STATUS_CHANGED','RETIRED','DELETED'];

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));

    const query = { asset: req.params.id };
    if (action) {
      if (!VALID_ACTIONS.includes(action)) {
        return res.status(400).json({ message: `Invalid action. Valid values: ${VALID_ACTIONS.join(', ')}` });
      }
      query.action = action;
    }

    const [history, total] = await Promise.all([
      AssetHistory.find(query)
        .populate('performedBy', 'name employeeId role')
        .populate('assignment',  'quantity employee')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      AssetHistory.countDocuments(query)
    ]);

    res.status(200).json({ total, page: pageNum, totalPages: Math.ceil(total / limitNum), history });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Dashboard summary stats + recent activity for asset widgets
// @route   GET /api/assets/dashboard-stats
// @access  Private (Admin, HR, AGM, SuperAdmin)
//
// Returns:
//   summary          — counts by asset status + total
//   recentAssignments— last 10 active/overdue assignments
//   recentReturns    — last 10 returned assignments
//   recentCredential — last 10 credential audit events
const getAssetDashboardStats = async (req, res) => {
  try {
    const CredentialAuditLog = require('../models/CredentialAuditLog');

    // ── Summary counts ──────────────────────────────────────────────────────
    const [
      total,
      available,
      fullyAssigned,
      underRepair,
      retired,
      // Damaged = assets that are Under Repair due to a DAMAGED return event
      // (the asset.status is 'Under Repair'; we surface it as Damaged in the widget
      //  because that's the business meaning)
      // Lost assets reduce totalQuantity permanently; we count history events
      lostEvents,
    ] = await Promise.all([
      Asset.countDocuments({}),
      Asset.countDocuments({ status: 'Available' }),
      Asset.countDocuments({ status: 'Fully Assigned' }),
      Asset.countDocuments({ status: 'Under Repair' }),
      Asset.countDocuments({ status: 'Retired' }),
      AssetHistory.countDocuments({ action: 'LOST' }),
    ]);

    // ── Recent activity ─────────────────────────────────────────────────────
    const [recentAssignments, recentReturns, recentCredential] = await Promise.all([
      // Last 10 active/overdue assignments
      AssetAssignment.find({ status: { $in: ['Active', 'Overdue'] } })
        .populate('asset',    'assetName assetNumber category')
        .populate('employee', 'name employeeId department')
        .sort({ createdAt: -1 })
        .limit(10),

      // Last 10 returned assignments (all conditions)
      AssetAssignment.find({ status: 'Returned' })
        .populate('asset',      'assetName assetNumber category')
        .populate('employee',   'name employeeId department')
        .populate('returnedBy', 'name role')
        .sort({ returnedDate: -1 })
        .limit(10),

      // Last 10 credential audit events
      CredentialAuditLog.find({})
        .populate('actorUserId',    'name employeeId role')
        .populate('targetEmployee', 'name employeeId department')
        .sort({ createdAt: -1 })
        .limit(10),
    ]);

    res.status(200).json({
      summary: {
        total,
        available,
        assigned: fullyAssigned,
        underRepair,
        retired,
        damaged: underRepair,
        lost:    lostEvents,
      },
      recentAssignments,
      recentReturns,
      // Only HR/Admin/SuperAdmin see credential activity — never expose to AGM/Manager
      recentCredential: ['SuperAdmin', 'Admin', 'HR'].includes(req.user.role)
        ? recentCredential
        : [],
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Employee: view own active/returned asset assignments
// @route   GET /api/assets/my-assignments
// @access  Private — all authenticated users (own data only, no role restriction)
const getMyAssignments = async (req, res) => {
  try {
    const { status = '' } = req.query;

    const query = { employee: req.user._id };
    if (status && ['Active', 'Returned', 'Overdue'].includes(status)) {
      query.status = status;
    }

    // Auto-flag overdue on own assignments
    const now = new Date();
    await AssetAssignment.updateMany(
      { employee: req.user._id, status: 'Active', expectedReturnDate: { $lt: now, $exists: true, $ne: null } },
      { $set: { status: 'Overdue' } }
    );

    const assignments = await AssetAssignment.find(query)
      .populate('asset',      'assetName assetNumber category modelName brand')
      .populate('assignedBy', 'name role')
      .sort({ createdAt: -1 });

    res.status(200).json({ assignments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createAsset,
  getAssets,
  getAssetById,
  updateAsset,
  deleteAsset,
  assignAsset,
  returnAsset,
  getAssignments,
  getMyAssignments,
  getAssetAssignments,
  getAssetHistory,
  getAssetHistoryById,
  getAssetDashboardStats
};
