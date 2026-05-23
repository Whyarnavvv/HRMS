const AuditLog = require('../models/AuditLog');

// @desc    List audit logs with filters
// @route   GET /api/audit-logs
// @access  Private (SuperAdmin)
exports.getAuditLogs = async (req, res) => {
  try {
    const {
      userId,
      action,
      module,
      fromDate,
      toDate,
      page = 1,
      limit = 20
    } = req.query;

    const query = {};
    if (userId) query.actorUserId = userId;
    if (action) query.action = action;
    if (module) query.module = module;
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));

    const [total, records] = await Promise.all([
      AuditLog.countDocuments(query),
      AuditLog.find(query)
        .populate('actorUserId', 'name email employeeId role')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
    ]);

    return res.status(200).json({
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
      records
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
